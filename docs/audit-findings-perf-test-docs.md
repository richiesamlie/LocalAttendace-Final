# Performance, Testing & Documentation Audit Findings — 2026-08-06

## Summary

This audit examined performance surfaces, test coverage, and documentation accuracy across the LocalAttendance-Final project. **3 performance findings**, **3 testing findings**, and **3 documentation findings** were identified. No HIGH severity issues were found. The most significant concern is the missing unit tests for the security-critical `refreshTokenService`.

| Severity | Count |
|----------|-------|
| HIGH     | 0     |
| MEDIUM   | 2     |
| LOW      | 4     |
| INFO     | 3     |

---

## Findings

### PERF-001: Cache Has No Max Size — Relies on TTL Expiry Alone

- **Severity:** MEDIUM
- **File(s):** `src/db/cache.ts`
- **Description:** The in-memory cache uses a plain `Map<string, CacheEntry>` with no maximum entry count. Entries are evicted lazily — only when `cacheGet()` reads an expired key. There is no proactive sweep, no size cap, and no periodic cleanup. If a caller generates many unique keys (e.g., per-user or per-request cache keys) faster than the default 5s TTL expires them, the Map grows indefinitely.
- **Evidence:**
  - `cacheSet()` calls `cache.set(key, ...)` with no size check (line 18).
  - `cacheGet()` deletes expired entries on read (line 10), but entries never accessed after expiry remain in memory.
  - `cacheInvalidate()` requires explicit caller invocation with a known pattern — no automated sweep.
  - Default TTL is 5s (`DEFAULT_TTL`), long TTL is 60s (`LONG_TTL`). These are short enough to limit growth in typical usage, but there is no hard upper bound.
- **Risk:** Under sustained high-throughput load with diverse keys, memory usage grows without bound. Low risk for typical classroom usage (short TTLs, limited unique keys), but no defensive ceiling exists.
- **Recommendation:** Add a max entry count (e.g., 10,000) and evict the oldest entries when exceeded, or add a periodic `setInterval` sweep that removes expired entries. Alternatively, use an LRU cache library (`lru-cache`).
- **Status:** OPEN

---

### PERF-002: PostgreSQL Pool Never Closed on Shutdown

- **Severity:** LOW
- **File(s):** `src/lib/postgres.ts`, `server.ts`
- **Description:** The PostgreSQL connection pool (`pg.Pool`) is lazily initialized via `getPool()` but is never closed. No `process.on('SIGTERM')` or `process.on('SIGINT')` handler calls `pool.end()`. The only `pool.end()` in the codebase is in `server.ts:configureDatabase()` which creates and destroys a separate test pool — it does not close the application pool.
- **Evidence:**
  - `src/lib/postgres.ts`: Exports `getPool()` (lazy init), `query()`, `queryOne()`, `pgTransaction()` — none call `pool.end()`.
  - `server.ts:47`: `await pool.end()` — this is a local test pool variable, not the exported `_pool`.
  - `src/middleware/resourceMonitor.ts` has SIGTERM/SIGINT handlers, but they only call `resourceMonitor.stopMonitoring()`.
  - `grep` for `pool.end` across the entire repo returns zero references to the exported pool.
- **Risk:** On process exit, Node.js does not guarantee graceful cleanup of the `pg.Pool`. PostgreSQL will see connections linger until its `idle_in_transaction_session_timeout` or TCP keepalive kicks in. Low practical risk for a single-instance classroom app, but could cause connection exhaustion in environments with frequent restarts.
- **Recommendation:** Add a shutdown hook in `server.ts`:
  ```typescript
  import { getPool } from './src/lib/postgres';
  const shutdown = async () => { await getPool().end(); };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  ```
- **Status:** OPEN

---

### TEST-001: No Unit Tests for `refreshTokenService`

- **Severity:** MEDIUM
- **File(s):** `src/services/refresh-token.service.ts`, `src/test/security/auth.refresh.security.test.ts`
- **Description:** The `refreshTokenService` is the most security-critical service in the application — it implements F-004 refresh token rotation, SHA-256 hashing at rest, reuse detection, and family-wide revocation. There are **no dedicated unit tests** for this service. The existing `auth.refresh.security.test.ts` tests the *integration* behavior (issue + rotate + revoke through the DB), but the service functions (`issue`, `rotate`, `findByRawValue`, `revokeFamily`, `cleanupExpired`, `countActiveForTeacher`) are not directly tested in isolation.
- **Evidence:**
  - `src/services/__tests__/` contains tests for 7 services: teacher, student, session, record, note, event, class.
  - `refresh-token.service.ts` has no corresponding test file in `__tests__/`.
  - `grep` for `refreshTokenService` in `src/services/__tests__/` returns zero matches.
  - `src/test/security/auth.refresh.security.test.ts` exercises the service indirectly via DB operations, not by importing and calling `refreshTokenService` directly.
- **Risk:** A subtle regression in token rotation (e.g., off-by-one in expiry comparison, incorrect family_id assignment, failed revocation cascade) could silently weaken the auth security model. The integration tests catch major failures but may miss edge cases in the service logic itself.
- **Recommendation:** Add `src/services/__tests__/refresh-token.service.test.ts` with unit tests for: (1) `issue()` returns raw value and stores hash, (2) `rotate()` marks old token used and returns new pair, (3) `rotate()` with already-used token triggers family revocation, (4) `revokeFamily()` revokes all tokens in a family, (5) `cleanupExpired()` removes only expired tokens.
- **Status:** OPEN

---

### TEST-002: Three Services Have No Unit Tests

- **Severity:** LOW
- **File(s):** `src/services/setting.service.ts`, `src/services/timetable.service.ts`, `src/services/seating.service.ts`
- **Description:** Of 12 service modules, 4 have no unit tests in `src/services/__tests__/`. `TEST-001` covers `refreshTokenService` (MEDIUM). The remaining three are straightforward CRUD services without security-critical logic.
- **Evidence:**
  - Services with tests (7): `teacher`, `student`, `session`, `record`, `note`, `event`, `class`.
  - Services without tests (4): `refresh-token` (covered by TEST-001), `setting`, `timetable`, `seating`.
  - `setting.service.ts` is 660 bytes (2 functions: `get`, `set`).
  - `timetable.service.ts` is 2.6KB (CRUD: `getByClass`, `getById`, `insert`, `update`, `delete`).
  - `seating.service.ts` is 2.9KB (CRUD: `getByClass`, `insert`, `deleteSeat`, `deleteStudent`, `saveLayout`, `clear`).
- **Risk:** Low. These are simple CRUD wrappers around prepared statements. Their route-level behavior is covered by integration/API tests. However, service-layer edge cases (e.g., `saveLayout` with empty map, `deleteStudent` when student not in layout) are untested.
- **Recommendation:** Add unit tests for these three services. Priority: `seating.service.ts` (most logic complexity with `saveLayout` + `deleteStudent` coordination).
- **Status:** OPEN

---

### TEST-003: Zero PostgreSQL-Specific Test Coverage

- **Severity:** LOW
- **File(s):** `src/lib/postgres.ts`, `src/db/auto-migrate.ts`
- **Description:** No test file in the project references `postgres`, `isPostgres`, `getPool`, or `DB_TYPE`. The entire test suite runs against SQLite. PostgreSQL-specific code paths — connection pooling, `pgTransaction()`, auto-migration from SQLite to Postgres — have zero test coverage.
- **Evidence:**
  - `grep` for `postgres|isPostgres|getPool|DB_TYPE` across `src/test/` returns zero matches.
  - `src/lib/postgres.ts` exports `getPool()`, `query()`, `queryOne()`, `pgTransaction()` — all untested.
  - `src/db/auto-migrate.ts` has `isPostgresEmpty()`, `createPostgresSchema()`, `migrateData()` — all untested.
  - Vitest config likely defaults to SQLite mode.
- **Risk:** Low for current usage (SQLite is the default, PostgreSQL is opt-in). If PostgreSQL adoption increases, regressions in the pool management, transaction handling, or migration logic could go undetected.
- **Recommendation:** Add at least a smoke test that verifies `getPool()` initializes correctly and `pgTransaction()` commits/rolls back when `DB_TYPE=postgres` and a `DATABASE_URL` is available. Gate these tests behind an environment check (`describe.skipIf(!process.env.DATABASE_URL)`).
- **Status:** OPEN

---

### DOC-001: Health Endpoint Response Shape Mismatch with API Reference

- **Severity:** LOW
- **File(s):** `docs/api-reference.md`, `src/routes/health.routes.ts`
- **Description:** The API reference documents `GET /health` as returning `{ "status": "ok", "uptime": 12345, "timestamp": "2026-06-18T12:00:00.000Z" }`. The actual implementation returns only `{ "status": "ok" }` — the `uptime` and `timestamp` fields were removed as part of F-024 (constant-time response, no info leak).
- **Evidence:**
  - `docs/api-reference.md` lines for `GET /health` response example: shows `uptime` and `timestamp` fields.
  - `src/routes/health.routes.ts`: `const body = JSON.stringify({ status: 'ok' });` — only `status` field.
  - The F-024 comment in the health route file explicitly states the `database` field was removed, but the docs were not updated to remove `uptime` and `timestamp` either.
- **Risk:** Developers or API consumers relying on `uptime` or `timestamp` will get `undefined`. Low impact since this is a health check endpoint.
- **Recommendation:** Update `docs/api-reference.md` `GET /health` response example to `{ "status": "ok" }`.
- **Status:** OPEN

---

### DOC-002: `operations.md` Missing from Documentation Map

- **Severity:** LOW
- **File(s):** `docs/documentation-map.md`, `docs/architecture.md`, `docs/contributing.md`, `docs/migration-guide.md`
- **Description:** `docs/operations.md` exists in the repository and is referenced by three other documentation files (`architecture.md`, `contributing.md`, `migration-guide.md`), but it is not listed in the `documentation-map.md` active documentation table.
- **Evidence:**
  - `docs/operations.md` exists (confirmed via glob).
  - `architecture.md` line 287: `[operations.md](operations.md) — Runbook + CI triage`
  - `contributing.md` line 491: `Check operations.md for CI triage`
  - `migration-guide.md` line 319: `[Operations Runbook](operations.md) — CI/CD and operations`
  - `documentation-map.md` active table does not list `operations.md`.
- **Risk:** Developers using the documentation map as the canonical index will not discover `operations.md`. Low impact — the file is still findable via direct links from other docs.
- **Recommendation:** Add `operations.md` to the active documentation table in `documentation-map.md`.
- **Status:** OPEN

---

### DOC-003: Admin `/metrics` Endpoint Response Shape Differs from API Reference

- **Severity:** INFO
- **File(s):** `docs/api-reference.md`, `src/routes/admin.routes.ts`
- **Description:** The API reference documents `GET /admin/metrics` as returning `{ "counters": {...}, "timings": {...}, "slowQueries": [...] }`. The actual implementation returns `{ summary, bufferInfo, metrics: { requests, queries, timeRange } }` — a different structure based on the `MetricsStore.getAggregated()` output.
- **Evidence:**
  - `docs/api-reference.md` response example for `GET /admin/metrics`: `{ "counters": {...}, "timings": {...}, "slowQueries": [...] }`.
  - `src/routes/admin.routes.ts` implementation returns: `res.json({ summary, bufferInfo, metrics: aggregated })` where `aggregated` contains `{ requests: { total, successful, failed, avgDuration, p50, p95, p99, slowest, byMethod, byEndpoint }, queries: {...}, timeRange: {...} }`.
  - The documented field names (`counters`, `timings`, `slowQueries`) do not appear in the implementation.
- **Risk:** API consumers parsing the documented shape will fail. Low impact — this is an admin-only diagnostic endpoint.
- **Recommendation:** Update `docs/api-reference.md` `GET /admin/metrics` response example to match the actual `MetricsStore.getAggregated()` return shape.
- **Status:** OPEN

---

### DOC-004: Architecture Docs Service Count Inconsistency

- **Severity:** INFO
- **File(s):** `docs/architecture.md`
- **Description:** The architecture docs state "Service layer with 12 service modules" and list 12 by name, but `src/services/` contains 13 files (12 services + `utils.ts`). The count is technically correct if excluding `utils.ts`, but the `developer-guide.md` separately states "11 service objects" — creating confusion.
- **Evidence:**
  - `architecture.md`: "Service layer with 12 service modules" — lists 12.
  - `developer-guide.md`: "Service layer (11 service objects)" — in the Project Structure table.
  - `src/services/` directory: 13 files including `utils.ts` (utility, not a service).
- **Risk:** No functional impact. Minor documentation inconsistency.
- **Recommendation:** Standardize the count across docs. If `utils.ts` is excluded, both docs should say "12 services". Add `refreshTokenService` to the `developer-guide.md` count (it currently says "11 service objects" but `refreshTokenService` is the 12th).
- **Status:** OPEN

---

## Areas Investigated with No Findings

### MetricsStore Circular Buffer (`src/middleware/metricsStore.ts`)
Properly capped. Both `requestMetrics` and `queryMetrics` arrays are limited to `maxSize` (default 10,000, configurable via `PERF_METRICS_BUFFER_SIZE`). On each `addRequest()`/`addQuery()`, if the array exceeds `maxSize`, the oldest entry is shifted off. **No unbounded growth risk.** Note: the `Array.shift()` call is O(n) which could be optimized to a true circular buffer, but this is a performance concern, not a memory safety issue.

### ResourceMonitor Sample/Alert Capping (`src/middleware/resourceMonitor.ts`)
Properly capped. `samples` array is limited to `maxSamples` (default 1,000, configurable via `RESOURCE_MAX_SAMPLES`). `alerts` array is limited to 100 entries. Both use the same `shift()` pattern as MetricsStore. **No unbounded growth risk.**

### Security Test Quality (`src/test/security/`)
The security test suite is well-constructed. Representative tests examined:
- **`auth.refresh.security.test.ts`**: Tests rotation, reuse detection (family revocation), expiry, concurrent access. Uses specific assertions (`expect(result).toBe(true/false)`, `expect(revokedTokens.length).toBe(3)`). Tests negative cases thoroughly.
- **`invite.atomic.security.test.ts`**: Tests first-win, second-fail, non-existent code, and `Promise.all` concurrency race. Specific boolean assertions.
- **`auth.socket.security.test.ts`**: Tests null returns for missing/expired/invalid tokens. Tests cookie parsing edge cases (empty, percent-encoded, whitespace). Specific value assertions.
- **`auth.security.test.ts`**: Tests bcrypt hashing, SQL injection prevention, session security, input validation. Uses mock DB with real assertions.

All tests assert specific outcomes, not just "doesn't throw". Negative cases are well covered.

### API Endpoint Coverage vs Route Registrations
All registered routes in `routes.ts` and individual route files are documented in `api-reference.md`. No undocumented endpoints were found. No documented-but-removed endpoints were found (the health endpoint response shape mismatch is covered by DOC-001).

### Architecture File Structure vs Actual Project
The `docs/architecture.md` file structure section (`src/` tree) accurately reflects the current project layout. All listed directories and files exist. The route module table matches `src/routes/index.ts` exports.
