# Release Notes (Develop -> Main)

## Release Summary
- Release date: 2026-05-13
- Commit range: e581830..8f52be8
- Release owner: dewa5

## Highlights
- Feature:
  - Konfigurasi path SQLite kini mendukung env override `DB_FILE` (`src/db/connection.ts`).
- Fix:
  - Sinkronisasi route contract server-client untuk mutasi event/timetable:
    - `PUT /api/events/:id`, `DELETE /api/events/:id`
    - `PUT /api/timetable/:id`, `DELETE /api/timetable/:id`
  - Perketat auth di endpoint mutasi student/event/timetable agar eksplisit membutuhkan sesi valid.
  - `GET /api/auth/verify` kini wajib auth middleware.
- Docs:
  - Update `docs/api-reference.md` untuk:
    - requirement auth pada `/auth/verify`
    - format restore admin (`application/octet-stream`), batas 25MB, dan error codes
    - restriction query profiling (single `SELECT` only)
  - Update `README.md` untuk dokumentasi `DB_FILE` dan path persistence di Docker.
- CI/CD:
  - Penyesuaian runtime container: `DB_FILE=/app/data/database.sqlite` pada Dockerfile dan docker-compose.
  - Healthcheck container distandarkan ke `/api/health`.
- Security:
  - Hardening middleware RBAC (`requireClassAccess`, `requireClassOwner`, `requireRole`) dengan 401 jika context auth tidak ada.
  - Hardening admin restore endpoint (content-type validation, payload size limit, stream error handling).
  - Hardening admin profiling endpoint (reject non-SELECT/multi-statement SQL).

## Breaking Change Risk
- [x] Tidak ada breaking change
- [ ] Ada potensi breaking change (jelaskan):

## Dependency Changes
- Package yang diupdate:
  - Tidak ada perubahan dependency pada release ini.
- Alasan update:
  - N/A
- Dampak potensial:
  - N/A

## Validation Evidence
- [x] `npm run lint` pass
- [x] `npm run lint:eslint` pass
- [x] `npm test` pass
- [ ] CI pass
- [x] Security Scan pass (`npm audit --omit=dev --audit-level=high`)

Detail verifikasi lokal (2026-05-15):
- `npm run lint` → pass
- `npm run lint:eslint` → pass
- `npm test` → 20 files passed, 317 tests passed, 0 failed
- `npm audit --omit=dev --audit-level=high` → found 0 vulnerabilities

## Rollback Plan
- Revert commit utama jika issue kritikal muncul:
  - `git revert 8f52be8`
- Target waktu rollback: < 30 menit setelah issue kritikal terkonfirmasi
- PIC rollback: dewa5

## Post-Release Check
- [ ] Smoke test login
- [ ] Smoke test attendance flow
- [ ] Smoke test admin/settings
- [ ] Tidak ada error kritis di log
