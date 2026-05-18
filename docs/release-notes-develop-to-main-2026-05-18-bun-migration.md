# Release Notes — Develop to Main (2026-05-18)

## Summary
Promosi branch `develop` ke `main` untuk menutup migrasi bertahap npm -> Bun.

## Included Changes
1. Runtime & script migration ke Bun
   - Startup scripts beralih ke Bun (`start-app.bat`, `start-app.sh`, `start-internal-site.sh`)
   - Wrapper lintas platform untuk skrip operasi (`scripts/exec-by-platform.mjs`)
   - `bun.lock` menjadi lockfile utama jalur Bun

2. CI/Security hardening
   - Bun parity lane di CI develop dipromosikan menjadi blocking
   - Bun security smoke dipromosikan menjadi blocking
   - Bun audit kini blocking pada severity high (`bun audit --audit-level=high`)
   - Artefak audit JSON tetap dipertahankan untuk diagnostik (non-blocking artifact step)

3. Release pipeline + docs konsolidasi
   - Workflow release menggunakan setup Bun dan build Bun
   - README + docs operasional dikonsolidasikan ke command Bun-first
   - Historical evidence docs (`docs/plans/*`) dipertahankan sebagai jejak audit

4. Bun compatibility hardening
   - Nested overrides yang tidak kompatibel Bun dihapus dari `package.json`
   - `package-lock.json` disinkronkan ulang agar lane npm CI tetap sehat selama transisi

## Validation Evidence
- Develop CI/Security pasca-fix stabil sukses beruntun
- Bun blocking lanes tervalidasi hijau pada run develop terbaru

## Risk Notes
- Risiko yang tersisa bersifat operasional standar (bukan blocker):
  - monitor stabilitas run main pasca-promote
  - observasi tren audit/security secara berkala

## Rollback Plan (Ringkas)
1. Revert commit promosi workflow blocking Bun jika ada regresi kritis di main.
2. Kembalikan lane terkait ke observability mode (non-blocking) sementara.
3. Jalankan ulang CI/Security, lakukan patch minimal, lalu promosi ulang bertahap.
