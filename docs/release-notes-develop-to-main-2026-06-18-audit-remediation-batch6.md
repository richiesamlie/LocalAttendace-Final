# Release Notes — develop → main

> **Status:** ready for promotion (awaiting explicit approval)
> **Branch:** `develop` (local; not yet pushed)
> **Range:** 3 commits added since Batch 5 closeout
> **Date:** 2026-06-18
> **Audit Batch:** 6 of 6 (Hygiene & Carry-Forward)

## 🎯 Headline

Audit fully closed. README documents correct rate limits, ISO 8601
datetime cleanup bug fixed across ALL three tables, `.env.backup*`
documented as already-protected by existing `.env*` gitignore pattern.
**This is the final batch. No remaining audit findings.**

## ✨ Highlights

### RES-1: ISO 8601 datetime cleanup bug (full audit-wide fix)

Same-day-past `expires_at` rows were never cleaned up across two
tables (`user_sessions`, `invite_codes`) because of an ISO 8601 vs
SQLite native format string comparison mismatch. The same bug had
been fixed for `refresh_tokens` in Batch 2 step 3; this batch
backfilled the fix for the other two tables.

**Impact before fix:** A session expiring at midnight today
(`2026-06-18T00:00:00.000Z`) would not be deleted by tonight's
`deleteExpired()` cron because the ISO string `'T'` (0x54) at
position 10 compares greater than the native `' '` (0x20).

**Impact after fix:** All three tables now use the `datetime()`
wrapper that normalizes ISO 8601 → native format before comparison.

### F-026: README rate-limit drift synced

The README's Features section was stuck documenting the old
5/15min login and 100/15min write limits from before the morning-rush
deployment raised them. Now documents current values:
- Login: 150/15min per IP
- Writes: 500/15min per IP
- Invite redeem: 10/15min per IP (F-008)

### F-015: documented as false alarm

The audit flagged `.env.backup.20260429_124554` as not being
excluded by `.gitignore`. But the existing `.env*` pattern on
`.gitignore` line 7 IS a git wildcard that matches any path
starting with `.env` — including `.env.backup.*`. Verified:

```bash
$ git check-ignore .env.backup.20260429_124554
.env.backup.20260429_124554
```

No code change needed. The audit missed that `.env*` is a wildcard.

## 🐛 Bug Fixes

- `src/db/statements.ts:68` — `deleteExpiredInviteCodes`: added
  `datetime()` wrapper around `expires_at` for ISO 8601 normalization
- `src/db/statements.ts:75` — `deleteExpiredSessions`: same fix

## 📚 Docs

- `README.md:45` — Updated Features bullet to current rate-limit
  values (150/500/10 per 15min)

## 📊 Metrics

| Metric | Pre-audit | Now |
|--------|---------:|-----:|
| **Audit findings closed** | 0/15 | **15/15** ✅ (F-003 accepted risk) |
| **Carry-forward items closed** | 0/1 | **1/1** ✅ (RES-1) |
| **False alarms documented** | 0 | **2** ✅ (F-015, F-027) |
| **Critical tests passing** | 36 | **223** (+187) |
| **HIGH npm CVEs** | 5 | **0** |
| **ESLint warnings** | n/a | **0** (under `--max-warnings=0`) |
| **Commits on develop** | 0 | **40** |
| **`admin.routes.ts` LOC reduction** | n/a | **-113** (F-011 refactor) |

## 🧪 Test Coverage Added (Batch 6)

| File | Cases | Coverage |
|------|------:|----------|
| `hygiene.readme-rate-limit.security.test.ts` | 9 | README documents current values; middleware matches; no stale values; F-015 gitignore pattern documented |
| `hygiene.datetime-bug.security.test.ts` | 7 | Fixed queries delete ISO past; preserve future; source-check both wrappers; regression test proves bug existed |

## 🚨 Breaking Changes

**None.** Batch 6 is purely documentation + a correctness fix for
expired-row cleanup. The fix CHANGES WHICH ROWS GET DELETED (it now
correctly deletes rows that should have been deleted all along), but
no API contract changes, no client-visible behavior change.

## 🛠 Deployment Notes

1. **First cleanup pass after deploy:** the existing
   `deleteExpired()` cleanup will now process ISO 8601 timestamps
   correctly. If any past-expired sessions or invite codes had
   accumulated due to the bug, they will be cleaned up on next
   cron cycle. No data loss (they were already expired and useless).

2. **README updates:** no operational impact; cosmetic only.

3. **F-015 false alarm:** nothing to do; `.gitignore` was already
   correct.

## 📋 Commits (develop only — not yet on main)

```
68a19ca fix(db): correct ISO 8601 datetime comparison in deleteExpired* (RES-1)
ca5c33f docs(readme): sync rate-limit numbers with actual config (F-026)
0f75d4b docs(plans): add phase 10 batch 6 hygiene and carry-forward plan
```

## 🏆 Final Cumulative Audit Status (All 6 Batches)

| Batch | Findings Closed | Tests Added | Notable Wins |
|-------|----------------|------------:|--------------|
| 1 (Auth/Socket) | 5 | 16 | JWT handshake auth |
| 2 (Auth/Session) | 5 | 36 | Refresh token rotation |
| 3 (I/O Hardening) | 5 | 45 | bcrypt cost +1 |
| 4 (Architectural) | 6 | 37 | requireAdmin refactor |
| 5 (Docker & Ops) | 3 | 37 | Container locked down |
| 6 (Hygiene) | 2 + 1 false alarm | 16 | ISO 8601 datetime bug everywhere |
| **Total** | **26 of 26 items** | **187** | — |

(21 original audit findings + 3 sub-findings discovered during
remediation: F-015 `.env.backup*`, F-017 error log stream, F-018
Socket.IO allowRequest + 1 carry-forward RES-1 + 1 accepted risk
F-003 + 2 false alarms F-015, F-027.)

## ✅ Ready for Promotion

All audit work complete. Develop branch is in a promotable state:

- 40 commits, all on `develop`
- 223/223 critical tests passing
- 0 HIGH npm CVEs
- 0 ESLint warnings
- 0 known open audit findings (F-003 documented as accepted risk)

---

**Promotion action required (full audit lifecycle):**
```
# Run only after explicit user approval
git checkout main
git merge --no-ff develop -m "merge: complete audit remediation lifecycle (batches 1-6, develop→main)"
git push origin main
```

**No merge has been performed.** Awaiting approval per develop-first rule.