# Phase 3 Report — CI/Security Transition Prep (develop)

Tanggal: 2026-05-18
Branch: develop
Status: COMPLETE
Gate Decision: GO to Phase 4 (release/workflow consolidation), dengan status Bun di CI/security masih observability mode (non-blocking).

## 1) Objective
Menambahkan jalur validasi Bun di GitHub Actions tanpa merusak baseline npm yang sudah stabil (rollback-safe, non big-bang).

## 2) Perubahan Workflow

## A. CI workflow (`.github/workflows/ci.yml`)
Ditambahkan job baru:
- `bun-parity-smoke`
  - trigger efektif di develop (`if: github.ref == 'refs/heads/develop'`)
  - `continue-on-error: true` (non-blocking)
  - setup Bun via `oven-sh/setup-bun@v2` (`bun-version: 1.3.14`)
  - install via `bun install --frozen-lockfile`
  - parity checks:
    - `bun run lint`
    - `bun run lint:eslint -- --max-warnings=0`
    - `bun run test:critical`
    - `bun run build`

Baseline npm CI tetap dipertahankan seluruhnya (typecheck/eslint/build/tests/coverage).

## B. Security workflow (`.github/workflows/security.yml`)
Perubahan trigger push:
- dari `branches: [ main ]`
- menjadi `branches: [ main, develop ]`

Ditambahkan job baru:
- `bun-security-smoke`
  - hanya develop (`if: github.ref == 'refs/heads/develop'`)
  - `continue-on-error: true`
  - setup Bun + `bun install --frozen-lockfile`
  - `bun audit --json > bun-audit.json || true`
  - upload artifact `bun-audit-report`

Job `dependency-audit` berbasis npm tetap dipertahankan sebagai baseline blocking (`npm audit --omit=dev --audit-level=high`).

## 3) Validation
Validasi yang dilakukan:
- Struktur YAML/workflow terbaca baik oleh patch lint internal (tidak ada syntax error terdeteksi saat edit).
- Verifikasi ketersediaan command:
  - `bun audit --help` sukses (opsi `--json` tersedia)
- Cek coupling hasil akhir workflow (npm + bun path coexist): terkonfirmasi.

Catatan tool:
- `actionlint` tidak terpasang di environment lokal ini, dan `bunx actionlint` tidak menyediakan executable langsung.
- Konsekuensi: validasi final runtime workflow perlu dikonfirmasi lewat GitHub Actions run setelah push.

## 4) Risk Posture
Risk level: LOW-MEDIUM (terkontrol)

Alasan:
- Jalur Bun ditambahkan sebagai observability (non-blocking), sehingga tidak mematahkan gate existing.
- Baseline npm CI/security tetap aktif penuh sebagai rollback path.
- Perubahan menyentuh workflow saja (tidak mengubah logic aplikasi).

Risiko tersisa:
1. Hasil Bun audit bisa berbeda mapping severity dibanding npm audit.
2. Nested overrides warning Bun (teridentifikasi di Phase 1) belum dibereskan permanen.
3. Karena belum ada local actionlint, ada residual risk typo semantic workflow yang baru terlihat saat run GitHub.

## 5) Gate Decision
GO ke Phase 4, dengan prasyarat operasional:
1) Push branch develop dan observasi minimal 1 run CI + 1 run Security yang memuat job Bun baru.
2) Kumpulkan artifact `bun-audit-report` untuk baseline security comparison.
3) Jika Bun smoke stabil beberapa run, baru pertimbangkan promosi dari non-blocking -> blocking bertahap.

## 6) Files Changed in Phase 3
- `.github/workflows/ci.yml` (modified)
- `.github/workflows/security.yml` (modified)
- `docs/plans/2026-05-18-phase3-ci-security-transition-report.md` (new)

## 7) Safe Resume Pointer
Safe Resume From: Phase 4 — Release workflow consolidation + documentation alignment + trial promotion policy (non-blocking -> conditional blocking)
