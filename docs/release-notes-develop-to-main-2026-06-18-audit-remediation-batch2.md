# Release Notes — develop → main

> **Status:** ready for promotion (awaiting explicit approval)
> **Branch:** `develop` (local; not yet pushed)
> **Range:** 7 commits added since Batch 1 closeout (`67c3894..HEAD`)
> **Date:** 2026-06-18
> **Audit Batch:** 2 of 6 (Auth/Session Hardening)

## 🎯 Headline

Authentication now uses **short-lived access tokens + rotating refresh
tokens with theft detection**. Five audit findings closed (4 medium, 1 low);
**0 HIGH npm CVEs remain**; **88/88 critical tests pass**.

## ✨ Highlights

### 1h access tokens + 7d refresh tokens with rotation (F-004)
The single 7-day JWT auth model has been replaced with the OAuth-standard
two-cookie pattern:

- **`access_token` cookie** — 1-hour JWT, used for every API call
- **`refresh_token` cookie** — 7-day opaque random, used only by
  `POST /api/auth/refresh` to mint fresh access tokens
- **Rotation:** every refresh mints a new refresh token; old is marked used
- **Reuse detection:** if an already-used refresh token is presented, the
  entire token family is revoked and the user is forced to re-login
- **Backwards compatible:** the legacy 7d `auth_token` cookie is still
  accepted until users naturally re-login

### JWT secret hardening (F-005)
The hardcoded `'dev-secret-change-in-production'` fallback is gone.
Non-production environments now generate an ephemeral random secret
at startup (logged as a yellow warning). Production requires `JWT_SECRET`
≥ 32 chars or the app refuses to boot.

### Atomic invite redemption (F-006)
Two concurrent calls to `/api/invites/redeem` for the same code can no
longer both succeed. Fixed via `UPDATE WHERE used_by IS NULL` with
atomic check on `result.changes > 0` (SQLite) or `RETURNING` (Postgres).
The previous read-then-update method is preserved as `use()` for backward
compat with a TOCTOU docstring warning.

### Dedicated rate limit on invite redemption (F-008)
New 10/15min limiter on `/api/invites/redeem` — tighter than the
general 500/15min post limit, applied before auth so unauthenticated
enumeration attempts are also blocked.

### `__Host-auth_token` cookie prefix in production (F-020)
The auth cookie is now `__Host-auth_token` in production, leveraging
the browser-enforced constraint that blocks subdomain-cookie-scoping
attacks. Dev/test still use the plain `auth_token` name so HTTP localhost
keeps working.

## 🐛 Bug Fixes

- **Refresh-token cleanup actually works now:** the `DELETE FROM
  refresh_tokens WHERE expires_at < datetime('now')` SQL never matched
  in practice because ISO 8601 strings sort lexicographically greater
  than SQLite's native datetime. Fixed by wrapping the column in
  `datetime(expires_at)`. ⚠️ The same latent bug likely exists in
  `user_sessions.deleteExpiredSessions` — flagged for follow-up.

## 🔧 Operational Changes

| Item | Before | After |
|------|--------|-------|
| Access token lifetime | 7 days | **1 hour** |
| Refresh token | (none) | **7 days**, rotating |
| Reuse detection | (none) | **Revoke entire family** |
| JWT secret in dev | Hardcoded string | **Ephemeral random** |
| JWT secret in prod | Allowed <32 chars | **Required ≥32 chars or throws** |
| Invite redemption | Read-then-update (TOCTOU) | **Atomic single-use** |
| Invite rate limit | 500/15min (general) | **10/15min (dedicated)** |
| Auth cookie name (prod) | `auth_token` | **`__Host-auth_token`** |

## 📊 Metrics

| Metric | Before | After |
|--------|--------|-------|
| Audit findings open | 15 | **10** (closed F-004, F-005, F-006, F-008, F-020) |
| Critical tests | 36 | **88** (+52) |
| npm HIGH CVEs | 5 | **0** |
| ESLint warnings | n/a | **0** (under `--max-warnings=0`) |

## 🧪 Test Coverage Added (Batch 2)

| File | Cases | Coverage |
|------|------:|----------|
| `auth.jwt-secret.security.test.ts` | 5 | Ephemeral dev secret, prod enforcement, per-process uniqueness |
| `auth.cookie-name.security.test.ts` | 5 | `__Host-` prefix logic, parseAuthTokenCookie, source-grep regression |
| `invite.atomic.security.test.ts` | 5 | Atomic SQL, race test with `Promise.all` × 10 |
| `auth.refresh.security.test.ts` | 15 | Token shape, rotation success/loss, family revocation, cross-family isolation, idempotence, expiry cleanup, count, end-to-end reuse detection |
| `auth.refresh.http.security.test.ts` | 6 | supertest integration: all 401 paths, 200 rotation, reuse detection, revoked-session rejection |

## 🛠 Deployment Notes

1. **No database migration required.** The `refresh_tokens` table is
   created idempotently on next `initSchema()` call. Existing deployments
   upgrade in-place.
2. **Old sessions keep working.** Users in flight with a legacy 7d JWT
   in `auth_token` will continue to authenticate via the new fallback
   in `requireAuth`. As those 7d tokens naturally expire over the next
   week, users re-login and pick up the new cookies.
3. **Frontend follow-up recommended (not blocking).** The new
   `POST /api/auth/refresh` endpoint is ready but the frontend doesn't
   yet call it on 401. Until that lands, users mid-session will hit a
   hard re-login every hour. See `docs/plans/2026-06-18-phase10-batch2-remediation-report.md`
   §"Frontend Follow-up" for the recommended interceptor shape.
4. **JWT_SECRET env var.** Production must set `JWT_SECRET` to a value
   of at least 32 characters. If unset or too short, the app throws at
   startup with a clear message. **No silent fallback anymore.**

## 🚨 Breaking Changes

- **Access token lifetime:** 7 days → 1 hour. Affects clients that
  hold a long-lived session without refresh (i.e., current clients).
  Mitigation: legacy 7d JWT is still accepted; users re-login naturally.
- **Login now sets 3 cookies** instead of 1 (`access_token`,
  `refresh_token`, `auth_token` legacy). Same total cookie budget; just
  split differently.
- **Logout clears 3 cookies.** If a custom client only cleared one, it
  will leak the other two. The middleware handles all three on `/api/auth/logout`.

## 🔄 Migration Checklist (for ops)

- [ ] Verify production `JWT_SECRET` is set and ≥ 32 chars before deploying
- [ ] After deploy, watch `tail -f server-error.log` for `JWT_SECRET must be at least 32 characters`
- [ ] Within 7 days post-deploy: confirm `refresh_tokens` table populating (expected: 1 row per active user session)
- [ ] Within 14 days post-deploy: confirm legacy `auth_token` cookies no longer in use (browser dev tools / server logs)

## 📋 Commits (develop only — not yet on main)

```
d8bfbbe test(auth): HTTP integration tests for /api/auth/refresh endpoint (F-004 step 4)
f23f798 test(auth): comprehensive refresh-token rotation coverage (F-004 step 3)
3e2f93d feat(auth): login emits access+refresh cookies, new /refresh endpoint (F-004 step 2)
ddf6af9 feat(auth): refresh_tokens table + service skeleton (F-004 step 1)
652c274 fix(auth): use __Host-auth_token cookie name in production (F-020)
9a827db fix(rate-limit): add dedicated 10/15min limiter to /api/invites/redeem (F-008)
33c3759 fix(invite): atomic redemption via UPDATE WHERE used_by IS NULL (F-006)
bfad050 fix(security): replace hardcoded JWT dev secret with ephemeral random (F-005)
```

*(Plus a forthcoming `chore(closeout): phase 10 batch 2 remediation report + release notes` commit adding this document.)*

## ⏭️ What's Next (Batch 3 preview, pending approval)

Input/Output hardening batch — 7 medium/low findings:
- **F-002** bcrypt rounds 10 → 12 (slower brute-force)
- **F-003** minimum admin password length (12 chars)
- **F-009** Express JSON body size limit (DoS prevention)
- **F-010** Content-Security-Policy header (XSS mitigation in dev)
- **F-012** generic error messages (no info leak)
- **F-024** health endpoint timing-safe (no DB query result leaks)
- **F-007** admin SQL profiling tightening (no PII in logs)

Full plan to be drafted separately.

---

**Promotion action required:**
```
# Run only after explicit user approval
git checkout main
git merge --no-ff develop -m "merge: audit remediation batch 1+2 (develop→main)"
git push origin main
```

**No merge has been performed.** Awaiting approval per develop-first rule.