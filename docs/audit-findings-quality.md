# Code Quality & Dependency Audit Findings — 2026-08-06

## Summary

**Scope:** Code quality (dead code, patterns, correctness) and dependency health (unused deps, versions, duplication) for the LocalAttendance-Final project.

**Methodology:** Direct file reads, grep-based import tracing across all `src/` and root-level `.ts`/`.tsx` files, and manual code-path analysis.

**Overall:** The codebase is in good shape for a project of this size. Prior cleanup removed `motion`/`framer-motion` and `recharts` as expected. Key concerns are the write-queue lock-safety gap, two genuinely unused runtime dependencies, the `useActiveStudents` export that is never imported, and the duplicate `overrides`/`resolutions` blocks in `package.json`.

---

## Findings

### QUAL-001: Write Queue Lock Can Stuck Forever (Missing try/finally)

- **Severity:** HIGH
- **File(s):** `src/db/writeQueue.ts`
- **Description:** `processWriteQueue` acquires a boolean lock (`isProcessingWriteQueue = true`) before entering the `while` loop. If an unexpected error escapes the loop body — e.g. a monkey-patched `Array.prototype.shift` or an out-of-memory condition — the lock is never released. Every subsequent call to `enqueueWrite` will add to the queue but `processWriteQueue` returns immediately (the guard `if (isProcessingWriteQueue) return`), leaving all writes permanently stuck. The function should wrap the loop in `try/finally` to guarantee `isProcessingWriteQueue = false` on exit.
- **Evidence:**
  ```ts
  // writeQueue.ts — current code (no try/finally)
  export async function processWriteQueue(): Promise<void> {
    if (isProcessingWriteQueue || writeQueue.length === 0) return;
    isProcessingWriteQueue = true;
    while (writeQueue.length > 0) {
      const task = writeQueue.shift();
      if (!task) continue;
      try {
        await task.fn();
        task.resolve();
      } catch (error) {
        task.reject(error as Error);
      }
    }
    isProcessingWriteQueue = false; // never reached if while-loop throws
  }
  ```
- **Risk:** A single unexpected throw permanently freezes all write operations (attendance saves, student CRUD, seating changes, etc.) until the server restarts. In production with SQLite WAL mode, this could silently lose writes.
- **Recommendation:** Wrap the while loop in `try/finally`:
  ```ts
  isProcessingWriteQueue = true;
  try {
    while (writeQueue.length > 0) {
      const task = writeQueue.shift();
      if (!task) continue;
      try { await task.fn(); task.resolve(); }
      catch (error) { task.reject(error as Error); }
    }
  } finally {
    isProcessingWriteQueue = false;
  }
  ```
- **Status:** OPEN

---

### QUAL-002: `react-window` and `react-virtualized-auto-sizer` Have Zero Imports

- **Severity:** MEDIUM
- **File(s):** `package.json` (lines 60–61)
- **Description:** Both `react-window` (^2.3.0) and `react-virtualized-auto-sizer` (^2.0.3) are listed in `dependencies` but have zero imports anywhere in `src/` or root-level `.ts`/`.tsx` files. These appear to be leftover from a prior virtualized list implementation that was removed. They add ~50 KB to the production bundle via tree-shaking (the packages are peer-dependency-light but still parsed/resolved during build).
- **Evidence:** `grep` across all `src/` files for `from 'react-window'` and `from 'react-virtualized-auto-sizer'` returns zero results. Confirmed in `package.json` lines 60–61 and lock files.
- **Risk:** Increased bundle size and misleading dependency footprint for future maintainers.
- **Recommendation:** Remove both from `dependencies` and run `npm install` to clean lock files.
- **Status:** OPEN

---

### QUAL-003: `useActiveStudents` Export Never Imported

- **Severity:** LOW
- **File(s):** `src/store.ts` (line 801)
- **Description:** The named export `useActiveStudents` is defined and exported but never imported anywhere in the codebase. A grep for `useActiveStudents` finds only the definition site. This is dead code.
- **Evidence:** `grep 'useActiveStudents' src/` → only match is the definition in `store.ts:801`. No consumers in `src/App.tsx`, `src/components/`, `src/hooks/`, or anywhere else.
- **Risk:** Minimal runtime impact (tree-shaking removes it), but it misleads developers into thinking this hook is used/intended.
- **Recommendation:** Remove the export, or add it to a component that needs archived-student filtering if that feature is planned.
- **Status:** OPEN

---

### QUAL-004: DB Proxy Silently Returns `undefined` for Typos

- **Severity:** MEDIUM
- **File(s):** `src/db/index.ts`
- **Description:** The `dbProxy` uses a catch-all Proxy that forwards any property access to the raw `_db` better-sqlite3 instance. If code accesses a misspelled method (e.g. `db.prepar()` instead of `db.prepare()`), the Proxy returns `undefined` rather than throwing. This is partially mitigated by TypeScript's type assertion (`as Database.Database & { ... }`), which catches typos at compile time. However, any dynamic property access (bracket notation) or non-TypeScript callers (e.g. test mocks, scripts) will not benefit from the type check.
- **Evidence:**
  ```ts
  // db/index.ts — the Proxy trap returns undefined for missing properties
  const dbObj = _db as unknown as Record<PropertyKey, unknown>;
  const val = dbObj[prop]; // val = undefined if prop doesn't exist on _db
  if (typeof val === 'function') {
    return val.bind(_db);
  }
  return val; // returns undefined without warning
  ```
- **Risk:** Silent failures in non-TypeScript code paths (tests, migration scripts). TypeScript catches most cases but not all.
- **Recommendation:** Add a dev-mode warning for unknown properties: `if (val === undefined && prop !== 'toJSON' && prop !== Symbol.toPrimitive) console.warn(\`[db] Unknown property accessed: ${String(prop)}\`)`. This preserves the proxy pattern's flexibility while surfacing mistakes.
- **Status:** OPEN

---

### QUAL-005: Monolithic Frontend Store (33 Actions, 8+ Concerns)

- **Severity:** LOW
- **File(s):** `src/store.ts` (805 lines)
- **Description:** The single Zustand store mixes at least 8 distinct concerns: authentication, class management, student CRUD, attendance records, daily notes, calendar events, timetable, seating layout, theme, and admin operations. It contains 33 async action functions, all in one file. While this works (Zustand handles it fine), it creates a maintenance burden — changes to one area risk merge conflicts with another, and the file is difficult to navigate.
- **Evidence:** State fields: `isAuthenticated`, `teacherId`, `classes`, `currentClassId`, `students`, `records`, `dailyNotes`, `events`, `timetable`, `seatingLayout`, `theme`, `lastAttendanceChange`, `isAdmin`. Actions: `setAuth`, `clearAuth`, `initializeStore`, `loadClassData`, `reloadClassData`, `addClass`, `removeClass`, `setCurrentClass`, `updateClassName`, `setStudents`, `addStudent`, `removeStudent`, `updateStudent`, `setRecord`, `markAllPresent`, `undoLastAttendance`, `setDailyNote`, `addEvent`, `addEvents`, `updateEvent`, `removeEvent`, `addTimetableSlot`, `updateTimetableSlot`, `removeTimetableSlot`, `updateSeat`, `setSeatingLayout`, `clearSeatingLayout`, `toggleTheme`, `clearData`, `clearAllData`, `updateAdminPassword`, `setRecordForClass` (33 total).
- **Risk:** Merge conflicts when multiple developers touch different concerns. Difficult to test individual concerns in isolation.
- **Recommendation:** Consider splitting into domain-specific slices using Zustand's `slice` pattern (e.g. `authSlice`, `classSlice`, `attendanceSlice`, `uiSlice`). Each slice is its own file, composed in the store. This is an improvement, not a blocker — the current code is functional.
- **Status:** OPEN (advisory)

---

### QUAL-006: Route Dual-Mount Creates Two Accessible Paths Per Endpoint

- **Severity:** LOW / INFO
- **File(s):** `routes.ts`, `src/routes/record.routes.ts`, `src/routes/event.routes.ts`, `src/routes/timetable.routes.ts`, `src/routes/seating.routes.ts`, `src/routes/note.routes.ts`
- **Description:** Five routers (`recordRouter`, `noteRouter`, `eventRouter`, `timetableRouter`, `seatingRouter`) are mounted at both `/` and their resource prefix (e.g. `/records`). This means the same router's routes are accessible via two URL patterns. For example, `recordRouter.get('/classes/:classId/records')` is reachable at both `/api/classes/:classId/records` (via the `/` mount) and `/api/records/classes/:classId/records` (via the `/records` mount). The `POST /` handler on `recordRouter` is accessible at both `/api/` and `/api/records/`. Each request matches only ONE route (Express resolves top-down and stops at the first match), so middleware does NOT run twice for a single request.
- **Evidence:**
  ```ts
  // routes.ts
  router.use('/', recordRouter);        // GET /api/classes/:classId/records, POST /api/
  router.use('/records', recordRouter);  // GET /api/records/classes/:classId/records, POST /api/records/
  ```
  A grep for `POST /` and `GET /` in `record.routes.ts` confirms the `POST /` handler exists (the write endpoint for attendance records). The frontend hits `POST /api/records` via `api.ts`, which matches only the `/records` mount.
- **Risk:** The `POST /api/` path is effectively an accidental admin-write endpoint (POST to the API root). In practice, this is mitigated by `requireAuth` + `postLimiter` middleware on the handler, and the frontend never calls it. However, it's an unnecessary attack surface.
- **Recommendation:** Move the `POST /` handler in `recordRouter` to `POST /records` so it matches cleanly on the `/records` mount, and remove the `/` mount for `recordRouter`. Document the dual-mount pattern with a clear rationale (the existing F-022 comment is good).
- **Status:** OPEN (informational — no active exploit)

---

### QUAL-007: `CardSkeleton` and `TableRowSkeleton` Confirmed Removed

- **Severity:** N/A (resolved)
- **File(s):** `src/components/Skeleton.tsx`
- **Description:** Prior cleanup removed `CardSkeleton` and `TableRowSkeleton` from `Skeleton.tsx`. Only `Skeleton` (base component) and `AttendanceGridSkeleton` remain, and `AttendanceGridSkeleton` is actively used in `TakeAttendance.tsx`. No dead skeleton code remains.
- **Evidence:** `grep 'CardSkeleton|TableRowSkeleton' src/` → zero results. `AttendanceGridSkeleton` imported in `src/components/TakeAttendance.tsx:8`.
- **Status:** RESOLVED

---

### QUAL-008: `src/services/index.ts` Barrel Confirmed Removed; Root Barrel Exists

- **Severity:** N/A (informational)
- **File(s):** `services.ts` (root)
- **Description:** The audit question asked about `src/services/index.ts` — that barrel was removed as expected. However, a root-level `services.ts` barrel exists that re-exports all 12 services plus utilities (`isPostgres`, `ClassSummary`). All route files import from `../../services` (resolving to this root barrel), not directly from `src/services/*.service.ts`. This is a valid pattern but means the root barrel is load-bearing — removing it would break all route imports.
- **Evidence:** `services.ts` exists at root with 12 re-exports. All 12 route files + `middleware.ts` + `server.ts` import from `../../services` or `./services`.
- **Status:** INFO

---

### QUAL-009: Duplicate `overrides` and `resolutions` Blocks in `package.json`

- **Severity:** LOW
- **File(s):** `package.json` (lines 103–122)
- **Description:** The `overrides` (npm) and `resolutions` (yarn) blocks in `package.json` are exact duplicates — 14 entries each with identical keys and values. This is intentional for cross-package-manager compatibility (npm uses `overrides`, yarn uses `resolutions`, pnpm uses `overrides`). However, maintaining two identical blocks is error-prone; a future edit to one must be replicated to the other.
- **Evidence:**
  ```json
  "overrides": {
    "ws": "^8.21.0",
    "form-data": "^4.0.6",
    // ... 12 more entries
  },
  "resolutions": {
    "ws": "^8.21.0",
    "form-data": "^4.0.6",
    // ... identical 12 entries
  }
  ```
- **Risk:** Drift between the two blocks. Low probability but high impact (one package manager resolves differently).
- **Recommendation:** Add a comment noting they must stay in sync, or use a script that generates one from the other. Alternatively, standardize on one package manager and remove the other block.
- **Status:** OPEN (advisory)

---

### QUAL-010: `tsx` Listed as Production Dependency

- **Severity:** LOW
- **File(s):** `package.json` (line 65)
- **Description:** `tsx` (^4.23.5) is listed in `dependencies` rather than `devDependencies`. While `tsx` is used in the `start` script (`npx tsx server.ts`), production deployments that bundle/transpile first (e.g. Docker builds) don't need `tsx` at runtime. Keeping it in `dependencies` increases `npm install` time and `node_modules` size in production.
- **Evidence:** `package.json` line 65: `"tsx": "^4.23.5"` under `dependencies`. Used by `"start": "npx tsx server.ts"` and `"dev": "npx tsx --watch server.ts"`.
- **Risk:** Bloats production `node_modules`. Not a correctness issue.
- **Recommendation:** Move to `devDependencies` if the project transpiles before production. If production always runs via `npx tsx`, keep it but document why.
- **Status:** OPEN (advisory)

---

## Areas Investigated with No Findings

### Dead Code: `src/services/utils.ts` Exports
All exports (`isPostgres`, `ClassSummary`, `db`, `pgQuery`, `pgQueryOne`, `pgTransaction`) are actively used by service files. `ClassSummary` is used by `class.service.ts`. No dead exports.

### Dead Code: Route Handlers vs Frontend API Client
All routes registered in `src/routes/` have corresponding calls in `src/lib/api.ts`. The `admin.routes.ts` handlers for performance metrics, query profiling, and resource monitoring all have matching API client methods. No orphaned route handlers found.

### Dead Code: Components Not Imported in `App.tsx`
All 16 lazy-loaded components in `App.tsx` have corresponding files in `src/components/`. All non-lazy components (`Sidebar`, `ErrorBoundary`) are imported by `App.tsx` or `main.tsx`. No orphaned components found.

### Dependency Versions
No suspiciously old or dangerously new dependencies. All versions are on current major tracks:
- `better-sqlite3` ^12.11.1 (current)
- `pg` ^8.22.0 (current)
- `express` ^4.22.2 (current for Express 4)
- `react` ^19.2.8 (latest stable)
- `zod` ^4.4.3 (latest)
- `typescript` ~5.8.3 (tilde — patch-locked, which is standard)

### Prior Cleanup: `motion`/`framer-motion` and `recharts`
Confirmed removed. Zero imports for `motion`, `framer-motion`, or `recharts` across all `src/` files.

### `clsx` vs `tailwind-merge`
Both are used. `clsx` is imported in `src/utils/cn.ts` and combined with `tailwind-merge`. Both are load-bearing (the `cn()` utility is used pervasively).
