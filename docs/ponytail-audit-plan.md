# Ponytail Audit — Implementation Plan

Based on the verified audit findings. Each step is independent and can be done in any order. Steps are grouped by risk level.

---

## Phase 1: Zero-Risk Deletions (no code changes, no build impact)

### 1.1 Delete `.eslintrc.json`
- **Why**: Superseded by `eslint.config.js` (ESLint 9+ flat config). Having both causes confusion.
- **Risk**: None. Flat config takes precedence automatically.
- **Files**: `.eslintrc.json`
- **Verify**: `npm run lint:eslint` passes after deletion.

### 1.2 Delete `metadata.json`
- **Why**: Not referenced by any code, script, or config.
- **Risk**: None.
- **Files**: `metadata.json`
- **Verify**: `npm run build` passes.

### 1.3 ~~Delete `src/components/Timetable/index.ts`~~ RETRACTED
- **Why**: Initially thought unused. Actually `App.tsx:16` resolves `./components/Timetable` to this barrel.
- **Status**: Retracted. Barrel is used.

### 1.4 Delete `src/services/index.ts`
- **Why**: Barrel with aliased exports (`classBackendService`, `studentBackendService`, etc.) that have 0 consumers. All routes import from root `services.ts`.
- **Risk**: None. No imports point to this file.
- **Files**: `src/services/index.ts`
- **Verify**: `npm run build` passes.

---

## Phase 2: Low-Risk Code Changes

### 2.1 Remove unused Skeleton exports
- **Why**: `CardSkeleton` and `TableRowSkeleton` are exported but never imported. Only `AttendanceGridSkeleton` is used.
- **Risk**: Low. Removing unused exports cannot break existing imports.
- **Files**: `src/components/Skeleton.tsx`
- **Action**: Delete `CardSkeleton` (lines 9-21) and `TableRowSkeleton` (lines 23-33). Keep `Skeleton` base component and `AttendanceGridSkeleton`.
- **Verify**: `npm run build` passes. `npm run test` passes.

### 2.2 Remove unused npm dependencies
- **Why**: `motion` and `recharts` are in `package.json` but have 0 imports in `src/`.
- **Risk**: Low. No code references them.
- **Action**:
  ```
  npm uninstall motion recharts
  ```
- **Verify**: `npm run build` passes. `npm run test` passes. Bundle size decreases.

---

## Phase 3: Medium-Risk Refactors

### 3.1 Lazy-init PostgreSQL pool
- **Why**: `src/lib/postgres.ts` creates a `new Pool(...)` at import time unconditionally, even when `DB_TYPE=sqlite` (the default). This allocates connection resources that are never used in the default deployment.
- **Risk**: Medium. Changes initialization timing for Postgres users.
- **Files**: `src/lib/postgres.ts`
- **Action**: Replace eager `new Pool(...)` with lazy singleton:
  ```typescript
  let _pool: Pool | null = null;

  export function getPool(): Pool {
    if (!_pool) {
      _pool = new Pool({
        connectionString: DATABASE_URL,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
      _pool.on('error', (err) => {
        console.error('[db] Unexpected error on idle client', err);
      });
    }
    return _pool;
  }
  ```
  Then update `query`, `queryOne`, `pgTransaction` to call `getPool()` instead of `pool`.
- **Verify**:
  - `npm run test` passes (SQLite mode, no pool created).
  - `DB_TYPE=postgres npm run test` passes (pool created on first use).
  - `npm run build` passes.

### 3.2 Fix `profileAllStatements` hardcoded queries
- **Why**: `src/db/profiling.ts:profileAllStatements` contains 7 hardcoded SQL strings that don't match the actual prepared statements in `src/db/statements.ts`. The function gives misleading results.
- **Risk**: Low-medium. Admin-only feature, but changing the function signature.
- **Files**: `src/db/profiling.ts`
- **Option A (preferred)**: Delete `profileAllStatements` entirely. The admin profiling endpoint `POST /api/admin/profiling/query` already accepts arbitrary SQL — operators can profile real queries directly.
- **Option B**: Rewrite to read from `statements.ts` dynamically. More complex, marginal benefit.
- **Action (Option A)**: Delete `profileAllStatements` function (lines 207-231). Update `src/routes/admin.routes.ts` to remove the `/profiling/statements` endpoint (lines 194-207) or replace it with a message directing operators to use `/profiling/query`.
- **Verify**: `npm run test` passes. Admin profiling endpoints still work.

---

## Execution Order

```
Phase 1 (all 4 steps can be one commit):
  1.1 → 1.2 → 1.3 → 1.4
```

**Status**: Completed 2026-07-13. Step 1.3 retracted (barrel is used by App.tsx). All other steps applied. Build + 513 tests pass.

## Expected Impact

| Metric | Before | After |
|--------|--------|-------|
| Dead files | 4 | 2 (Timetable barrel + services barrel retracted) |
| Unused exports | 2 | 0 |
| Unused deps | 2 | 0 |
| Eager PG pool (SQLite mode) | yes | no |
| Misleading profiler | yes | no |
| Lines removed | — | ~90 |

## What Was NOT Flagged

The following were investigated but are legitimate code:

- `src/routes/index.ts` — used by `routes.ts:23`
- `src/components/Timetable/index.ts` — used by `App.tsx:16` (retracted during implementation)
- `src/utils/typeGuards.ts` — used by ResourceMonitor, PerformanceMonitor, QueryProfiler
- `internalHealthCheck` — tested in `health.timing.security.test.ts`
- `verify-perf-config.ts` — referenced in `eslint.config.js:73`
- `confirmToast.ts` — used by `StudentRow.tsx`, `ClassSwitcher.tsx`
- `date-fns` — used by 8 files
- `pg` + dual-database codepath — legitimate opt-in feature with `setup-postgres.ts`
- Admin monitoring stack (~2600 lines) — wired and used, heavy but functional
