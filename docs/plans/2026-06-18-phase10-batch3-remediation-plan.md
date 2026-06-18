# Phase 10 Batch 3 — Input/Output Hardening Plan

> Branch: `develop`
> Mode: incremental; commits ordered least-risky → most-risky
> Skipped per user: F-003 (password length)

## Scope

| ID | Title | Severity | Effort | Frontend Impact |
|----|-------|----------|--------|-----------------|
| F-002 | bcrypt rounds 10 → 12 | Medium | XS | None |
| F-009 | Express JSON body size limit | Medium | XS | None |
| F-024 | Health endpoint timing-safe | Low | XS | None |
| F-007 | Admin SQL profiling tightening | Low | S | None |
| F-012 | Generic error messages | Medium | S | None (API surface) |
| F-010 | Content-Security-Policy header | Medium | M | **Verify build** |

## Execution Order (least → most risky)

### Step 1: F-002 — bcrypt rounds
**Risk:** None. Login gets ~100ms slower. Old hashes remain valid (bcrypt
self-identifies rounds in stored hash).

**Change:**
- Centralize bcrypt cost factor as `BCRYPT_COST` constant (currently
  hardcoded as `10` in several places)
- Default to 12; allow override via `BCRYPT_COST` env var
- Login flow uses existing hash (any rounds), new hashes use 12
- Migration: trigger re-hash on next successful login (verify against
  stored hash, if rounds < current cost, re-hash with new rounds)

**Test:** New `auth.bcrypt-rounds.security.test.ts` verifies:
- New passwords use 12 rounds
- Old 10-round hashes still verify
- Migration re-hash on next login

### Step 2: F-009 — JSON body size limit
**Risk:** None. Default 100kb (configurable via `JSON_BODY_LIMIT` env).
Returns 413 for oversized requests.

**Change:**
- `express.json({ limit: process.env.JSON_BODY_LIMIT || '100kb' })`
- One-line global middleware change

**Test:** POST 200kb JSON → expect 413.

### Step 3: F-024 — Health endpoint timing-safe
**Risk:** None. Currently returns different response times for healthy
vs unhealthy DB. Attacker can fingerprint state.

**Change:**
- `GET /api/health` always returns `{ status: 'ok' }` with constant
  response time (~50ms regardless of DB)
- Internal DB check moved to `/api/health/internal` (admin-only)
- Constant-time: pad response with random delay if needed

**Test:** Verify both endpoints exist; external returns fast regardless
of DB state.

### Step 4: F-007 — Admin SQL profiling tightening
**Risk:** Low — logging surface changes. Existing log scrapers might
parse differently.

**Change:**
- Strip values from logged SQL queries: only log parameterized query
  shape, not bound values
- Add log redaction for known PII fields: `password_hash`,
  `parent_phone`, `parent_name` (only in error logs, not main flow)
- New `redactPII()` helper in `src/lib/log-redact.ts`

**Test:** Snapshot test that verifies PII fields never appear in logs.

### Step 5: F-012 — Generic error messages
**Risk:** Medium — changes API contract surface. Frontend might rely
on specific error strings.

**Change:**
- Replace specific error messages with generic equivalents
- Keep HTTP status codes the same
- Move detailed errors to server logs only
- Affected endpoints (from audit): login, invite redeem, admin
  password change, etc.

**Test:** Snapshot test verifying each error response shape unchanged
(field names, status codes) but message body is generic.

### Step 6: F-010 — Content-Security-Policy header
**Risk:** Highest — can break frontend if too strict.

**Change (phase 1):** Add CSP in **report-only mode** (`Content-Security-Policy-Report-Only`)
with a permissive policy that allows current behavior. Collect violations.

**Change (phase 2, after running report-only in prod-like env):** Tighten
policy and switch to enforcement (`Content-Security-Policy`).

**Test:** Verify CSP header is present on responses; verify report-only
mode doesn't break frontend assets.

## Commit Strategy

Each finding → 1 feature commit + 1 test commit, in order F-002 → F-024 → F-007 → F-012 → F-010.

If any test fails, fix in place (don't push forward).

## Verification (end of batch)

- `npm run lint` clean
- `npm run lint:eslint --max-warnings=0` clean
- `npm run test:critical` passing
- `npm run build` succeeds
- `npm audit --omit=dev --audit-level=high` still 0 HIGH

## Out of Scope (will not be addressed in Batch 3)

- F-003 — password length (skipped per user)
- F-016/F-017/F-022/F-023/F-018/F-011 — Architectural (Batch 4)
- F-028/F-029/F-027 — Docker & ops (Batch 5)
- F-015/F-026/F-007 — Some hygiene items (Batch 6)

## Outstanding Residual (from Batch 2)

- **RES-1:** Verify `user_sessions.deleteExpiredSessions` has the same
  ISO 8601 vs SQLite datetime issue; if so, apply `datetime(expires_at)`
  wrapping. Will check during F-007 step.