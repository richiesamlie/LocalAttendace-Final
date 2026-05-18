# Phase 4 Report — Release Workflow & Docs Consolidation (develop)

Tanggal: 2026-05-18
Branch: develop
Status: COMPLETE
Gate Decision: GO to Phase 5 (stabilization + gradual non-blocking -> blocking promotion policy)

## 1) Tujuan
Menyelesaikan konsolidasi release/docs agar default operasional selaras ke Bun, sambil menjaga rollback safety.

## 2) Perubahan yang Dilakukan

### A. Environment hardening (lokal)
- Menambahkan PATH permanen untuk binary user lokal:
  - File: `~/.bashrc`
  - Entry: `export PATH="$HOME/.local/bin:$PATH"`
- Verifikasi:
  - `command -v actionlint` -> `/c/Users/dewa5/.local/bin/actionlint`
  - `actionlint -version` -> `1.7.12`

### B. Release workflow migrasi npm -> Bun
- File: `.github/workflows/release.yml`
- Perubahan:
  - `actions/setup-node` -> `oven-sh/setup-bun@v2` (`bun-version: 1.3.14`)
  - Install dependencies: `bun install --frozen-lockfile`
  - Build: `bun run build`
  - Release body note diselaraskan: first run install via Bun

### C. Startup scripts konsolidasi Bun
- File: `start-app.bat`
  - Tambah precheck Bun di PATH
  - Install deps via `bun install --frozen-lockfile`
  - Debug: `bun run dev`
  - Production: `bun run build` + `bun run start`
- File: `start-app.sh`
  - Tambah precheck Bun
  - Install deps via `bun install --frozen-lockfile`
  - Debug/production command diganti ke `bun run ...`
- File: `start-internal-site.sh`
  - Tambah precheck Bun
  - Install deps via `bun install --frozen-lockfile`
  - Debug network: `bun run dev:network`
  - Production network: `bun run build` + `bun run start:network`

### D. README konsolidasi command Bun
- File: `README.md`
- Perubahan utama:
  - Prasyarat: npm -> Bun (Node tetap ada)
  - Install deps: `bun install`
  - Seluruh command operasional yang sebelumnya `npm run ...` diganti `bun run ...`

## 3) Validasi

### Workflow lint
- `actionlint .github/workflows/ci.yml .github/workflows/security.yml .github/workflows/release.yml`
- Hasil: PASS (no issue)

### Runtime parity suite (Bun)
- `bun run lint`
- `bun run lint:eslint -- --max-warnings=0`
- `bun run test:critical`
- `bun run build`
- Hasil: PASS semua command

### Konsistensi referensi npm di area yang diubah
- `start-app.bat`, `start-app.sh`, `start-internal-site.sh`, `release.yml`, `README.md`
- Hasil: tidak ada `npm`/`npx` tersisa pada area tersebut

## 4) Risk & Mitigasi
- Risk: sebagian dokumen lain di `docs/` masih memuat npm command (belum full sweep repo docs).
- Mitigasi:
  - Jadikan sebagai backlog Phase 5 docs-wide cleanup (targeted + terukur),
  - Tidak mengganggu jalur runtime/release utama yang sudah selaras Bun.

## 5) Gate Decision
- **GO ke Phase 5**
- Alasan:
  1. Release workflow Bun valid (actionlint pass)
  2. Startup paths utama (Windows/Linux/network) sudah Bun-first
  3. Quality gate utama Bun tetap hijau (lint/eslint/test/build)

## 6) Next Exact Step (Phase 5)
1. Jalankan docs-wide migration pass untuk file non-README (`docs/*.md`) secara bertahap.
2. Monitor run GitHub Actions di `develop` untuk job Bun non-blocking (ci/security) minimal 3 run stabil.
3. Siapkan proposal promosi selective blocking untuk Bun jobs berdasarkan evidence stabilitas run.
