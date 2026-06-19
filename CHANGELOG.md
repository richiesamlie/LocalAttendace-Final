# Changelog

All notable changes to this project documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [Semantic Versioning](https://semver.org/).

## [2.0.0] — 2026-06-19

### Breaking changes

- **Removed admin debug tooling**: `PerformanceMonitor`, `QueryProfiler`, `ResourceMonitor` UI components + their backend (`metricsStore`, `resourceMonitor`, `db/profiling`). 10 admin endpoints removed: `/admin/metrics`, `/admin/metrics/summary`, `DELETE /admin/metrics`, `/admin/profiling/query`, `/admin/profiling/statements`, `/admin/profiling/indexes`, `/admin/profiling/stats`, `/admin/resources`, `/admin/resources/history`, `/admin/resources/alerts`. Single-school attendance app has no production users of runtime EXPLAIN UI. Admin settings + database backup/restore endpoints unchanged.
- **Removed 4 unused runtime deps**: `recharts`, `motion`, `react-window`, `react-virtualized-auto-sizer`. Zero importers across `src/`. Both `package-lock.json` and `bun.lock` regenerated.
- **Removed setup-script sprawl**: dropped `.ps1` wrappers (`clean-db.ps1`, `kill-server.ps1`), `start-internal-site.{sh,bat}` (duplicates start-app), `setup-windows-startup.bat` (YAGNI), `scripts/setup-postgres.{ts,sh,bat}` + `src/repositories/migrate.ts` (one-shot; server auto-detects `DATABASE_URL`), `scripts/exec-by-platform.mjs` wrapper. `setup-env.ps1` retained (release.yml step 3 for Windows admin post-extract setup). 6 package.json scripts removed.
- **Removed dead files**: `verify-perf-config.ts`, `src/services/index.ts`, `.eslintrc.json` (legacy config shadowed by flat config), `src/db/cache.ts` (homemade TTL cache; React Query already caches).
- **Trimmed `src/hooks/useData.ts`**: 394 → 130 LOC. Kept only `useAuth`, `useLogin`, `useLogout`, `useClassSync` + `queryKeys` (the only consumers). 30+ dead mutation/query hooks removed.
- **Slimmed `src/middleware/performance.ts`**: 211 → 60 LOC. Kept the `performanceMonitor` middleware (used by server.ts as request logger). Dropped `metricsStore` calls, `monitorQuery` export, `performanceConfig` export.

### What stays (deliberately NOT touched)

- JWT (HS256 pinned) + refresh token rotation + bcrypt cost 12 + HttpOnly `__Host-` cookies
- Socket.IO JWT handshake auth + origin allowlist
- Helmet CSP + `express-rate-limit`
- Zod on every route handler
- Docker multi-stage non-root + capability drops
- SQLite WAL mode + pre-compiled statements
- `pg`/`isPostgres` runtime branches (auto-detect `DATABASE_URL`)

### Test impact

- `test:critical`: 30 files → 27 files, 226 tests → 211 tests
- `test` (full suite): 505 tests → 475 tests (admin debug tests removed)
- All non-removed tests pass unchanged

### Migration

No action required for existing deployments — the app behavior is unchanged for end users. Admin loses debug-only endpoints (no production callers). If you have scripts hitting `/admin/metrics` or `/admin/profiling/*`, they will return 404.

## [1.0.0] — 2026-06-18

### Security (Phase 10 remediation, all 15 findings closed)
- Socket.IO JWT handshake auth + per-room class access check
- JWT algorithm pinned to HS256 (3 verify callsites)
- Refresh token rotation with reuse detection
- Helmet CSP (production)
- Rate limiting: 150 login / 500 writes / 10 invite redeem per 15min
- bcrypt cost 12, async-only
- express.json 100kb body limit
- Docker non-root (UID 1001), all caps dropped, 512MB RAM / 1 CPU / 100 procs
- CI gates: ESLint `--max-warnings=0`, 226 critical tests, bun smoke, CodeQL

### Added
- Multi-teacher roles (Administrator / Owner / Subject Teacher / Assistant)
- Invites system (rotating codes, role-bound)
- Session management UI (revoke any device)
- Excel import/export with guardrails
- PII log redaction
- Socket.IO real-time class updates
- Docker multi-stage alpine build

[2.0.0]: https://github.com/richiesamlie/LocalAttendace-Final/compare/v1.0.0...v2.0.0
[Unreleased]: https://github.com/richiesamlie/LocalAttendace-Final/compare/v1.0.0...HEAD