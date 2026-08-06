# Consolidated Audit Report — 2026-08-06

**Date:** 2026-08-06
**Scope:** Full codebase (security, code quality, dependencies, performance, testing, documentation)
**Methodology:** 3 parallel audit tracks (security, quality+deps, perf+test+docs), direct file reads, grep-based tracing, code-path analysis
**Prior art:** Phase 10 security audit (2026-06-18, 15/15 closed), Ponytail cleanup (2026-07-13)

---

## Executive Summary

| Severity | Count | Key Areas |
|----------|-------|-----------|
| **HIGH** | 2 | Legacy JWT bypasses refresh rotation, write queue deadlock |
| **MEDIUM** | 7 | Socket.IO auth, restore race, Postgres migration injection, unused deps, DB proxy, cache growth, missing tests |
| **LOW** | 11 | Postgres pool shutdown, WAL cleanup, dual mounts, store complexity, docs mismatches |
| **INFO** | 4 | Session failure UX, doc inconsistencies |
| **N/A (resolved)** | 2 | Dead code confirmed cleaned |

**Total: 26 findings** (2 HIGH, 7 MEDIUM, 11 LOW, 4 INFO, 2 resolved)

The two HIGH findings require near-term remediation. The MEDIUM findings should be addressed in the next sprint. LOW/INFO items are advisory.

---

## HIGH Severity (2)

### SEC-001: Legacy 7-Day JWT Cookie Bypasses Refresh Token Rotation
- **Files:** `src/routes/auth.routes.ts:63–69`, `src/routes/middleware.ts:187`
- **Issue:** Every login issues a legacy 7-day JWT cookie alongside the new 1h access token + 7d refresh token. The `requireAuth` middleware accepts the legacy JWT, which is not affected by refresh token rotation or reuse detection. If a refresh family is revoked, the legacy JWT remains valid for 7 days.
- **Risk:** Stolen legacy JWT = 7-day auth bypass, immune to the security mechanism designed to limit token lifetime to 1 hour.
- **Fix:** Remove legacy cookie issuance or set sunset date. Revoke session (not just refresh family) on reuse detection. Have `verifySocketAuth` try `ACCESS_COOKIE_NAME` first.

### QUAL-001: Write Queue Lock Can Get Stuck Forever
- **File:** `src/db/writeQueue.ts`
- **Issue:** `processWriteQueue` sets `isProcessingWriteQueue = true` but has no `try/finally` around the while loop. An unexpected throw permanently freezes all write operations.
- **Risk:** Single unexpected error permanently blocks attendance saves, student CRUD, seating changes until server restart.
- **Fix:** Wrap the while loop in `try/finally` to guarantee lock release.

---

## MEDIUM Severity (7)

### SEC-003: Database Restore Write-Queue Race Condition
- **Files:** `src/routes/admin.routes.ts:60–107`
- **Issue:** Restore drains the write queue, then performs async operations (mkdir, copyFile, chunked read), then restores. Writes enqueued between drain and restore are silently lost.
- **Fix:** Add a restore lock that prevents new writes during restore window.

### SEC-004: PostgreSQL Migration Column-Name SQL Injection
- **File:** `src/db/auto-migrate.ts:156–180`
- **Issue:** `insertBatch` derives column names from `Object.keys(rows[0])` and interpolates them into SQL without quoting or validation. A malicious SQLite file with crafted column names could inject SQL.
- **Fix:** Validate column names against `/^[a-z_][a-z0-9_]*$/` or quote identifiers with PostgreSQL identifier quoting.

### SEC-005: Socket.IO Auth Uses Only Legacy Cookie Name
- **File:** `src/routes/middleware.ts:348–351`
- **Issue:** `verifySocketAuth` defaults to `AUTH_COOKIE_NAME` (legacy 7d JWT). After 7 days from last login, Socket.IO silently fails while HTTP API continues working via refreshed access tokens.
- **Fix:** Try `ACCESS_COOKIE_NAME` first, fall back to `AUTH_COOKIE_NAME`.

### QUAL-002: `react-window` and `react-virtualized-auto-sizer` Have Zero Imports
- **File:** `package.json`
- **Issue:** Both packages are in dependencies but have zero imports. ~50KB wasted bundle.
- **Fix:** `npm uninstall react-window react-virtualized-auto-sizer`.

### QUAL-004: DB Proxy Silently Returns `undefined` for Typos
- **File:** `src/db/index.ts`
- **Issue:** Proxy catch-all returns `undefined` for misspelled method names. TypeScript catches most cases but not dynamic access.
- **Fix:** Add dev-mode warning for unknown properties.

### PERF-001: Cache Has No Max Size
- **File:** `src/db/cache.ts`
- **Issue:** In-memory Map with TTL but no size cap. Stale entries accumulate between cleanup cycles (only cleaned on read).
- **Fix:** Add max entry count or periodic sweep.

### TEST-001: No Unit Tests for `refreshTokenService`
- **File:** `src/services/refresh-token.service.ts`
- **Issue:** The most security-critical service has zero dedicated unit tests. Only tested indirectly via integration tests.
- **Fix:** Add `src/services/__tests__/refresh-token.service.test.ts`.

---

## LOW Severity (11)

| ID | Title | File | Summary |
|----|-------|------|---------|
| SEC-002 | Profiling regex bypass (cosmetic) | `admin.routes.ts` | Comment tricks bypass regex, but EXPLAIN is read-only. No new attack surface. |
| SEC-006 | DB restore doesn't drain WAL/SHM | `src/db/index.ts` | Stale WAL files could persist. Add explicit cleanup before restore. |
| QUAL-003 | `useActiveStudents` export unused | `src/store.ts` | Dead export, never imported. |
| QUAL-005 | Monolithic store (33 actions) | `src/store.ts` | 8+ concerns in one file. Advisory — consider slice pattern. |
| QUAL-006 | Route dual-mount creates 2 paths | `routes.ts` | POST /api/ accessible via accidental root mount. |
| QUAL-009 | Duplicate overrides/resolutions | `package.json` | Cross-PM compat but error-prone to maintain. |
| QUAL-010 | `tsx` in production deps | `package.json` | Should be devDependency if transpiled first. |
| PERF-002 | PG pool never closed on shutdown | `src/lib/postgres.ts` | No shutdown hook calls `pool.end()`. |
| TEST-002 | 3 services lack unit tests | `src/services/` | setting, timetable, seating have no dedicated tests. |
| TEST-003 | Zero PG-specific test coverage | `src/lib/postgres.ts` | All tests run against SQLite only. |
| DOC-001 | Health endpoint docs mismatch | `docs/api-reference.md` | Docs show `uptime`/`timestamp` fields that were removed. |

## INFO Severity (4)

| ID | Title | Summary |
|----|-------|---------|
| SEC-007 | Session creation failure doesn't prevent login | Login succeeds but all subsequent requests 401. Confusing UX. |
| DOC-002 | `operations.md` missing from doc map | Referenced by 3 other docs but not in documentation-map.md. |
| DOC-003 | Admin /metrics response shape differs from docs | Documented fields don't match actual implementation. |
| DOC-004 | Service count inconsistency across docs | architecture.md says 12, developer-guide.md says 11. |

## Resolved (2)

| ID | Title | Status |
|----|-------|--------|
| QUAL-007 | CardSkeleton/TableRowSkeleton removed | Confirmed — ponytail cleanup applied. |
| QUAL-008 | src/services/index.ts barrel removed | Confirmed — root barrel exists and is load-bearing. |

---

## Clean Areas (No Findings)

| Area | Status |
|------|--------|
| CSRF protection (SameSite=strict) | ✅ Sufficient |
| Cookie security in LAN mode | ✅ Documented tradeoff |
| Socket.IO CORS vs Express CORS | ✅ In sync |
| Refresh token reuse detection atomicity | ✅ Correct |
| Rate limiter bypass in test mode | ✅ Standard practice |
| MetricsStore/ResourceMonitor capping | ✅ Properly bounded |
| Security test quality (27 files) | ✅ Thorough negative cases |
| API endpoint completeness | ✅ All routes documented |
| Architecture file structure | ✅ Accurate |
| Dead code: services, routes, components | ✅ All verified clean |
| Dependency versions | ✅ Current major tracks |

---

## Remediation Priority

### Immediate (before next release)
1. **QUAL-001:** Add `try/finally` to write queue — 2-line fix, prevents production deadlock
2. **SEC-005:** Fix Socket.IO auth cookie name — functional bug affecting realtime after 7 days

### Next Sprint
3. **SEC-001:** Remove or sunset legacy JWT cookie — highest security risk
4. **SEC-004:** Quote Postgres column names in migration — narrow but real injection surface
5. **SEC-003:** Add restore lock — prevents data loss during restore window
6. **QUAL-002:** Remove unused deps — bundle size win
7. **TEST-001:** Add refreshTokenService unit tests — security-critical coverage gap

### Backlog
8. All LOW/INFO items — advisory, address during regular maintenance

---

## Detailed Findings

Full details in the per-track reports:
- [Security Findings](audit-findings-security.md) (7 findings)
- [Code Quality & Dependency Findings](audit-findings-quality.md) (10 findings)
- [Performance, Testing & Documentation Findings](audit-findings-perf-test-docs.md) (9 findings)
