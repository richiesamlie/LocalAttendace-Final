# Audit Plan — 2026-08-06

**Scope:** Full codebase security, code quality, dependency, performance, testing, and documentation audit.
**Prior art:** Phase 10 security audit (2026-06-18, 15/15 closed), Ponytail cleanup (2026-07-13, dead code + unused deps).
**Tech stack:** Express 4.22, better-sqlite3 12, pg 8.22, React 19, Zustand 5, Socket.IO 4, Zod 4, bcrypt, JWT (HS256), Helmet, express-rate-limit.

---

## Phase 1: Security

### 1.1 Profiling Endpoint SQL Injection Surface
- **Files:** `src/routes/admin.routes.ts` (lines ~155-175), `src/db/profiling.ts`
- **Risk:** `POST /api/admin/profiling/query` passes user SQL into `EXPLAIN QUERY PLAN ${sql}`. Gated by admin auth + regex (`/^select\b/i`, no semicolons). Need to verify: (a) the regex is actually un-bypassable, (b) `EXPLAIN QUERY PLAN` cannot be used for data exfiltration (it can't — it only returns the plan, not data), (c) error messages don't leak schema.
- **Verify:** Can the regex be bypassed? E.g. `SELECT 1 FROM (SELECT ...)` CTE tricks, `SELECT` in a comment, Unicode tricks. Does the function catch all mutation patterns?
- **Severity:** MEDIUM (admin-only, read-only context, but defense-in-depth gap).

### 1.2 Database Restore Binary Trust
- **Files:** `src/routes/admin.routes.ts` (lines ~62-103)
- **Risk:** Restore accepts raw binary, validates only `SQLite format 3` magic bytes + 100-byte minimum, then writes directly to disk and re-inits the DB. No integrity hash, no size sanity beyond 25MB.
- **Verify:** Can a crafted SQLite file trigger unexpected behavior during re-init? Are there any prepared statement recompilation races? What happens if restore is called while writes are queued?
- **Severity:** MEDIUM (admin-only, but the file becomes the entire DB).

### 1.3 Auth & Session Security Deep-Dive
- **Files:** `src/routes/auth.routes.ts`, `src/routes/middleware.ts`, `src/services/refresh-token.service.ts`
- **Areas:**
  - Refresh token rotation: verify reuse detection actually revokes the family atomically.
  - Legacy 7d JWT cookie: still set on every login — is there a sunset plan?
  - Session creation in login: does the try/catch around session creation allow login to succeed even if session record fails?
  - `verifySocketAuth`: does it properly reject expired/revoked tokens?
  - Rate limiter bypass in test mode: does `NODE_ENV=test` ever leak into production?
- **Severity:** HIGH (auth is the #1 attack surface).

### 1.4 PostgreSQL Migration SQL Injection
- **Files:** `src/db/auto-migrate.ts`, `src/lib/postgres.ts`
- **Risk:** Auto-migrate reads all rows from SQLite and inserts into Postgres. Need to verify: (a) column names are not user-controlled, (b) batch inserts use parameterized queries, (c) no string interpolation of values.
- **Verify:** Trace the data path from SQLite read → Postgres insert. Are there any string concatenation points?
- **Severity:** MEDIUM (one-time migration, but if triggered maliciously could corrupt data).

### 1.5 Cookie & CSRF Configuration
- **Files:** `src/routes/middleware.ts`, `server.ts`
- **Areas:**
  - `__Host-` prefix only applies when `COOKIE_SECURE=true`. On LAN deployments with `COOKIE_SECURE=false`, cookies lack `Secure` flag and `__Host-` prefix — acceptable tradeoff but should be documented as a risk.
  - No explicit CSRF token — relies on SameSite cookie attribute + CORS origin allowlist. Is SameSite=Lax set? (Check cookie options in auth.routes.ts).
  - Socket.IO handshake uses cookie-based JWT but origin allowlist is separate from CORS — verify they're in sync.
- **Severity:** MEDIUM.

---

## Phase 2: Code Quality

### 2.1 Dead Code & Unused Exports
- **Files:** All `src/` files
- **Action:** Run a fresh dead-code scan. Check for:
  - Unused exports across all modules
  - Unused imports within files
  - Dead route handlers (registered but never called by frontend)
  - Components defined but not lazy-loaded in App.tsx
- **Verify:** `grep` for export names across the codebase.
- **Severity:** LOW (maintenance debt).

### 2.2 DB Proxy Pattern Review
- **Files:** `src/db/index.ts`
- **Risk:** Uses `new Proxy({}, ...)` to forward all property access to the raw `_db` instance. This means any typo in a method call silently returns `undefined` instead of throwing. The `restore`, `stmt`, `enqueueWrite`, and `cache` properties are special-cased.
- **Verify:** Is the Proxy necessary? Could it be replaced with a simpler facade? What happens if someone calls `db.prepare` vs `db.stmt.someStatement`?
- **Severity:** LOW (correctness concern, not security).

### 2.3 Frontend Store Complexity
- **Files:** `src/store.ts` (747+ lines), `src/hooks/useData.ts` (12.9KB)
- **Risk:** Monolithic Zustand store with many actions. Hard to reason about state transitions. Not a security issue but a maintainability risk.
- **Action:** Count actions, identify any that could be split into slices.
- **Severity:** LOW.

### 2.4 Route Dual-Mount Conflicts
- **Files:** `routes.ts`
- **Risk:** 5 routers (`recordRouter`, `noteRouter`, `eventRouter`, `timetableRouter`, `seatingRouter`) are mounted on both `/` and their resource prefix. Express processes mounts in order — verify no shadowing or double-execution.
- **Verify:** Trace a sample request through both mounts. Does the middleware run twice?
- **Severity:** LOW-MEDIUM (functional correctness).

### 2.5 Write Queue Correctness
- **Files:** `src/db/writeQueue.ts`
- **Risk:** Boolean lock `isProcessingWriteQueue`. If a write throws after `shift()`, the error propagates via `reject()` but the queue continues. If `processWriteQueue` itself throws (unlikely but possible), `isProcessingWriteQueue` stays `true` forever → deadlocked queue.
- **Verify:** Add try/finally around the while loop to ensure the lock is always released.
- **Severity:** MEDIUM (affects all write operations).

---

## Phase 3: Dependencies

### 3.1 Unused Dependencies
- **Files:** `package.json`
- **Action:** Check `motion` and `recharts` — were they removed in the ponytail audit? Verify current state. Scan for any other deps with zero imports.
- **Verify:** `grep` each dependency name across `src/`.
- **Severity:** LOW.

### 3.2 Vulnerability Scan
- **Action:** Run `npm audit --omit=dev --audit-level=high` and `bun audit --audit-level=high`. Check for known CVEs in all runtime deps.
- **Verify:** Zero HIGH/CRITICAL findings.
- **Severity:** HIGH (if findings exist).

### 3.3 Version Pinning
- **Files:** `package.json`, `package-lock.json`, `bun.lock`
- **Action:** Verify lock files are in sync. Check if any deps use `^` ranges that could pull in breaking changes.
- **Severity:** LOW.

---

## Phase 4: Performance

### 4.1 Cache Unbounded Growth
- **Files:** `src/db/cache.ts`
- **Risk:** In-memory `Map` with TTL-based expiry but no size cap. Under sustained load, stale entries accumulate between cleanup cycles (cleanup only happens on `cacheGet` calls). No periodic eviction.
- **Verify:** Is there a max size? What happens with 10k+ keys?
- **Severity:** LOW-MEDIUM (memory growth over time).

### 4.2 Memory Leak Surfaces
- **Files:** `src/middleware/resourceMonitor.ts`, `src/middleware/metricsStore.ts`, `src/db/profiling.ts`
- **Risk:** 
  - ResourceMonitor stores `maxSamples` (default 1000) in a circular buffer — OK.
  - MetricsStore stores `bufferSize` (default 10000) metrics — OK, but verify rotation.
  - `profileAllStatements` (if still exists) may have been removed per ponytail audit — verify.
- **Severity:** LOW.

### 4.3 PostgreSQL Pool Configuration
- **Files:** `src/lib/postgres.ts`
- **Status:** Lazy-init was applied in ponytail audit. Verify the pool is properly closed on shutdown. Check if `pool.end()` is called in any shutdown hook.
- **Severity:** LOW.

---

## Phase 5: Testing

### 5.1 Coverage Gaps
- **Action:** Run `npm run test:coverage` and identify uncovered lines in critical paths.
- **Focus areas:** Auth routes, refresh token rotation, database restore, write queue, cache.
- **Severity:** MEDIUM.

### 5.2 Security Test Completeness
- **Files:** `src/test/security/` (27 test files)
- **Action:** Verify each security test actually asserts the expected behavior (not just "doesn't throw"). Check for:
  - Tests that only test the happy path
  - Tests with missing negative cases
  - Tests that mock away the thing they're supposed to test
- **Severity:** MEDIUM.

### 5.3 PostgreSQL Test Coverage
- **Risk:** All tests run against SQLite. No Postgres-specific integration tests exist.
- **Verify:** Are the Postgres codepaths (`isPostgres()` branches in services) exercised at all?
- **Severity:** MEDIUM (Postgres is opt-in but fully supported per docs).

---

## Phase 6: Documentation

### 6.1 Doc Accuracy vs Code
- **Files:** `docs/api-reference.md`, `docs/architecture.md`, `docs/developer-guide.md`
- **Action:** Spot-check API endpoints documented vs actual routes. Verify architecture diagrams match current structure.
- **Severity:** LOW.

### 6.2 Stale References
- **Action:** Check for references to removed files, old audit plans, deprecated patterns.
- **Verify:** `docs/check-doc-links.mjs` output.
- **Severity:** LOW.

---

## Execution Order

```
Phase 1 (Security)     ← highest priority, run first
Phase 3 (Dependencies) ← quick, can run in parallel with Phase 1
Phase 2 (Code Quality) ← after security
Phase 4 (Performance)  ← after code quality
Phase 5 (Testing)      ← after all code changes
Phase 6 (Documentation) ← last
```

## Risk Summary

| Risk Level | Count | Areas |
|-----------|-------|-------|
| HIGH | 2 | Auth deep-dive, dependency CVEs |
| MEDIUM | 7 | Profiling SQLi, restore trust, Postgres migration, CSRF, write queue, coverage gaps, PG tests |
| LOW | 8 | Dead code, DB Proxy, store complexity, route mounts, cache growth, memory leaks, PG pool, docs |

## Acceptance Criteria

- [ ] All HIGH risks investigated and resolved or documented with mitigation
- [ ] All MEDIUM risks investigated, findings filed, and remediation plan created
- [ ] Security test suite passes (`npm run test:critical`)
- [ ] Full test suite passes (`npm test`)
- [ ] `npm audit` and `bun audit` show 0 HIGH/CRITICAL
- [ ] TypeScript check passes (`npm run lint`)
- [ ] ESLint passes (`npm run lint:eslint -- --max-warnings=0`)
- [ ] Findings document written with severity, evidence, and remediation steps
