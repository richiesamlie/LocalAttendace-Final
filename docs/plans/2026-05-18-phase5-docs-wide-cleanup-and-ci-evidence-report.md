# Phase 5 Report — Docs-wide Cleanup & CI Evidence Readiness (develop)

Tanggal: 2026-05-18
Branch: develop
Status: COMPLETE
Gate Decision: CONDITIONAL GO to Phase 6 (promosi selective non-blocking -> blocking setelah evidence run Bun di develop)

## 1) Tujuan
1. Membersihkan dokumentasi operasional agar konsisten Bun-first.
2. Memisahkan dokumen historis/evidence agar tidak diubah (audit trail tetap utuh).
3. Menentukan kesiapan promosi gate Bun dari non-blocking ke blocking berdasarkan evidence CI nyata.

## 2) Scope Cleanup
### In-scope (diubah)
- `docs/architecture.md`
- `docs/developer-guide.md`
- `docs/dependency-governance.md`
- `docs/troubleshooting.md`
- `docs/user-guide.md`
- `docs/contributing.md`
- `docs/release-notes-template.md`

### Out-of-scope (dipertahankan sebagai historical evidence)
- `docs/plans/*`
- `docs/release-notes-develop-to-main-2026-05-13.md`

## 3) Perubahan yang Dilakukan
- Konversi command docs dari npm/npx ke Bun canonical:
  - `npm install` -> `bun install`
  - `npm run ...` -> `bun run ...`
  - `npx vitest ...` -> `bunx vitest ...`
  - `npx playwright ...` -> `bunx playwright ...`

## 4) Validasi Hasil
### A. Konten docs operasional
- Pencarian `npm run|npm install|npm ci|npx` pada file in-scope: **0 match** (bersih).
- Sisa match hanya pada dokumen historis (`docs/plans/*`, release notes historis), sesuai kebijakan audit trail.

### B. Validasi docs lint
- `bun run lint:docs` -> **PASS**
- Hasil: `Doc link check passed: 28 local links across 19 markdown files`.

### C. Ketersediaan evidence CI Bun
- `gh run list --branch develop` tersedia dan akses valid.
- Run historis CI/Security di develop tersedia, namun mayoritas merefleksikan state sebelum perubahan Phase 3–5.
- Kesimpulan: evidence monitoring tersedia, tetapi **belum ada 3 run Bun-parity terbaru pasca perubahan ini** karena perubahan masih lokal (belum push run baru).

## 5) Rekomendasi Selective Blocking (Phase 6)
Promosi bertahap berdasarkan evidence run di `develop`:
1. Tetap non-blocking untuk `bun-parity-smoke` dan `bun-security-smoke` sampai terkumpul minimal **3 run berturut-turut sukses**.
2. Jika 3 run sukses tercapai:
   - Naikkan `bun-parity-smoke` menjadi blocking terlebih dahulu.
   - Pertahankan `bun-security-smoke` non-blocking selama 1-2 siklus tambahan untuk observability.
3. Setelah stabil tambahan (tanpa failure regresi dependency/security):
   - Promosikan `bun-security-smoke` menjadi blocking.
4. Selama masa transisi, npm baseline blocking tetap dipertahankan sebagai rollback safety net.

## 6) Gate Decision
- **CONDITIONAL GO ke Phase 6**.
- Kondisi wajib: push ke `develop` + observasi minimal 3 run Bun sukses berurutan.

## 7) Next Exact Step
1. Push perubahan Phase 3–5 ke `develop`.
2. Monitor run:
   - `CI` (terutama `bun-parity-smoke`)
   - `Security Scan` (terutama `bun-security-smoke`)
3. Rekap 3 run berturut-turut (URL + SHA + conclusion).
4. Eksekusi promosi selective blocking sesuai rekomendasi di atas.
