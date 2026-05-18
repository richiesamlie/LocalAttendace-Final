# Phase 6 Report — Selective Blocking Promotion (develop)

Tanggal: 2026-05-18
Branch: develop
Status: COMPLETE
Gate Decision: GO (Bun lanes promoted to blocking on develop)

## Objective
Menutup loop transisi Bun dari observability-only (non-blocking) menjadi selective blocking di `develop`, berbasis bukti run CI/Security nyata dan berurutan.

## Scope
1. Menyusun commit terstruktur per domain perubahan.
2. Push ke `origin/develop`.
3. Mengumpulkan bukti 3 run sukses beruntun untuk lane Bun pada workflow CI dan Security.
4. Promosi lane Bun develop dari non-blocking -> blocking.
5. Verifikasi pasca-promosi.

## Structured Commits (develop)
1. `81300a3` — `chore(bun): standardize runtime scripts and lockfile`
   - `bun.lock`
   - `scripts/exec-by-platform.mjs`
   - `package.json`
   - `start-app.bat`
   - `start-app.sh`
   - `start-internal-site.sh`

2. `4b1c046` — `ci(bun): add bun observability lanes and release build path`
   - `.github/workflows/ci.yml`
   - `.github/workflows/security.yml`
   - `.github/workflows/release.yml`

3. `5e7bab7` — `docs(bun): consolidate operational guides to bun-first commands`
   - `README.md`
   - `docs/*.md` (operational docs)
   - `docs/plans/*.md` (phase evidence reports)

4. Evidence trigger commits:
   - `75f4269` — run #2 trigger
   - `f1f5a5e` — run #3 trigger

5. Promosi selective blocking:
   - `11a19a4` — `ci(bun): promote develop bun lanes to blocking`
   - Ubah di workflow:
     - `CI / bun-parity-smoke`: `continue-on-error: true -> false`
     - `Security / bun-security-smoke`: `continue-on-error: true -> false`
     - Job name diperbarui menjadi `(develop, blocking)`.

## Evidence (3 consecutive successful runs)
### Cycle 1 (SHA `5e7bab7`)
- CI: https://github.com/richiesamlie/LocalAttendace-Final/actions/runs/26012045227
  - Bun job sukses: `Bun Parity Smoke (develop, non-blocking)`
- Security: https://github.com/richiesamlie/LocalAttendace-Final/actions/runs/26012045212
  - Bun job sukses: `Bun Security Smoke (develop, non-blocking)`

### Cycle 2 (SHA `75f4269`)
- CI: https://github.com/richiesamlie/LocalAttendace-Final/actions/runs/26012087838
  - Bun job sukses
- Security: https://github.com/richiesamlie/LocalAttendace-Final/actions/runs/26012087827
  - Bun job sukses

### Cycle 3 (SHA `f1f5a5e`)
- CI: https://github.com/richiesamlie/LocalAttendace-Final/actions/runs/26012131426
  - Bun job sukses
- Security: https://github.com/richiesamlie/LocalAttendace-Final/actions/runs/26012131430
  - Bun job sukses

## Post-promotion Verification (blocking mode)
### SHA `11a19a4`
- CI (blocking Bun): https://github.com/richiesamlie/LocalAttendace-Final/actions/runs/26012216317
  - `Bun Parity Smoke (develop, blocking)` = success
- Security (blocking Bun): https://github.com/richiesamlie/LocalAttendace-Final/actions/runs/26012216324
  - `Bun Security Smoke (develop, blocking)` = success

## Validation Performed
- Local workflow lint:
  - `actionlint .github/workflows/ci.yml .github/workflows/security.yml .github/workflows/release.yml` -> PASS
- Local Bun gate (sebelum push fase ini): lint/eslint/docs/test:critical/build -> PASS

## Risk & Rollback
- Risiko saat ini: rendah-menengah (lane Bun develop sudah blocking, main tetap konservatif).
- Rollback cepat bila diperlukan:
  1. Revert commit `11a19a4`, atau
  2. Set kembali `continue-on-error: true` pada dua job Bun develop.
- Baseline npm lane tetap aktif sebagai safety net selama transisi lanjut.

## Decision
Status Phase 6: **COMPLETE**.
Selective promotion non-blocking -> blocking untuk lane Bun di `develop` **berhasil** dengan evidence run nyata.

## Next Step Pointer (Phase 7)
1. Monitor minimal 3-5 hari run develop untuk stabilitas blocking Bun lane.
2. Jika stabil, siapkan proposal promosi bertahap ke `main` (tetap gated dan explicit approval).
3. Evaluasi apakah `dependency-audit` npm dan Bun akan dipertahankan paralel atau dikonsolidasi sebagian setelah periode observasi.
