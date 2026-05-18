# Phase 2 Report — Script Adaptation & Compatibility Hardening (develop)

Tanggal: 2026-05-18
Branch: develop
Status: COMPLETE
Gate Decision: GO to Phase 3 (CI/Security migration prep)

## 1) Tujuan Phase 2
Mereduksi script yang terlalu npm/node-inline/shell-branching agar command lebih Bun-canonical tanpa mengubah behavior operasional.

## 2) Perubahan yang Dilakukan
### A. Tambah helper runner lintas platform
File baru:
- scripts/exec-by-platform.mjs

Fungsi:
- Menjalankan `<name>.ps1` di Windows via powershell
- Menjalankan `<name>.sh` di non-Windows via bash
- Meneruskan argumen (`--force`, `--backup`) dengan translasi otomatis ke PowerShell switches (`-Force`, `-Backup`)

### B. Refactor scripts di package.json
Sebelum:
- `kill` dan beberapa `db:clean*` menggunakan `node -e` inline + branching command string

Sesudah:
- `kill`: `bun scripts/exec-by-platform.mjs kill-server`
- `db:clean`: `bun scripts/exec-by-platform.mjs clean-db`
- `db:clean:force`: `bun scripts/exec-by-platform.mjs clean-db --force`
- `db:clean:backup`: `bun scripts/exec-by-platform.mjs clean-db --backup`

Catatan:
- `db:backup` sengaja belum disentuh agar perubahan tetap minimal-risk pada phase ini.
- Script docker tetap `docker-compose` (akan dipertimbangkan pada phase berikut jika perlu normalisasi `docker compose`).

## 3) Validasi & Evidence
Log utama:
- docs/plans/2026-05-18-phase2-script-adaptation.log

Run awal:
- bun run lint: PASS
- bun run lint:eslint: FAIL (12 no-undef errors pada file baru `scripts/exec-by-platform.mjs` terkait `process`/`console`)
- bun run lint:docs: PASS
- bun run test:critical: PASS
- bun run build: PASS

Perbaikan:
- Ubah referensi ke `globalThis.process` / `globalThis.console` melalui alias `proc`/`log` di helper script

Re-run setelah fix:
- bun run lint:eslint: PASS
- bun run test:critical: PASS
- bun run build: PASS

Kesimpulan validasi:
- Tidak ada regresi fungsional pada lint/test/build setelah adaptasi script.

## 4) Risiko & Mitigasi
Risiko yang tersisa:
1) Nested overrides warning Bun (dari Phase 1) masih belum diselesaikan
2) Security pipeline masih npm-centric (`npm audit`) dan belum ada Bun-equivalent policy
3) CI workflow masih dominan `npm ci` + cache npm

Mitigasi berikutnya (Phase 3):
- Evaluasi opsi audit/security parity untuk Bun flow
- Siapkan CI matrix/step transisi yang tetap rollback-ready
- Jaga dual-path sementara sampai gate hijau stabil

## 5) Gate Decision
GO ke Phase 3.
Alasan:
- Tujuan Phase 2 tercapai
- Semua quality gate lokal penting (lint/eslint/docs/test/build) lulus pasca-fix
- Adaptasi script berhasil menurunkan kompleksitas inline shell branching

## 6) Safe Resume Pointer
Safe Resume From: Phase 3 — CI/Security Migration Preparation

## 7) File yang Berubah (Phase 2)
- package.json (modified)
- scripts/exec-by-platform.mjs (new)
- docs/plans/2026-05-18-phase2-script-adaptation.log (new)
- docs/plans/2026-05-18-phase2-script-adaptation-report.md (new)
