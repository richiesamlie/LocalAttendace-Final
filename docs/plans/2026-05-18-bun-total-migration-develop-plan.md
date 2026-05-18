# Bun Total Migration Plan (Develop Branch) — Systemic & Structured

Status: Plan-only (belum eksekusi perubahan)
Branch target: develop
Repo: C:/repo

## A. Executive Summary
Tujuan: migrasi total dari npm ke Bun secara aman, terukur, dan reversible di branch develop.
Strategi: phased-gate migration dengan checkpoint, evidence wajib, dan rollback point per fase agar tidak gagal di tengah jalan.

## B. Scope Control
In scope:
1) Dependency/install flow pindah ke Bun
2) Script execution utama pindah ke Bun
3) CI + security workflow pindah ke Bun
4) Release workflow pindah ke Bun
5) Lockfile policy tunggal (bun.lock)

Out of scope (fase ini):
1) Refactor fitur produk yang tidak terkait toolchain
2) Optimasi arsitektur aplikasi non-migrasi
3) Perubahan besar API/DB yang bukan dampak migrasi

## C. Success Criteria (Hard)
Semua harus terpenuhi:
1) Bun menjadi default runner/package manager untuk dev + CI + release
2) Semua gate CI develop hijau 2 run berturut-turut
3) Security coverage tetap ada (tidak drop dari baseline)
4) Lockfile tunggal: bun.lock authoritative
5) Tidak ada blocker kritis selama stabilization window

## D. Failure Prevention Framework
1) Phase Gate: setiap fase punya Entry Criteria dan Exit Criteria
2) Small-batch change: perubahan dibatasi per workstream, bukan big-bang
3) Evidence-first: setiap klaim lulus wajib ada command output/log
4) Rollback-first design: sebelum phase start, rollback path harus jelas
5) Freeze rule: jika ada blocker severity high, stop phase dan lakukan triase

## E. Workstreams (Paralel Logis, Eksekusi Tetap Bertahap)
WS-1 Runtime/Dependency Compatibility
- Fokus: bun install, native module compatibility (better-sqlite3, dll)

WS-2 Script Compatibility
- Fokus: package.json scripts, node -e inline scripts, shell compatibility

WS-3 CI Migration
- Fokus: .github/workflows/ci.yml

WS-4 Security Pipeline Migration
- Fokus: .github/workflows/security.yml, audit equivalence

WS-5 Release & Docs Migration
- Fokus: .github/workflows/release.yml + README/docs

## F. Phase Plan (Entry/Exit/Gate/Rollback)

## Phase 0 — Baseline & Risk Discovery (Read-only)
Objective:
- Membuat baseline performa/fungsi/security sebelum perubahan.

Entry Criteria:
- Branch aktif: develop
- Working tree bersih atau perubahan non-konflik sudah diketahui

Actions (read-only):
1) Baseline command (3x run):
   - npm ci
   - npm run lint
   - npm run lint:eslint
   - npm run test:critical
   - npm run build
2) Dokumentasi durasi + hasil pass/fail
3) Inventory area risiko:
   - script inline node -e
   - powershell-specific branch
   - native dependencies
4) Bentuk Risk Register v1

Deliverables:
- Baseline report
- Risk register v1
- Acceptance threshold numerik

Exit Criteria:
- Baseline lengkap + risiko terpetakan

Rollback:
- N/A (read-only)

---

## Phase 1 — Bun Enablement (No CI Cutover)
Objective:
- Validasi Bun lokal tanpa ubah pipeline utama.

Files (planned):
- Create: bun.lock
- Modify (opsional): README.md (catatan trial)

Entry Criteria:
- Phase 0 selesai
- Risiko high sudah ada mitigasi awal

Actions:
1) Install/verify Bun
2) bun install (generate bun.lock)
3) Smoke via Bun:
   - bun run lint
   - bun run lint:eslint
   - bun run test:critical
   - bun run build
4) Catat incompatibility detail + workaround

Deliverables:
- bun.lock
- Compatibility report v1

Exit Criteria:
- >=95% command utama lolos via Bun
- Tidak ada blocker unresolved di dependency kritis

Rollback:
- Hapus bun.lock dan kembali ke npm baseline jika smoke gagal total

---

## Phase 2 — Script Hardening (Bun-native)
Objective:
- Menutup gap script agar konsisten lintas environment.

Files (planned):
- Modify: package.json
- Create/Modify: scripts/*.ts atau scripts/*.mjs
- Modify (opsional): docs/developer-guide.md, docs/troubleshooting.md

Entry Criteria:
- Phase 1 lulus

Actions:
1) Audit script hardcode node -e/powershell
2) Refactor script kompleks ke file terpisah
3) Standarkan semua command kritis lewat bun run
4) Re-test full local gate

Deliverables:
- Script compatibility matrix
- Updated command map

Exit Criteria:
- Semua script kritis pass
- Tidak ada regression fungsional utama

Rollback:
- Revert script batch terakhir (granular by commit)

---

## Phase 3 — CI Migration (Develop)
Objective:
- Pindahkan CI develop dari npm ke Bun.

Files (planned):
- Modify: .github/workflows/ci.yml

Entry Criteria:
- Phase 2 lulus
- Command lokal stabil di Bun

Actions:
1) Setup Bun di workflow
2) npm ci -> bun install --frozen-lockfile
3) npm run -> bun run
4) Validasi jobs: typecheck, docs-link-check, eslint, build, test-critical
5) Verifikasi 2 run hijau berurutan

Deliverables:
- CI parity report

Exit Criteria:
- CI develop stabil 2x green

Rollback:
- Revert workflow CI ke npm baseline

---

## Phase 4 — Security + Release Migration
Objective:
- Pindahkan security/release workflow dan jaga parity coverage.

Files (planned):
- Modify: .github/workflows/security.yml
- Modify: .github/workflows/release.yml

Entry Criteria:
- Phase 3 lulus

Actions:
1) Migrasi security pipeline ke Bun-compatible flow
2) Pastikan security signal tetap setara baseline
3) Migrasi release install/build ke Bun
4) Dry-run validasi release path

Deliverables:
- Security equivalence report
- Release dry-run report

Exit Criteria:
- Security coverage setara
- Release flow lolos dry-run

Rollback:
- Revert security/release workflow ke state pra-migrasi

---

## Phase 5 — Lockfile Cutover + Docs Finalization
Objective:
- Menetapkan Bun sebagai single source of truth.

Files (planned):
- Remove: package-lock.json
- Modify: README.md
- Modify: docs/developer-guide.md
- Modify (opsional): docs/dependency-governance.md, docs/troubleshooting.md

Entry Criteria:
- Phase 4 lulus

Actions:
1) Hapus package-lock.json
2) Tambah guard CI agar lockfile ganda gagal
3) Update dokumentasi onboarding/ops

Deliverables:
- Lockfile policy enforced
- Docs sync report

Exit Criteria:
- Semua gate pass tanpa npm lockfile

Rollback:
- Restore package-lock.json + rollback guard jika ada regress

---

## Phase 6 — Stabilization Window (1–2 minggu)
Objective:
- Membuktikan stabilitas sebelum promosi ke main.

Entry Criteria:
- Phase 5 lulus

Actions:
1) Monitor error CI, dev friction, runtime issues
2) Bandingkan metrik pre/post
3) Dokumentasikan known issues + mitigasi
4) Siapkan release notes develop -> main

Exit Criteria:
- Tidak ada blocker kritis
- Tim operasional stabil

Rollback:
- Jika ada issue kritis berulang: fallback ke phase sebelumnya terdekat

## G. Risk Register (Initial)
1) Native package incompatibility (better-sqlite3)
- Prevent: smoke test awal di Phase 1
- Detect: build/test failure signature
- Respond: pin version / rebuild strategy / tunda cutover

2) Script OS-specific breakage
- Prevent: refactor node -e ke file script
- Detect: lint/test/db command fail
- Respond: compatibility wrapper sementara

3) Security coverage menurun
- Prevent: equivalence criteria sebelum ubah security.yml
- Detect: missing vulnerability signal/artifact
- Respond: parallel-run sementara (old+new) sampai parity

4) CI cache/install instability
- Prevent: gunakan frozen lockfile dan cache key stabil
- Detect: flake install rate
- Respond: cache policy tune + retry policy terbatas

5) Half-migration drift (npm vs bun mixed)
- Prevent: phase gate ketat + lockfile policy
- Detect: CI/build inconsistency
- Respond: freeze merge, normalize workflow, rerun gate

## H. Decision Gates (Go/No-Go)
Gate 1 (setelah Phase 1):
- Go jika Bun smoke >=95% pass
- No-Go jika native blocker unresolved

Gate 2 (setelah Phase 3):
- Go jika CI develop 2x green
- No-Go jika job inti flakey/failed

Gate 3 (setelah Phase 4):
- Go jika security+release parity tercapai
- No-Go jika security signal drop atau release dry-run gagal

Gate 4 (setelah Phase 6):
- Go promote to main jika stabilization clean
- No-Go jika masih ada blocker berulang

## I. Evidence Template (Wajib per phase)
- Phase/Part:
- Branch:
- Files changed:
- Commands run:
- Results summary:
- Risks found:
- Mitigation applied:
- Next exact step:
- Safe resume from:
- Token checkpoint (user-reported):

## J. Commit Strategy (Saat Eksekusi Nanti)
- 1 phase = 1..n commit kecil, terkelompok per workstream
- Hindari commit campuran lintas fase
- Contoh:
  - chore(bun): add bun lockfile and local bun baseline
  - refactor(scripts): make scripts bun-compatible
  - ci(bun): migrate ci workflow to bun
  - ci(security): migrate security checks with parity
  - chore(lockfile): remove package-lock and enforce bun lock policy
  - docs: update bun migration operational guide

## K. Token Governance + Continuity
1) Checkpoint token tiap awal phase, tengah phase, akhir phase
2) Hard stop di 90% (no new implementation)
3) Wajib tulis handoff:
   - last completed part
   - in-progress part
   - remaining exact steps
   - files touched
   - safe resume pointer

## L. Final Approval Gate
Plan ini adalah blueprint eksekusi sistematis agar migrasi tidak gagal di tengah jalan.
Eksekusi dimulai dari Phase 0 setelah approval user perintah lanjut eksekusi.
