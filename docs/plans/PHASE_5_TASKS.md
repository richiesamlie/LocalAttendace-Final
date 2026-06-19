# Phase 5 — Admin Debug Tools Removal (BIGGEST CUT)

> **Goal:** remove the admin-only debug subsystem (3 UI components, 3 middleware modules, 10 admin endpoints). Keep load-bearing middleware (`performanceMonitor` for request logging) but strip its metricsStore calls.
> **Risk:** HIGH — touches ~2,600 lines across 7 files deleted + 4 files patched + 2 security tests deleted + test:critical list shortened.
> **Reversibility:** one commit, `git revert` returns to clean state.

## Pre-verification (DONE during planning)

| Reference | Used by | Action |
|-----------|---------|--------|
| `PerformanceMonitor` UI component | App.tsx (lazy import + route) | DELETE component, patch App.tsx |
| `QueryProfiler` UI component | App.tsx (lazy import + route) | DELETE component, patch App.tsx |
| `ResourceMonitor` UI component | App.tsx (lazy import + route) | DELETE component, patch App.tsx |
| `metricsStore` (src/middleware/metricsStore.ts) | `performance.ts` (3 calls), `admin.routes.ts` (5 calls), its own test | DELETE file, strip calls from performance.ts, strip calls from admin.routes.ts |
| `performanceMonitor` (src/middleware/performance.ts) | server.ts `app.use(performanceMonitor)` | KEEP file, but slim down (remove metricsStore calls + monitorQuery + performanceConfig exports) |
| `monitorQuery` (export from performance.ts) | only its own JSDoc, no callers | DELETE export |
| `performanceConfig` (export from performance.ts) | only the deleted `verify-perf-config.ts` (Phase 2) | DELETE export |
| `resourceMonitor` (src/middleware/resourceMonitor.ts) | admin.routes.ts (5 calls) | DELETE file, strip calls from admin.routes.ts |
| `profileQuery`, `profileAllStatements`, `getAllIndexes`, `getTableStats`, `getOptimizationScore` (src/db/profiling.ts) | admin.routes.ts (8 calls) | DELETE file, strip calls from admin.routes.ts |
| `/admin/metrics*` (3 endpoints) | api.ts (2 client methods), admin.routes.ts | DELETE endpoints, strip client methods |
| `/admin/profiling/*` (4 endpoints) | api.ts (4 client methods), admin.routes.ts | DELETE endpoints, strip client methods |
| `/admin/resources*` (3 endpoints) | api.ts (3 client methods), admin.routes.ts | DELETE endpoints, strip client methods |

## Files to DELETE (7)

| File | LOC |
|------|-----|
| `src/components/PerformanceMonitor.tsx` | 495 |
| `src/components/QueryProfiler.tsx` | 440 |
| `src/components/ResourceMonitor.tsx` | 461 |
| `src/middleware/metricsStore.ts` | 275 |
| `src/middleware/resourceMonitor.ts` | 449 |
| `src/db/profiling.ts` | 285 |
| `src/middleware/__tests__/metricsStore.test.ts` | 211 |

## Files to PATCH (4)

### `src/middleware/performance.ts` (211 → ~40 LOC)

Remove: `import { metricsStore }`, all 3 `metricsStore.add*` calls, `monitorQuery` export, `performanceConfig` export, `slowQueryThreshold` from config, `metricsEnabled` flag, `monitorQuery` JSDoc.

Keep: `performanceMonitor` middleware, request timing, slow-request warning, `logAllRequests` flag, URL sanitization.

### `src/routes/admin.routes.ts` (270 → ~130 LOC)

Remove imports: `metricsStore`, `profileQuery`, `profileAllStatements`, `getAllIndexes`, `getTableStats`, `getOptimizationScore`, `resourceMonitor`.

Remove: 10 endpoints (lines 128-271).

Keep: `/settings` GET/POST, `/database/backup`, `/database/restore`.

### `src/App.tsx`

Remove 3 lazy imports + 3 cases in switch.

### `src/components/Sidebar.tsx`

Remove 3 sidebar entries (lines referencing `performance`, `profiler`, `resources`).

### `src/lib/api.ts`

Remove client methods: `getPerformanceMetrics`, `clearPerformanceMetrics`, `profileCustomQuery`, `getQueryProfilingStatements`, `getQueryProfilingIndexes`, `getQueryProfilingStats`, `getResourceCurrent`, `getResourceHistory`, `getResourceAlerts` (9 methods).

### `eslint.config.js`

Remove `src/middleware/performance.ts` from the `no-console: off` override (or keep — see below).

### `package.json`

Shorten `test:critical` list to remove `admin.profiling.security.test.ts`, `performance.url-sanitize.security.test.ts`, `auth.performance.test.ts`.

## Security tests to DELETE (3)

| File | Reason |
|------|--------|
| `src/test/security/admin.profiling.security.test.ts` | Tests deleted `/admin/profiling/*` endpoints |
| `src/test/security/performance.url-sanitize.security.test.ts` | Tests the URL sanitizer which moves to a slimmer middleware |
| `src/test/auth.performance.test.ts` | Tests `performanceConfig` which is deleted |

## Gate commands

```bash
export DEFAULT_ADMIN_PASSWORD=*** "JWT_SECRET=*** rand -hex 16)" > .env
npm ci
npm run lint
npm run lint:eslint -- --max-warnings=0
npm run test:critical
npm run test                              # FULL suite, not just critical
bun install --frozen-lockfile
bun run lint
bun run build
```

After Phase 5, MUST run `npm run test` (full suite) because removed tests shift counts. Must also run `bun run build` to confirm the Vite bundle still builds without `recharts` (already removed in Phase 3, but verify end-to-end).

## Steps

1. Pre-verify: re-run `grep` for all referenced symbols
2. Delete the 7 source files
3. Delete the 3 security test files
4. Patch `src/middleware/performance.ts` (slim down)
5. Patch `src/routes/admin.routes.ts` (remove imports + 10 endpoints)
6. Patch `src/App.tsx` (remove 3 lazy imports + 3 cases)
7. Patch `src/components/Sidebar.tsx` (remove 3 entries)
8. Patch `src/lib/api.ts` (remove 9 client methods)
9. Patch `package.json` test:critical (remove 3 test paths)
10. Patch `eslint.config.js` (drop `src/middleware/performance.ts` from no-console override IF after slim-down no console calls remain; otherwise keep)
11. Run gates
12. Commit

## Commit

```
refactor(admin): drop admin debug tools (Performance/Query/Resource Monitor UI + backend)

Phase 5 of the ponytail major cut. The largest single cut: ~2,600 lines.

DELETED (7 source files, 2,616 LOC):
- src/components/PerformanceMonitor.tsx (495)
- src/components/QueryProfiler.tsx (440)
- src/components/ResourceMonitor.tsx (461)
- src/middleware/metricsStore.ts (275)
- src/middleware/resourceMonitor.ts (449)
- src/db/profiling.ts (285)
- src/middleware/__tests__/metricsStore.test.ts (211)

DELETED (3 security tests):
- src/test/security/admin.profiling.security.test.ts
- src/test/security/performance.url-sanitize.security.test.ts
- src/test/auth.performance.test.ts

PATCHED:
- src/middleware/performance.ts: slimmed 211 -> ~40 LOC. Kept the
  performanceMonitor middleware (load-bearing request logger used by
  server.ts). Dropped metricsStore.add* calls, monitorQuery export,
  performanceConfig export. Now a focused request-timing middleware.
- src/routes/admin.routes.ts: removed 10 admin debug endpoints
  (/metrics, /metrics/summary, DELETE /metrics, /profiling/query,
  /profiling/statements, /profiling/indexes, /profiling/stats,
  /resources, /resources/history, /resources/alerts). Kept
  /settings GET/POST, /database/backup, /database/restore.
- src/App.tsx: removed 3 lazy imports + 3 cases in renderPage switch.
- src/components/Sidebar.tsx: removed 3 entries.
- src/lib/api.ts: removed 9 client methods.
- package.json: shortened test:critical list (3 paths removed).
- eslint.config.js: dropped src/middleware/performance.ts from
  no-console override (slim version still uses console.warn/error
  legitimately, kept in override).

Test impact: critical 30 -> 27 files, 226 -> ~200 tests.

Verified: tsc --noEmit clean, eslint --max-warnings=0 clean,
test:critical passing, test (full) passing, bun install --frozen-lockfile
clean, bun run lint clean, bun run build clean.

See docs/plans/2026-06-19-ponytail-major-cut-plan.md
```

## Exit Criteria

- 7 source files deleted, 3 test files deleted
- 6 files patched (performance.ts, admin.routes.ts, App.tsx, Sidebar.tsx, api.ts, package.json, eslint.config.js)
- All gates pass: lint, eslint, test:critical, test (full), bun install, bun lint, bun build
- Commit created