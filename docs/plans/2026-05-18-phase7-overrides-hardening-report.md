# Phase 7 Report — Nested Overrides Hardening (Bun Compatibility)

Tanggal: 2026-05-18
Branch: develop
Status: COMPLETE
Gate Decision: GO (warning removed; Bun lane stable; npm compatibility restored)

## Objective
Menghilangkan warning Bun terkait nested overrides di `package.json` tanpa merusak stabilitas jalur CI ganda (npm + Bun) selama masa transisi.

## Scope
- Audit penggunaan nested overrides (`workbox-build -> glob/source-map`)
- Implement strategi kompatibel Bun
- Validasi lokal dan remote (GitHub Actions)
- Dokumentasi keputusan + rollback path

## Findings (Audit)
1. Sumber warning:
   - `package.json` memiliki nested overrides:
     - `overrides.workbox-build.glob = ^13.0.0`
     - `overrides.workbox-build.source-map = ^0.7.6`
   - Bun menampilkan warning: belum mendukung nested overrides.

2. Dependency reality:
   - `vite-plugin-pwa -> workbox-build` sudah menarik `glob@13` dan `source-map@0.7.6` pada graph Bun.
   - Jadi override nested itu bukan lagi mekanisme wajib untuk mencapai versi target saat ini.

3. Risiko transisi:
   - Menghapus overrides membuat `package-lock.json` perlu disinkronkan agar `npm ci` tetap valid di lane npm.

## Changes Implemented
1. Hapus blok nested overrides dari `package.json`.
2. Jalankan `bun install --frozen-lockfile`:
   - Tidak ada warning nested overrides lagi.
3. Sinkronisasi `package-lock.json` untuk lane npm:
   - `npm install --package-lock-only`
   - diikuti `npm install` (untuk resolusi lock yang konsisten lintas runner)
4. Commit & push:
   - `cfa1233` chore(bun): remove nested overrides incompatible with bun
   - `2ebb691` chore(npm-lock): sync package-lock after bun override hardening

## Validation Evidence
### Lokal (Bun lane)
- `bun install --frozen-lockfile` ✅ (no nested overrides warning)
- `bun run lint` ✅
- `bun run lint:eslint -- --max-warnings=0` ✅
- `bun run lint:docs` ✅
- `bun run test:critical` ✅ (35/35)
- `bun run build` ✅
- `actionlint` workflows ✅

### Remote (GitHub Actions)
- Initial push (`cfa1233`) sempat gagal di lane npm karena lockfile mismatch (expected, transisi lock):
  - CI: https://github.com/richiesamlie/LocalAttendace-Final/actions/runs/26012635834 (failure)
  - Security: https://github.com/richiesamlie/LocalAttendace-Final/actions/runs/26012635833 (failure on npm install)
- Setelah sync lock (`2ebb691`):
  - CI: https://github.com/richiesamlie/LocalAttendace-Final/actions/runs/26012739027 ✅ success
  - Security: https://github.com/richiesamlie/LocalAttendace-Final/actions/runs/26012739019 ✅ success
  - Bun blocking lane tetap hijau.

## Gate Decision
GO.
- Tujuan Phase 7 tercapai:
  - warning Bun nested overrides dihilangkan,
  - jalur Bun tetap stabil,
  - kompatibilitas npm lane dipulihkan via lockfile sync.

## Residual Notes
- Di Windows lokal, `npm ci` sempat gagal karena EPERM unlink `node_modules/.bin/tsx.exe` (file lock OS), bukan dependency graph issue.
- CI Linux telah membuktikan lockfile sinkron dan pipeline sehat.

## Rollback Plan
Jika nanti diperlukan rollback cepat:
1. Revert commit `2ebb691` + `cfa1233` di `develop`.
2. Push dan pastikan CI/security kembali hijau.
3. Evaluasi alternatif override kompatibel lintas manager sebelum re-introduksi.
