# Migration Plan: Teacher Assistant to Multi-User Support

## Version: 1.2
## Last Updated: 2026-04-06
## Branch: develop

---

## Overview

This document outlines the complete migration plan to scale Teacher Assistant from a single-user personal tool to a multi-user system suitable for departmental/school-wide deployment (10-50+ concurrent users).

---

## Current Architecture Analysis

### Database Layer (db.ts) - ALREADY WAL-ENABLED ✅
- WAL mode enabled for concurrent reads
- Connection timeout: 5000ms
- Optimized pragmas: synchronous=NORMAL, cache_size=64MB, temp_store=MEMORY, mmap_size=256MB
- Pre-compiled statements for performance
- Periodic WAL checkpoint every 60s

### API Layer (routes.ts) ✅ + ⚠️
- Rate limiting implemented (auth: 5 attempts/15min, POST: 100/15min)
- JWT-based authentication with 7-day expiry
- Prepared statements (SQL injection safe)
- ⚠️ NO connection pooling (single connection)
- ⚠️ NO request queuing
- ⚠️ Teacher isolation NOT verified in all queries

### Frontend (React + Zustand) ✅
- Zustand store for local state management
- API calls via fetch to /api endpoints

---

## Migration Phases

### PHASE 1: Foundation (Required for ANY multi-user)

**Goal:** Secure the architecture so ANY multi-user scenario works correctly.

#### 1.1 Teacher Isolation in ALL Queries (CRITICAL)
- **Problem:** Currently only verifies teacher owns the CLASS, not that they have access to the specific data
- **Solution:** ALL queries must verify class access via `class_teachers` table
- **Files:** `routes.ts`
- **Impact:** High - security fix

```sql
-- BEFORE (current - dangerous for multi-user)
SELECT * FROM students WHERE class_id = ?

-- AFTER (required for multi-user)
SELECT * FROM students 
WHERE class_id = ? 
AND class_id IN (SELECT class_id FROM class_teachers WHERE teacher_id = ?)
```

#### 1.2 Connection Pooling
- **Problem:** Single connection cannot handle concurrent requests
- **Solution:** Implement connection pool with better-sqlite3
- **Files:** `db.ts`
- **Impact:** Medium - performance

#### 1.3 Request Queueing for Writes
- **Problem:** Concurrent writes cause DB lock contention
- **Solution:** Serialize write operations while allowing concurrent reads
- **Files:** `routes.ts` (middleware)
- **Impact:** Medium - reliability

#### 1.4 Add updated_at for Optimistic Locking
- **Problem:** No way to detect if data changed since last read
- **Solution:** Add timestamp columns for conflict detection
- **Files:** `db.ts` (schema), `routes.ts` (updates)
- **Impact:** Low - data integrity

---

### PHASE 2: Multi-Teacher Support

**Goal:** Enable multiple teachers to collaborate on same classes.

#### 2.1 Role-Based Access Control
- **Roles:** owner, admin, teacher, assistant
- **Implementation:** Add role column to class_teachers table

#### 2.2 Invite System
- **Flow:** 
  1. Owner generates invite link/code
  2. New teacher registers with code
  3. System links them to class
- **Files:** New routes + UI components

#### 2.3 Session Management
- **Purpose:** Track active sessions per teacher
- **Features:** Device naming, active sessions list, force logout

---

### PHASE 3: Real-Time Data Sync

**Goal:** Teachers see each other's changes without manual refresh.

#### 3.1 Poll-Based Sync (Simple)
- **Implementation:** Refresh data every 30-60 seconds
- **Files:** `store.ts` (polling hook)
- **Complexity:** Low

#### 3.2 WebSocket (Future - if needed)
- **Only if:** Poll-based insufficient for use case
- **Complexity:** High

---

### PHASE 4: Performance at Scale

**Goal:** Support 10-50+ concurrent users.

#### 4.1 Query Optimization
- Add compound indexes for common patterns
- Optimize expensive queries

#### 4.2 Caching Layer
- Cache frequently accessed data in memory

#### 4.3 Batch Operations
- Optimize bulk inserts/updates

---

### PHASE 5: PostgreSQL Migration (Future)

**Goal:** If SQLite limits reached (50+ concurrent users), migrate to PostgreSQL.

#### 5.1 Data Layer Abstraction ✅ COMPLETE
- Created repository interfaces in `src/repositories/`
- Created SQLite implementations for each repository
- Created repository factory/container for easy swapping
- Ready for PostgreSQL implementations when needed

#### 5.2 Keep API Same ✅ COMPLETE
- Route handlers (routes.ts) are database-agnostic
- All DB queries go through db.prepare() statements in db.ts
- Switching to PostgreSQL only requires:
  - New repository implementations (done)
  - No changes to route handlers
- API contract remains the same

#### 5.3 PostgreSQL Migration ✅ COMPLETE
- Created all 7 PostgreSQL repository implementations
- Created `postgres.ts` with connection pool
- Created `schema.sql` with full database schema
- Updated `.env.example` with `DATABASE_URL`

#### 5.4 Service Layer with DB Switching 🟡 IN PROGRESS
- Created `services.ts` - unified service layer with SQLite/PostgreSQL switching
- Uses `DB_TYPE` env var (`sqlite` or `postgres`)
- All service methods check DB_TYPE and route to appropriate implementation
- PostgreSQL queries use `pg` library with connection pool
- SQLite uses existing `db.stmt.*` prepared statements

#### 5.5 Routes Refactor ✅ COMPLETE
- Refactored middleware (requireAuth, requireClassAccess, requireClassOwner, requireRole) to use services
- Refactored all endpoints (teachers, classes, students, records, events, timetable, seating, notes, settings, invites, sessions) to use services
- All 69 db.stmt.* calls replaced with service layer calls
- Full PostgreSQL support: switch with `DB_TYPE=postgres`
- Ready to switch: `createRepositoryContainer('postgres')`

---

## Implementation Checklist

| # | Task | Phase | Files | Status |
|---|------|-------|-------|--------|
| 1 | Teacher Isolation - ALL queries verify class access | 1.1 | routes.ts | ✅ |
| 2 | Connection Pooling | 1.2 | db.ts | ✅ |
| 3 | Request Queueing for Writes | 1.3 | routes.ts | ✅ |
| 4 | Add updated_at columns | 1.4 | db.ts | ✅ |
| 5 | Role-Based Access Control | 2.1 | db.ts, routes.ts | ✅ |
| 6 | Invite System API | 2.2 | routes.ts | ✅ |
| 7 | Invite System UI | 2.2 | React components | ✅ |
| 8 | Session Management | 2.3 | db.ts, routes.ts | ✅ |
| 9 | Poll-Based Sync | 3.1 | useData.ts, App.tsx | ✅ |
| 10 | Query Optimization | 4.1 | db.ts | ✅ |
| 11 | Caching Layer | 4.2 | db.ts, routes.ts | ✅ |
| 12 | Batch Operations | 4.3 | routes.ts | ✅ |
| 13 | Audit: Fix poll-based sync no-op bug (C1) | Audit | store.ts, useData.ts | ✅ |
| 14 | Audit: Add updated_at SQLite triggers (C2) | Audit | db.ts | ✅ |
| 15 | Audit: Fix JWT session revocation bypass (C3) | Audit | routes.ts | ✅ |
| 16 | Audit: Add teacher isolation to UPDATE/DELETE (M1) | Audit | db.ts, routes.ts | ✅ |
| 17 | Audit: Namespace-aware cache invalidation (M2/M3) | Audit | db.ts, routes.ts | ✅ |
| 18 | Audit: Fail-closed session check errors (M4) | Audit | routes.ts | ✅ |
| 19 | Audit: Expand sync fingerprint coverage (M6) | Audit | useData.ts | ✅ |
| 20 | Audit: Optimize Reports/Excel O(n×m) loops (M7) | Audit | Reports.tsx, excel.ts | ✅ |
| 21 | Audit: Fix database restore write queue bypass (M5) | Audit | routes.ts | ✅ |
| 22 | Audit: Replace alert/confirm with toast/modals (M8) | Audit | Roster.tsx, Schedule.tsx, SeatingChart.tsx | ✅ |
| 23 | Audit: Use prepared statement for role management (L1) | Audit | db.ts, routes.ts | ✅ |
| 24 | Audit: Use crypto.randomUUID() for event IDs (L5) | Audit | Schedule.tsx | ✅ |
| 25 | Audit: RandomPicker interval cleanup (L6) | Audit | RandomPicker.tsx | ✅ |
| 26 | Audit: ExamTimer interval recreation fix (L7) | Audit | ExamTimer.tsx | ✅ |
| 27 | Audit: Stopwatch drift fix (L8) | Audit | ExamTimer.tsx | ✅ |
| 28 | Audit: Gatekeeper local date fix (L9) | Audit | Gatekeeper.tsx | ✅ |
| 29 | Audit: Remove dead code Timetable/types.ts (L2) | Audit | types.ts | ✅ |
| 30 | Audit: Deduplicate parseTime in Dashboard (L3) | Audit | Dashboard.tsx | ✅ |
| 31 | Audit: Remove Dashboard skeleton dead code (L4) | Audit | Dashboard.tsx | ✅ |
| 32 | Audit: Invite redeem verify class exists (L10) | Audit | routes.ts | ✅ |
| 33 | Audit: Fix compound index creation order (L11) | Audit | db.ts | ✅ |
| 34 | Audit: Fix Roster add row column misalignment (L13) | Audit | Roster.tsx | ✅ |
| 35 | Audit: Separate add/edit state in Roster (L14) | Audit | Roster.tsx | ✅ |
| 36 | Audit: Click-outside handlers for dropdowns (L12) | Audit | Roster.tsx, Schedule.tsx, Reports.tsx, Timetable/ExportMenu.tsx | ✅ |
| 37 | Audit: Replace ALL alert/confirm with toast dialogs (full sweep) | Audit | AdminDashboard.tsx, Sidebar.tsx | ✅ |
| 38 | Cross-cutting #4: Fix api.ts error parsing, standardize catch blocks, verify store consistency | Audit | src/lib/api.ts, routes.ts, src/store.ts | ✅ |
| 39 | Cross-cutting #2: Wrap loadClassData/reloadClassData in try/catch, clean up clearData | Audit | src/store.ts | ✅ |
| 40 | Cross-cutting #5: Add input sanitization (trim + null byte strip) to all Zod string schemas | Audit | src/lib/validation.ts | ✅ |
| 41 | Cross-cutting #6: Consolidate hardcoded defaults to single source in db.ts | Audit | db.ts, src/store.ts | ✅ |

---

## Risk Mitigation

| Risk | Mitigation Strategy |
|------|---------------------|
| Query injection via classId | ALWAYS verify class ownership via class_teachers |
| Race conditions | Add updated_at checks + serialize writes |
| Lost writes | Use write queue to prevent DB locks |
| Performance degradation | Monitor with request timing logs |
| Data loss on migration | Full backup before any schema change |

---

## Testing Strategy

### Unit Tests
- Test each new DB function
- Test API endpoint security (verify isolation)

### E2E Tests (Existing)
- Already have comprehensive test suite
- Add tests for multi-teacher scenarios

### Performance Tests
- Load test with multiple concurrent users
- Measure response times under load

---

## Codebase Reference

### Key Files to Modify

| File | Purpose | Changes Needed |
|------|---------|----------------|
| `db.ts` | Database layer | Schema changes, connection pool, prepared statements |
| `routes.ts` | API endpoints | All queries need teacher isolation, new routes for invites/sessions |
| `store.ts` | Frontend state | Add polling, session management |
| `Sidebar.tsx` | Navigation | Add invite UI |
| `InviteTeacherModal.tsx` | New component | Invite system UI |

### Key Tables

| Table | Purpose | Changes |
|-------|---------|---------|
| `teachers` | Teacher accounts | Add last_login, device_info |
| `classes` | Class metadata | Add updated_at |
| `students` | Student records | Add updated_at |
| `attendance_records` | Attendance data | Add updated_at |
| `class_teachers` | Teacher-class access | Add role column, session tracking |
| `user_sessions` | (NEW) Active sessions | New table for session management |

---

## Notes

- **Session 2026-04-06: Cross-cutting concerns #4, #2, #5, #6**
  - **#4 Error Handling Consistency:** Fixed `src/lib/api.ts` to parse JSON error body on failed responses (preserves server error message). Added logging to empty catch in session tracking (`routes.ts`). Clarified intentional empty catch in `getTeacherId`. Fixed `setStudents` rollback pattern and `toggleTheme` missing try/catch in `src/store.ts`.
  - **#2 Atomic Store Mutations:** Wrapped `loadClassData` and `reloadClassData` in try/catch with error logging. Cached `className` before API calls in `clearData` to avoid stale lookup mid-operation. All 22 async store actions now follow consistent try/API/then/catch pattern.
  - **#5 Input Sanitization:** Created `safeString()` helper in `validation.ts` that chains `transform(sanitizeString)` with min/max validation. Strips null bytes (`\x00`) and trims whitespace on all string fields across all 8 Zod schemas.
  - **#6 Hardcoded Defaults:** Extracted `DEFAULTS` constant object in `db.ts` (TEACHER_ID, TEACHER_USERNAME, TEACHER_NAME, CLASS_ID, CLASS_NAME). Created single `getDefaultPassword()` function. Both admin creation locations in db.ts now use constants. store.ts uses matching local constants — `clearAllData` creates `'My First Class'` instead of inconsistent `'Default Class'`.
  - Commits pushed to origin/develop: `a1f8eb8` (#4), `298f7a3` (#2), `687abb5` (#5+#6)

- **Session 2026-04-06: Audit verification + remaining fixes**
  - Verified all 35 audit fixes (C1-L14) were properly committed and pushed in prior sessions
  - Fix L12: Created `src/hooks/useClickOutside.ts` reusable hook, applied to all 4 dropdown menus (Roster, Schedule, Reports, Timetable/ExportMenu)
  - Full alert/confirm sweep: Replaced ALL remaining alert()/confirm() in AdminDashboard.tsx (9 calls) and Sidebar.tsx (1 call) with react-hot-toast
  - Zero alert(), confirm(), or window.confirm() calls remain in entire src/ directory
  - Git config set locally: user.email=richiesamlie@users.noreply.github.com, user.name=richiesamlie
  - Commits pushed to origin/develop: `9b208a5` (L12 click-outside) and `edf52a7` (all remaining alert/confirm)

- **Phase 1.1 COMPLETED** - All class-scoped endpoints now use `requireClassAccess` middleware
  - Added new middleware: `requireClassAccess(paramName)` - verifies teacher has access via class_teachers table
  - Added new middleware: `requireClassOwner(paramName)` - verifies teacher is owner (for admin actions)
  - Updated: students, records, daily-notes, events, timetable, seating endpoints
- **Post-Audit Fixes (Session 2026-04-01)** - All critical and medium issues from architecture audit fixed:
  - C1: Poll-based sync now uses `reloadClassData()` instead of broken `loadClassData()` guard
  - C2: SQLite triggers auto-populate `updated_at` on all 7 tables (optimistic locking now functional)
  - C3: JWT session revocation enforced; errors fail closed instead of silently passing
  - M1: UPDATE/DELETE prepared statements now include `class_teachers` isolation (TOCTOU fix)
  - M2/M3: Cache invalidation uses namespace-delimited keys (`classes:X:`) instead of blanket clear
  - M4: Session check errors return 401/503 instead of silently allowing access
  - M5: Database restore drains write queue and uses `db.restore()` instead of raw `fs.writeFileSync`
  - M6: Sync fingerprint expanded to cover students, timetable, seating (not just records/events)
  - M7: Reports and Excel export use Map-indexed records (O(n) instead of O(n×m))
  - M8: All 7 `alert`/`confirm` calls replaced with `react-hot-toast` confirmation dialogs
  - L1: Role management uses `db.stmt.updateClassTeacherRole` prepared statement
  - L5: Event IDs use `crypto.randomUUID()` instead of `Date.now()`
  - L6: RandomPicker interval properly cleaned up on unmount and guarded against double-pick
  - L7: ExamTimer uses ref-based countdown (no interval recreation on state change)
  - L8: Stopwatch uses `Date.now()` delta to prevent timer drift
  - L9: Gatekeeper uses `format(new Date(), 'yyyy-MM-dd')` for local date instead of UTC
  - L2: Removed dead code `Timetable/types.ts` (unused re-export)
  - L3: Dashboard now imports `parseTime` from `timetableUtils` instead of duplicating it
  - L4: Removed dead skeleton loading state from Dashboard (`isMounted` never used)
  - L10: Invite redeem now verifies class exists before granting access
  - L11: Compound indexes for `invite_codes` and `user_sessions` moved after table creation
  - L13: Roster add row now has 6 `<td>` cells matching 6 header columns
  - L14: Separate `add*` and `edit*` state in Roster to prevent value leakage between modes
- Current e2e tests work but can have flaky runs when all tests share DB (expected)
- Keep main branch clean, all changes on `develop` branch
- Test each phase thoroughly before moving to next

---

## Future Considerations

- Docker deployment for easier scaling
- Cloud backup (already partially implemented)
- Mobile-responsive UI (already done)