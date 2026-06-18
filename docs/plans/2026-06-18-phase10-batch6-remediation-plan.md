# Phase 10 Batch 6 — Hygiene & Carry-Forward Plan

> Branch: `develop`
> Mode: incremental; commits ordered least → most risky
> 3 items remaining (F-015 false alarm, F-026 README drift, RES-1 carry-forward)

## Scope

| ID | Title | Severity | Effort | Risk | Status |
|----|-------|----------|--------|------|--------|
| F-015 | `.env.backup*` gitignore pattern | Low | XS | None | **False alarm** — already fixed |
| F-026 | README rate-limit drift | Low | XS | None | Real — needs sync |
| RES-1 | `user_sessions.deleteExpiredSessions` + `invite_codes.deleteExpiredInviteCodes` ISO 8601 bug | Medium | XS | Very low (correctness) | Real — same bug as Batch 2 fix |

## Status of F-015 (false alarm — already fixed)

Verified via `git check-ignore`:
```
$ git check-ignore .env.backup.20260429_124554
.env.backup.20260429_124554
```
The existing `.env*` pattern on `.gitignore` line 7 already matches
`.env.backup.*` because the leading `.env` matches the start of the
filename. The `!.env.example` exception correctly exempts the example
template.

**No action needed.** Document this in the closeout so future audits
don't flag it again.

## Execution Order (least → most risky)

### Step 1: F-026 — README rate-limit drift (XS, no risk)
**Current README:** "login: 5/15min, writes: 100/15min"
**Actual code (verified):**
- `src/routes/middleware.ts` line 48: `max: 150` for login
- `src/routes/middleware.ts` line 60: `max: 500` for postLimiter

**Change:** Update README.md line 45 to "login: 150/15min, writes: 500/15min".
Add a parenthetical noting the limit was raised to accommodate ~40
simultaneous teacher logins during morning rush.

### Step 2: RES-1 — Fix same ISO 8601 bug in 2 remaining prepared statements (XS, low risk)

**Problem:** Both `user_sessions.expires_at` and `invite_codes.expires_at`
are stored as ISO 8601 strings (e.g. `2026-06-18T12:00:00.000Z`) because
the services call `new Date(...).toISOString()` when inserting.

But the prepared statements compare with `datetime('now')` which
returns SQLite native format (`2026-06-18 12:00:00`). **String comparison
of ISO 8601 vs native format is unreliable** (the `T` separator vs
space means strings compare incorrectly when dates share a prefix).

This is the same bug that was fixed in Batch 2 step 3 for
`refresh_tokens.deleteExpiredRefreshTokens` (now uses
`datetime(expires_at) < datetime('now')`).

**Affected statements (src/db/statements.ts):**
- Line 68: `deleteExpiredInviteCodes` — was correct previously because
  the column had a `CURRENT_TIMESTAMP` default, BUT `class.routes.ts:190`
  now inserts ISO 8601 strings. Same bug.
- Line 75: `deleteExpiredSessions` — same situation: `user_sessions.expires_at`
  is inserted as ISO 8601 by `sessionService.insert()` callers.

**Change:** Add `datetime(...)` wrapper to both:
```sql
DELETE FROM invite_codes WHERE datetime(expires_at) < datetime('now')
DELETE FROM user_sessions WHERE datetime(expires_at) < datetime('now')
```

(Refresh_tokens was already fixed in Batch 2.)

**Test:** Add a test that:
1. Inserts an expired ISO 8601 timestamp into each table
2. Calls the deleteExpired service
3. Verifies the row is deleted (current behavior: NOT deleted because
   string comparison fails)

## Commit Strategy

- **Commit 1:** F-026 README sync (docs only, no code change)
- **Commit 2:** RES-1 fix for both prepared statements + regression tests

## Verification (end of batch)

- `npm run lint` clean
- `npm run lint:eslint --max-warnings=0` clean
- `npm run test:critical` passing (target: 207 + ~3-5 new = ~210)
- `npm run build` succeeds

## After Batch 6

ALL audit findings closed + ALL carry-forward items addressed.
Cumulative state:
- 15 audit findings: 14 closed, 1 accepted risk (F-003 password length per user)
- 1 carry-forward (RES-1): closed
- 1 false alarm (F-015): documented as false alarm in closeout

Ready for promotion to main per develop-first rule (awaiting user approval).

## Reference

- Audit source: `C:\repo\audit\localattendance\SECURITY_RESIDUAL_RISK_REGISTER.md`
- Batches 1-5 closeouts: `docs/plans/2026-06-18-phase10-batch{1,2,3,4,5}-remediation-report.md`