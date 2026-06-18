# Release Notes — Develop → Main: Audit Remediation Batch 1

**Tanggal promosi:** 2026-06-18 (planned)
**Branch:** `develop` → `main` (pending approval)
**Scope:** 5 Critical/High audit findings fixed + gitignore hygiene

## Ringkasan Singkat (Bahasa Indonesia)

Lima temuan audit **Critical/High** dari security audit
(`docs/audit/SECURITY_AUDIT_REPORT.md`) telah diperbaiki di branch
`develop`. Perubahan inti:

1. **Socket.IO sekarang wajib JWT auth** — sebelumnya siapa saja bisa
   konek ke `/ws/socket.io` dan menerima update real-time untuk kelas
   manapun (leakage data siswa).
2. **5 HIGH CVE di dependency produksi sudah fixed** — `ws` 8.20.1 → 8.21.0
   menutup memory exhaustion DoS, plus override pin agar Bun dan npm
   lockfile seragam.
3. **CI gate audit sekarang lebih terlihat** — failure langsung muncul
   di Actions summary dengan langkah remediasi.
4. **Release zip tidak lagi menyertakan file sensitif** — `.env`, logs,
   backups, dsb.
5. **JWT verify dipin ke HS256** — defense-in-depth terhadap alg-confusion.

## Changes Detail

| File | Change |
|------|--------|
| `src/routes/middleware.ts` | + `parseAuthTokenCookie`, `verifySocketAuth`, `SocketAuthContext`; pin `algorithms: ['HS256']` on 3 `jwt.verify` callsites |
| `src/routes/auth.routes.ts` | pin `algorithms: ['HS256']` on logout's `jwt.verify` |
| `server.ts` | + `io.use()` JWT middleware; `join_class` now checks class membership |
| `src/test/security/auth.socket.security.test.ts` | NEW — 16 security tests for Socket.IO auth |
| `package.json` | + `overrides` + `resolutions` pinning `ws ^8.21.0`; + new test in `test:critical` |
| `package-lock.json` | ws 8.20.1 → 8.21.0; engine.io 6.6.8 → 6.6.9; express 4.21.2 → 4.22.1 |
| `bun.lock` | ws updated to 8.21.0 (matches npm) |
| `.github/workflows/security.yml` | + `if: failure()` summary steps for both audit jobs |
| `.github/workflows/release.yml` | + zip exclusions: `.env*`, logs, backups, coverage, test-results, spikes, `.github` |
| `.gitignore` | + `audit/` exclusion |
| `docs/plans/2026-06-18-phase10-batch1-remediation-plan.md` | NEW |
| `docs/plans/2026-06-18-phase10-batch1-remediation-report.md` | NEW |

## Security Impact

| Risk Class | Before | After |
|------------|--------|-------|
| A01 Broken Access Control (Socket.IO snoop) | 🔴 Anyone | 🟢 JWT-gated + per-class RBAC |
| A06 Vulnerable Components (HIGH CVEs) | 5 | 0 |
| A02 Algorithm Confusion (jwt.verify) | ⚠️ implicit HS256 | 🟢 explicit HS256 |
| A05 Misconfig (release zip leaks) | ⚠️ .env could leak | 🟢 excluded |
| A05 Misconfig (CI gate silent failure) | ⚠️ invisible | 🟢 surfaced in summary |

## Test Evidence

- `npm run lint` → ✅ exit 0
- `npm run lint:eslint -- --max-warnings=0` → ✅ exit 0
- `npm run test:critical` → ✅ 52/52 passed (8 files; was 36/36 in 7 files)
- `npm run build` → ✅ vite + PWA built
- `npm audit --omit=dev --audit-level=high` → ✅ 0 HIGH (was 5)

## Commit Trail (develop, newest first)

```
18d4e2a fix(socket): add JWT handshake auth + per-room access check (F-001)
d757d03 fix(deps): resolve 5 HIGH npm-audit CVEs via npm audit fix + ws override (F-013)
6e8b3d2 fix(ci): make dependency audit gate failures visible (F-014)
38e361b fix(release): exclude sensitive files from release zip (F-019)
b6cc4d1 fix(security): pin HS256 algorithm in jwt.verify callsites (F-021)
654fd88 chore(gitignore): exclude audit/ workdir
452d7a0 docs(plans): add phase 10 batch 1 remediation plan
```

## Known Residual (carried to Batch 2-6)

- **2 moderate CVEs** from `exceljs` pulling vulnerable `uuid`. Only fix
  is breaking downgrade to `exceljs 3.4.0` — requires code review of
  `src/utils/excel.ts`. Recommend separate PR.
- **15 medium-priority findings** (F-002 through F-028 minus the 5 fixed
  here) — see `SECURITY_RESIDUAL_RISK_REGISTER.md` for full list and
  remediation targets.

## Promotion Criteria Met

- [x] All 5 Batch 1 findings fixed
- [x] Test count increased (36 → 52)
- [x] No HIGH CVEs in prod deps
- [x] Backward-compatible (no existing API changes; only additions)
- [x] Build succeeds (vite + PWA)
- [x] All work on `develop` per develop-first policy
- [ ] **AWAITING user approval before develop → main promotion**

## How To Promote

Once approved:

```bash
# 1. Add the release-notes file to develop (or directly to main at promotion)
git checkout develop
git add docs/release-notes-develop-to-main-2026-06-18-audit-remediation-batch1.md
git commit -m "docs(release): add audit remediation batch 1 release notes"

# 2. Merge to main
git checkout main
git merge --no-ff develop -m "Merge develop: audit remediation batch 1"

# 3. Push (requires user approval)
git push origin main
```