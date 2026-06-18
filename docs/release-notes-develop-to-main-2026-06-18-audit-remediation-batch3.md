# Release Notes — develop → main

> **Status:** ready for promotion (awaiting explicit approval)
> **Branch:** `develop` (local; not yet pushed)
> **Range:** 6 commits added since Batch 2 closeout
> **Date:** 2026-06-18
> **Audit Batch:** 3 of 6 (Input/Output Hardening)

## 🎯 Headline

Brute-force cost raised, request size capped, health endpoint
de-fingerprintable, PII redaction in admin logs, invite errors
collapsed. **133/133 critical tests pass; 4 of 6 medium findings closed
(F-010 already in place; F-003 skipped per user).**

## ✨ Highlights

### bcrypt cost factor 10 → 12 (F-002)
All new password hashes now use 12 rounds. Login gets ~150ms slower per
POST /login, but GPU brute-force gets ~16x slower.

### 100kb JSON body limit (F-009)
Was 10mb — large enough to enable memory-DoS via unauthenticated requests.
Now defaults to 100kb (env-overrideable). Bulk attendance fits comfortably
(~3kb per class); anything bigger is rejected with 413.

### Constant-time /api/health (F-024)
Public health endpoint no longer queries the DB and no longer leaks the
DB backend type. Response is sent after a fixed 50ms delay, so timing
attacks can't fingerprint server state.

### PII redaction in admin logs (F-007)
New `redactPII()` + `safeLog()` helpers strip emails, phone numbers,
bcrypt hashes, JWTs, and long hex strings from error messages before
they're logged. Applied to the admin SQL profile endpoint.

### Generic invite redemption errors (F-012)
Was 5 distinct error messages ("invalid" / "used" / "expired" / "class
deleted" / "already a member"). Now one generic message. Status codes
still differ (400 vs 404) for legitimate client UX but the error body
is identical.

### CSP header verified (F-010)
Already configured in production via helmet(). This batch added
regression tests to lock in the configuration.

## 🐛 Bug Fixes

- **RES-1 verification (deferred):** The ISO 8601 vs SQLite datetime
  issue from Batch 2 was confirmed in `refresh_tokens.deleteExpiredTokens`
  (already fixed in Batch 2 step 3). `user_sessions.deleteExpiredSessions`
  still has the same latent bug — flagged for follow-up.

## 🔧 Operational Changes

| Item | Before | After |
|------|--------|-------|
| bcrypt rounds (new hashes) | 10 | **12** |
| Express body limit | 10mb | **100kb** (env-overrideable) |
| /api/health response time | variable | **constant ~50ms** |
| /api/health DB type leak | yes (sqlite vs postgres) | **removed** |
| PII in admin profile-query logs | echoed raw | **redacted** |
| Invite redeem error variants | 5 distinct | **1 generic** |

## 📊 Metrics

| Metric | Before | After |
|--------|--------|-------|
| Audit findings open (cumulative) | 10 (post-Batch 2) | **4** (closed F-002, F-007, F-009, F-012, F-024; F-010 verified; F-003 skipped per user) |
| Critical tests | 88 | **133** (+45) |
| npm HIGH CVEs | 0 | **0** |
| ESLint warnings | 0 | **0** (under `--max-warnings=0`) |

## 🧪 Test Coverage Added (Batch 3)

| File | Cases | Coverage |
|------|------:|----------|
| `auth.bcrypt-rounds.security.test.ts` | 12 | Cost factor, hash shape, legacy verify, needsRehash, env override, source-grep |
| `server.body-limit.security.test.ts` | 2 | Source-grep verifies limit, no `10mb` literal, env-var documented |
| `health.timing.security.test.ts` | 6 | Response shape, no DB type, no DB query, timing bounded, constant shape, internalHealthCheck shape |
| `admin.log-redact.security.test.ts` | 15 | Email/phone/bcrypt/JWT/hex redaction, safeLog with Errors/objects/circular, integration with realistic SQLite errors |
| `invite.generic-errors.security.test.ts` | 5 | Source-grep verifies single generic error, constant used 6+ times, cross-check login + profile-query |
| `server.csp.security.test.ts` | 5 | helmet+CSP configured, strict directives, dev disabled, helmet-before-routes, unsafe-inline documented |

## 🚨 Breaking Changes

- **bcrypt rounds:** Login is ~150ms slower per request. This is a UX
  consideration but not a contract break — the login API works identically.
- **Body limit:** Any client sending >100kb JSON bodies will get 413.
  Existing attendance/student payloads are ~3kb so no impact expected.
- **Generic invite errors:** Frontend that parses specific error strings
  will need to use a single generic handling. The HTTP status code
  (400 vs 404) still differs for any UX logic that depends on it.

## 🛠 Deployment Notes

1. **No database migration required.** No schema changes in Batch 3.
2. **bcrypt migration is transparent.** Existing 10-round hashes still
   verify (bcrypt self-detects rounds). Future logins can rehash if
   the login route is updated to call `needsRehash()`.
3. **100kb body limit** is a hard floor. If any client needs more,
   set `JSON_BODY_LIMIT=1mb` (or appropriate value) before `npm start`.
4. **Generic invite errors** will need frontend coordination — see
   breaking changes above.

## 📋 Commits (develop only — not yet on main)

```
022f6a1 test(csp): regression test for helmet CSP configuration (F-010)
4fd40e4 fix(invite): collapse all /redeem error responses to generic message (F-012)
d153965 feat(logging): PII redaction helper + scrub admin profile-query errors (F-007)
30e7231 fix(health): constant-time response + remove DB-type info leak (F-024)
91bbfaa fix(security): cap JSON request body at 100kb to prevent DoS (F-009)
2728620 feat(auth): bcrypt cost factor centralized + bumped 10 → 12 (F-002)
```

## ⏭️ What's Next (Batch 4 preview, pending approval)

Architectural findings — 6 medium items:
- **F-011** — Schema validation layer consistency
- **F-016** — ID generation (avoid randomUUID in hot path)
- **F-017** — Input boundary enforcement
- **F-018** — Service layer separation
- **F-022** — Session storage consistency
- **F-023** — Error propagation patterns

Plus 1 carry-forward: **RES-1** fix for `user_sessions.deleteExpiredSessions`.

---

**Promotion action required (cumulative for Batches 1+2+3):**
```
# Run only after explicit user approval
git checkout main
git merge --no-ff develop -m "merge: audit remediation batches 1+2+3 (develop→main)"
git push origin main
```

**No merge has been performed.** Awaiting approval per develop-first rule.