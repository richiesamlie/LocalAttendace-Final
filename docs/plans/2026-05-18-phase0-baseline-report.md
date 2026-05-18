# Phase 0 Report — Baseline & Risk Discovery (Bun Total Migration)

Date: 2026-05-18
Branch: develop
Repo: C:/repo
Plan Ref: docs/plans/2026-05-18-bun-total-migration-develop-plan.md

## 1) Scope Phase 0
Tujuan fase ini: baseline terukur + risk discovery sebelum perubahan migrasi Bun.

Dikerjakan:
- Baseline command npm dijalankan 3x
- Capture pass/fail + durasi
- Identifikasi coupling/risiko di package scripts dan GitHub workflows

Evidence log:
- docs/plans/2026-05-18-phase0-baseline.log

## 2) Baseline Results (3 Iterations)
Semua command lulus (exit=0 di seluruh iterasi).

| Command | Run-1 (s) | Run-2 (s) | Run-3 (s) | Avg (s) | Min | Max | Pass Rate |
|---|---:|---:|---:|---:|---:|---:|---:|
| npm ci | 45 | 49 | 49 | 47.67 | 45 | 49 | 3/3 |
| npm run lint | 11 | 11 | 10 | 10.67 | 10 | 11 | 3/3 |
| npm run lint:eslint | 14 | 16 | 11 | 13.67 | 11 | 16 | 3/3 |
| npm run test:critical | 8 | 8 | 7 | 7.67 | 7 | 8 | 3/3 |
| npm run build | 20 | 21 | 18 | 19.67 | 18 | 21 | 3/3 |

Observasi penting dari baseline:
1) npm install menampilkan beberapa deprecated dependency warning (non-blocking saat ini).
2) build menampilkan chunk size warning (>500kB) (non-blocking, existing condition).
3) test:critical menulis backup DB ke C:\repo\backups\db-YYYY-MM-DD.sqlite (side effect normal dari test suite).

## 3) Coupling & Risk Discovery

## 3.1 Script-level coupling (package.json)
Temuan risk-prone scripts:
- node -e wrapper + powershell branch:
  - kill
  - db:backup
  - db:clean
  - db:clean:force
  - db:clean:backup
- docker-compose command family:
  - docker:up/down/logs/build

Implikasi:
- Script saat ini Node/npm-first dan sebagian OS-specific; ini titik rawan saat cutover Bun.

## 3.2 CI/Security coupling
Temuan workflow coupling tinggi ke npm:
- .github/workflows/ci.yml:
  - setup-node + cache: npm + npm ci
  - npm run lint/docs/eslint/build/test/test:coverage
- .github/workflows/security.yml:
  - npm ci
  - npm audit blocking + artifact npm-audit.json
- .github/workflows/release.yml:
  - npm install flow + npm run build

Implikasi:
- Migrasi CI/security/release harus dipisah bertahap + parity check, tidak boleh big-bang.

## 3.3 Dependency-level hotspot
- better-sqlite3 (native module) => kategori high-risk compatibility saat pindah package manager/runtime install path.

## 4) Initial Risk Register (v1)

| ID | Risiko | Severity | Probability | Mitigasi awal | Trigger Stop |
|---|---|---|---|---|---|
| R1 | Native module incompatibility (better-sqlite3) | High | Medium | Uji Bun smoke awal + lock version strategy | test/build native fail berulang |
| R2 | Script OS-specific gagal saat bun run | High | Medium | Refactor node -e ke script file terpisah | command kritis gagal |
| R3 | Security parity turun saat ganti npm audit | High | Medium | Definisikan equivalent security gate sebelum cutover | missing vulnerability signal |
| R4 | CI instability saat cache/install bun | Medium | Medium | frozen lockfile + sequential rollout | CI flake > threshold |
| R5 | Half-migration drift (npm vs bun mixed) | Medium | Medium | lockfile policy + phase gate ketat | inconsistent local vs CI |

## 5) Acceptance Thresholds (untuk lanjut fase)

Gate ke Phase 1 (Bun Enablement):
1) Phase 0 baseline lengkap dan terdokumentasi ✅
2) Risk register v1 tersedia ✅
3) Rencana mitigasi untuk risiko High disiapkan sebelum cutover ✅

Gate ke Phase 2 (setelah nanti Phase 1):
- Bun smoke command pass >=95% (lint/eslint/test:critical/build)
- Tidak ada blocker native unresolved

Gate ke Phase 3 (CI migration):
- Script compatibility matrix lulus untuk command kritis

## 6) Phase 0 Gate Decision
Decision: GO to Phase 1 (dengan guardrail ketat)

Alasan:
- Baseline stabil (semua pass 3/3)
- Risiko utama sudah teridentifikasi jelas
- Titik coupling yang perlu diprioritaskan sudah lengkap

## 7) Next Exact Step (Phase 1)
1) Verifikasi Bun tersedia (`bun --version`)
2) Jalankan `bun install` untuk generate bun.lock
3) Jalankan smoke test Bun:
   - bun run lint
   - bun run lint:eslint
   - bun run test:critical
   - bun run build
4) Catat delta hasil vs baseline npm

Safe Resume From: Phase 1 / Step 1 (Bun availability check)

## 8) Token/Continuity Note
Token checkpoint: pending user-reported value (tooling tidak expose usage % langsung di sesi ini).
