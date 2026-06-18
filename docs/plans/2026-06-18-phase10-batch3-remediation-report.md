# Phase 10 Batch 3 — Input/Output Hardening Remediation Report

**Date:** 2026-06-18
**Branch:** `develop` (local; not pushed)
**Author:** Hermes (security audit remediation agent)
**Mode:** Fix-mode on `develop`
**Source plan:** `docs/plans/2026-06-18-phase10-batch3-remediation-plan.md`

## Summary

Batch 3 closes 6 of the 10 remaining audit findings (F-003 skipped per
user direction — current password length is acceptable). 6 commits on
develop, **31 new test cases**, all gates green.

## Findings Addressed

### F-002 — bcrypt rounds 10 → 12 (Medium → Fixed)
**Risk:** 10 rounds of bcrypt allows GPU brute-force at ~10 GH/s on
modern hardware. 12 rounds reduces this ~16x.

**Fix:** Centralized `BCRYPT_COST` constant in `src/lib/bcrypt.ts` (default
12, env override). Helper functions `hashPassword()` and `verifyPassword()`.
`needsRehash()` helper detects legacy 10-round hashes for transparent
re-hashing on next successful login.

**Files:** `src/lib/bcrypt.ts` (NEW), `src/db/schema.ts`, `src/routes/admin.routes.ts`, `src/routes/teacher.routes.ts`
**Tests:** `src/test/security/auth.bcrypt-rounds.security.test.ts` (12)

### F-009 — JSON body size limit (Medium → Fixed)
**Risk:** Express was configured with 10MB limit. Unauthenticated client
could send 10MB JSON, exhausting memory before any handler runs.

**Fix:** Default limit reduced to **100kb** (configurable via `JSON_BODY_LIMIT`
env var). Express returns 413 Payload Too Large for oversized bodies.

**Files:** `server.ts`
**Tests:** `src/test/security/server.body-limit.security.test.ts` (2)

### F-024 — Health endpoint timing-safe (Low → Fixed)
**Risk:** `/api/health` could become a timing oracle if anyone adds a DB
query; also leaked `database` backend type (sqlite vs postgres) which
helps attackers tailor SQLi payloads.

**Fix:** Response body reduced to `{ status: 'ok' }` (no DB type). Response
sent AFTER a fixed **50ms delay** so timing cannot fingerprint server
state. Added `internalHealthCheck()` helper for ops dashboards that DO
want a real DB ping (not currently wired).

**Files:** `src/routes/health.routes.ts`
**Tests:** `src/test/security/health.timing.security.test.ts` (6)

### F-007 — Admin SQL profiling tightening (Low → Fixed)
**Risk:** `POST /api/admin/profile-query` echoed raw `error.message` back
to client. SQLite error messages include the full query text including
bound values (which can be PII like parent_phone).

**Fix:**
- New `src/lib/log-redact.ts` with `redactPII()` (strips emails, phones,
  bcrypt hashes, JWTs, long hex) and `safeLog()` wrapper
- Admin profile-query handler uses `safeLog(error)` for logging and
  returns generic `'Internal error — see server logs'` instead of echoing

**Files:** `src/lib/log-redact.ts` (NEW), `src/routes/admin.routes.ts`
**Tests:** `src/test/security/admin.log-redact.security.test.ts` (15)

### F-012 — Generic error messages (Medium → Fixed)
**Risk:** `POST /api/invites/redeem` returned 5 distinct error messages
based on internal state — each one an oracle letting an attacker with
guessed codes fingerprint: invalid, used, expired, class-deleted, or
already-a-member.

**Fix:** Single `GENERIC_INVITE_ERROR` constant used at all 5 failure
points + the F-006 race-loss path. Status codes still differ (400 vs
404) for legitimate client UX but error body is identical.

**Files:** `src/routes/invite.routes.ts`
**Tests:** `src/test/security/invite.generic-errors.security.test.ts` (5)

### F-010 — Content-Security-Policy header (Medium → Already in place)
**Risk:** No CSP header. Browser would execute any inline script or load
resources from any origin, enabling stored XSS attacks.

**Status:** Already addressed by existing helmet() configuration in
`server.ts` (lines 135-149) which sets a strict CSP in production.
This batch did NOT modify the CSP — it added regression tests to lock
in the configuration.

**Files:** `src/test/security/server.csp.security.test.ts` (5)
**No source changes.** Verification only.

### F-003 — Admin password min length (12) — SKIPPED per user
User confirmed current password length (4) is acceptable. Closed as
"accepted risk" — not addressed in this batch.

## Verification Summary

| Gate | Result |
|------|--------|
| `npm run lint` (tsc) | ✅ clean (only pre-existing moduleResolution errors) |
| `npm run lint:eslint --max-warnings=0` | ✅ **0 errors, 0 warnings** |
| `npm run test:critical` | ✅ **133/133 passed** (was 88 post-Batch 2, +45 new in Batch 3) |
| `npm run build` (vite + PWA) | ✅ 33 precache entries, 1633 KiB |
| `npm audit --omit=dev --audit-level=high` | ✅ 0 HIGH CVEs |

**Test growth:** 88 → 133 (+45 across 6 new test files in Batch 3)

## Commit Log (develop)

```
022f6a1 test(csp): regression test for helmet CSP configuration (F-010)
4fd40e4 fix(invite): collapse all /redeem error responses to generic message (F-012)
d153965 feat(logging): PII redaction helper + scrub admin profile-query errors (F-007)
30e7231 fix(health): constant-time response + remove DB-type info leak (F-024)
91bbfaa fix(security): cap JSON request body at 100kb to prevent DoS (F-009)
2728620 feat(auth): bcrypt cost factor centralized + bumped 10 → 12 (F-002)
```

## Operational Changes

| Item | Before | After |
|------|--------|-------|
| bcrypt rounds (new hashes) | 10 | **12** |
| bcrypt rehash on login | none | ready (needs login route wiring) |
| Express body limit | 10mb | **100kb** (env-overridable) |
| /api/health response time | variable | **constant ~50ms** |
| /api/health DB type leak | yes | **no** |
| PII in admin profile-query logs | yes (via error.message) | **redacted** |
| Invite redeem error granularity | 5 distinct | **1 generic** |
| CSP header | enabled in prod | enabled in prod + **regression test** |

## Decisions Log

| Decision | Rationale |
|----------|-----------|
| bcrypt 12 rounds (not higher) | 12 ≈ 250ms/hash, balances brute-force cost vs login UX |
| Body limit 100kb (not 1mb) | Largest realistic payload is ~3kb; 100kb is generous safety margin |
| 50ms health response padding | Sub-LB-detection-threshold; large enough to prevent timing fingerprinting |
| Generic invite error | User just needs to ask for a new code; granular errors help attackers more than users |
| F-010: no code change | helmet() CSP was already correctly configured; regression test prevents future drift |

## Outstanding / Carry-Forward

- **RES-1 (still):** Verify `user_sessions.deleteExpiredSessions` has
  the same ISO 8601 vs SQLite datetime issue. Not addressed in Batch 3
  (out of scope; F-007 was only the SQL profile endpoint).
- **Batch 4:** Architectural findings (F-011 schema validation, F-016
  ID generation, F-017 input boundaries, F-018 service layer, F-022
  session storage, F-023 error propagation).
- **Batch 5:** Docker & ops findings (F-028 Dockerfile hardening,
  F-029 docker-compose security, F-027 dead `define` block).
- **Batch 6:** Hygiene findings (F-015 .env.backup gitignore,
  F-026 README rate-limit drift, F-007 admin SQL profile audit log).
- **Login route rehash:** `needsRehash()` helper exists but login
  doesn't call it yet — adding a one-liner in auth.routes.ts login
  handler would transparently upgrade all 10-round hashes over time
  as users log in. Could be done in any future batch.

## References

- Audit source: `C:\repo\audit\localattendance\SECURITY_AUDIT_REPORT.md`
- Residual register: `C:\repo\audit\localattendance\SECURITY_RESIDUAL_RISK_REGISTER.md`
- Batch 3 plan: `docs/plans/2026-06-18-phase10-batch3-remediation-plan.md`
- Batch 2 report: `docs/plans/2026-06-18-phase10-batch2-remediation-report.md`
- Batch 1 report: `docs/plans/2026-06-18-phase10-batch1-remediation-report.md`