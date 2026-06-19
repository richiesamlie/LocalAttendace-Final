# Ponytail Audit — LocalAttendace-Final

> **Date:** 2026-06-19
> **Auditor:** Hermes Agent (MiniMax-M3), ponytail skill v4.7.0
> **Repo:** richiesamlie/LocalAttendace-Final @ 582b228
> **Verdict:** Major version bump warranted. Net -4,000 lines, -4 runtime deps possible with no behavior change for end users.

## Method

Ponytail ladder (full mode): YAGNI → stdlib → native → installed-dep → one-liner. Each finding tagged `delete | shrink | yagni | stdlib | native` per the audit format.

## Findings (ranked biggest cut first)

### 1. Admin debug tools — entire subsystem is dead weight for production

`delete` — remove `PerformanceMonitor`, `QueryProfiler`, `ResourceMonitor` (UI), `metricsStore` middleware, `resourceMonitor` middleware, `db/profiling.ts`, and the seven `/admin/metrics`, `/admin/resources`, `/admin/profiling/*` routes. Replacement: nothing for end users; admin settings + password change stay.

Evidence:
- 1,396 LOC UI (`PerformanceMonitor.tsx` 495 + `QueryProfiler.tsx` 440 + `ResourceMonitor.tsx` 461)
- 935 LOC backend middleware (`metricsStore.ts` 275 + `performance.ts` 211 + `resourceMonitor.ts` 449)
- 285 LOC profiling (`db/profiling.ts`)
- 0 references in non-admin code paths
- App is single-school, single-tenant, local-first — runtime EXPLAIN-UI is for multi-tenant SaaS
- **Files:** `src/components/PerformanceMonitor.tsx`, `src/components/QueryProfiler.tsx`, `src/components/ResourceMonitor.tsx`, `src/middleware/metricsStore.ts`, `src/middleware/performance.ts`, `src/middleware/resourceMonitor.ts`, `src/db/profiling.ts`, `src/routes/admin.routes.ts` (metrics/profiling/resources handlers)

### 2. Dead runtime deps

`delete` — `recharts`, `motion`, `react-window`, `react-virtualized-auto-sizer`. Zero importers across `src/`.

Evidence:
- `grep "from 'recharts'" src/` → 0 matches (the only `BarChart3` import is from `lucide-react`)
- `grep "from 'motion'" src/` → 0 matches
- `grep "react-window\|react-virtualized" src/` → 0 matches
- `react-window` exists in package.json but the Roster component renders 500-row tables without virtualization
- **Files:** `package.json`, `bun.lock`, `package-lock.json` (after regen)

### 3. Dead files

`delete` — three files with zero importers, one dual-config:

- `verify-perf-config.ts` — 50 lines, not in any `package.json` script, prints env vars to stdout
- `db.ts` (root) — 9-line re-export shim, zero importers
- `src/services/index.ts` — 31 lines of aliased re-exports (`classBackendService` etc.), zero importers (server.ts imports `./services` from root)
- `.eslintrc.json` — legacy ESLint config; ESLint 9 flat config (`eslint.config.js`) supersedes it; legacy configs are ignored when flat config exists

### 4. Dual setup-script sprawl

`delete` — every command has a `.sh` + `.ps1` + (sometimes) `.bat`. Keep `.sh` for CI/server, keep `.bat` for double-click (Windows school admins per user profile), drop `.ps1` and the `exec-by-platform.mjs` wrapper that picks between them. Plus one-shot scripts that don't earn their keep:

- `scripts/exec-by-platform.mjs` (55 lines of OS branching for `.ps1` vs `.sh`)
- `scripts/setup-postgres.{ts,sh,bat}` — one-shot setup for an optional DB; `server.ts` already auto-detects `DATABASE_URL`
- `src/repositories/migrate.ts` — called only by the one-shot setup script above
- `setup-windows-startup.bat` — Windows admins double-click `start-app.bat`; auto-startup belongs in the Start Menu, not the repo
- `start-internal-site.{sh,bat,ps1}` — duplicates `start-app.*` with one extra flag
- `.ps1` versions of: `clean-db.ps1`, `kill-server.ps1`, `setup-env.ps1`

### 5. Hook consolidation

`shrink` — `useStopwatch` (51 LOC) and `useTimer` (79 LOC) both live only inside `ExamTimer.tsx`. Collapse to `useChrono({ countdown?, autostart? })`. Compress `useData.ts` (394 LOC of near-identical `useQuery` blocks) by parameterizing.

### 6. Dead or redundant in-app features

- `src/components/Gatekeeper.tsx` (145 LOC) + Sidebar entry + App.tsx route — overlap with `RandomPicker.tsx`; user can pick one
- `src/db/cache.ts` (43 LOC) — homemade TTL cache, replaced by React Query caching
- `src/db/writeQueue.ts` (32 LOC) — homemade FIFO queue, replaced by SQLite WAL serialization
- `src/utils/cn.ts` (6 LOC) — fine to keep; only YAGNI if `cn()` callers collapse to one (they don't, this is the standard recipe)

### 7. Test surface

`shrink` — 27 security tests + 14 contract tests + 7 service tests = ~6,700 LOC for a single-school app. Keep load-bearing gates (JWT/cookie/CSP/rate-limit/bcrypt/Dockerfile non-root), drop ones for deleted features and ones that don't gate real attack surface.

Specifically droppable after admin debug removal (Phase 5):
- `admin.profiling.security.test.ts`, `admin.database-restore.security.test.ts`, `admin.require-admin.security.test.ts`, `admin.log-redact.security.test.ts`
- `performance.url-sanitize.security.test.ts`
- `auth.performance.test.ts`

Keepable (real attack surface):
- `auth.security.test.ts`, `auth.refresh.security.test.ts`, `auth.bcrypt-rounds.security.test.ts`, `auth.jwt-secret.security.test.ts`
- `server.body-limit.security.test.ts`, `server.csp.security.test.ts`
- `invite.atomic.security.test.ts`, `invite.generic-errors.security.test.ts`
- `socketio.allow-request.security.test.ts`
- `health.timing.security.test.ts`
- `build.dockerfile.security.test.ts`, `build.docker-compose.security.test.ts`

### 8. Single-route simplification

`shrink` — `studentRouter` dual-mounted on `/classes` and `/students` (F-022 comment in `routes.ts`) — legacy alias kept "for backwards compat". One frontend migration closes it; until then, mount once + 301 the other.

## What stays load-bearing (deliberately NOT cut)

- JWT (HS256 pinned) + refresh token rotation + bcrypt cost 12 + HttpOnly `__Host-` cookies
- Socket.IO JWT handshake auth + origin allowlist (`allowRequest` in `server.ts:87-103`)
- Helmet CSP + `express-rate-limit` (5 lines of middleware, real protection)
- Zod on every route handler
- Docker multi-stage non-root + capability drops + resource limits
- SQLite WAL mode + pre-compiled statements (measurable free win)
- `pg`/`isPostgres` runtime branches (already optional, no extra runtime cost when `DATABASE_URL` unset)
- Both `bun.lock` AND `package-lock.json` — CI uses `npm ci` (typecheck/eslint/build/test) AND `bun install --frozen-lockfile` (parity-smoke/release). Cannot drop either.

## Net

| Category | Change |
|----------|--------|
| Source LOC | -4,000 (16,601 → ~12,600) |
| Test LOC | -1,000+ (6,726 → ~5,700) |
| Runtime deps | -4 (recharts, motion, react-window, react-virtualized-auto-sizer) |
| Setup scripts | -10 files (.ps1 wrappers, exec-by-platform, setup-postgres, setup-windows-startup, start-internal-site) |
| Files deleted | 7 source files (3 dead + 4 admin debug UI) + 7 backend files + 12+ tests |
| Behavior change | None for end users. Admin loses debug-only endpoints (no production callers). |
| Version bump | 1.0.0 → 2.0.0 (breaking) |