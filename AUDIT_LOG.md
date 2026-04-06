# Architecture Audit Log & Problem Register
**Project:** Teacher Assistant (Multi-User Migration)
**Date:** 2026-04-01
**Branch:** develop
**Auditor:** opencode AI

---

## HOW TO USE THIS FILE

This file contains ALL findings from the complete architecture audit. The next session should:
1. Read this file first to understand all known issues
2. Read `MIGRATION_PLAN.md` for the original migration scope
3. Continue fixing issues in priority order (Critical → Medium → Low)

---

## PROJECT OVERVIEW

Teacher Assistant is a local-first classroom management app built with:
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Zustand (state), React Query
- **Backend:** Express.js, better-sqlite3 (synchronous), JWT auth, bcrypt
- **Security:** Helmet, rate limiting, Zod validation, cookie-based auth
- **Features:** Attendance, roster, reports, timetable, seating chart, random picker, group generator, exam timer, gatekeeper, admin dashboard, multi-teacher support with invites

The app was migrated from single-user to multi-user support across 5 phases (12 tasks). All tasks are marked complete in MIGRATION_PLAN.md, but this audit found 14+ bugs and architectural issues.

---

## CRITICAL ISSUES (Must Fix Before Production)

### C1: Poll-Based Sync Is a No-Op After Initial Load
**Severity:** CRITICAL
**Files:** `src/store.ts:204`, `src/hooks/useData.ts:61-95`
**Problem:** The `useClassSync` hook polls every 30s to detect changes from other teachers. When a change is detected, it calls `loadClassData(classId)`. But `loadClassData` has this guard:
```typescript
if (!cls || cls.loaded) return;  // line 204
```
Since the class is already loaded after initial render, `cls.loaded === true`, so `loadClassData` immediately returns without fetching fresh data. **Multi-teacher real-time sync is completely broken.**

**Fix:** Either:
- Remove the `cls.loaded` guard and always refetch, OR
- Create a separate `reloadClassData()` method that bypasses the guard, OR
- Update the store data directly from the sync hook instead of calling loadClassData

---

### C2: updated_at Columns Never Populated
**Severity:** CRITICAL
**Files:** `db.ts:213-219`
**Problem:** The migration adds `updated_at` columns to 7 tables (students, attendance_records, events, timetable_slots, daily_notes, seating_layout, classes) but:
- No `DEFAULT CURRENT_TIMESTAMP` was set
- No `ON UPDATE` trigger was created
- No prepared statement includes `updated_at` in INSERT or UPDATE queries

**Result:** All `updated_at` values are NULL forever. Optimistic locking (Phase 1.4) is completely non-functional.

**Fix:** Add SQLite triggers for each table:
```sql
CREATE TRIGGER update_students_updated_at AFTER UPDATE ON students
BEGIN UPDATE students SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;
```
Or update all INSERT/UPDATE prepared statements to include `updated_at = CURRENT_TIMESTAMP`.

---

### C3: JWT Remains Valid After Session Revocation
**Severity:** CRITICAL
**Files:** `routes.ts:38-52`, `routes.ts:158-195`
**Problem:** Session revocation only checks the session in `requireAuth` middleware when a cookie is present. But:
1. The JWT itself (7-day expiry) is never invalidated
2. If a user sends the JWT via Authorization header instead of cookie, the session check is bypassed
3. The session check is wrapped in try/catch that silently ignores errors (line 41-51) — a DB failure means the revoked session passes through

**Result:** A revoked user can still access the API if they use the JWT directly. Force-logout is ineffective.

**Fix:** 
- Add session validation inside JWT verification, not just cookie middleware
- Make session check failures deny access (fail closed, not open)
- Consider shortening JWT expiry and implementing refresh tokens

---

## MEDIUM ISSUES (Should Fix)

### M1: Inconsistent Middleware Usage on Write Endpoints
**Severity:** MEDIUM
**Files:** `routes.ts:566-861`
**Problem:** `PUT /students/:id`, `PUT /events/:id`, `PUT /timetable/:id` do NOT use `requireClassAccess` middleware. They rely on inline checks via `getStudentById.get(studentId, teacherId)` etc. While the prepared statements now join via `class_teachers`, this pattern is inconsistent with all other endpoints that use the middleware.

**Risk:** Future developers might miss the inline check when modifying these endpoints.

---

### M2: Cache Invalidation Clears ALL Caches on Any Write
**Severity:** MEDIUM
**Files:** `db.ts:394`
**Problem:** `cacheInvalidate()` is called without a pattern after every write, clearing the entire cache. This means:
- Writing to class A invalidates cached data for class B, C, D...
- Writing a single setting invalidates all class data
- Under concurrent write load, the cache provides zero benefit

**Fix:** Implement namespace-aware invalidation. E.g., `cacheInvalidate('students:class_A')` only invalidates student-related cache for class A.

---

### M3: Cache Key Prefix Collision
**Severity:** MEDIUM
**Files:** `db.ts:433`
**Problem:** Pattern-based cache invalidation uses `key.startsWith(pattern)`. This means:
- `cacheInvalidate('classes:1')` would also invalidate `classes:10`, `classes:11`, etc.
- Current cache keys like `classes:${teacherId}` and `teachers:class:${classId}` could collide

**Fix:** Use delimiter-separated keys like `cache:classes:abc123:data` and search for `cache:classes:abc123:` (with trailing colon).

---

### M4: Session Check Silently Fails Open
**Severity:** MEDIUM
**Files:** `routes.ts:41-51`
**Problem:** The session validation in `requireAuth` is wrapped in try/catch with an empty catch block. If the database query fails (DB locked, connection issue, etc.), the request proceeds as if the session is valid.

**Fix:** On DB error, return 401 or 503 instead of silently passing.

---

### M5: Database Restore Bypasses Write Queue
**Severity:** MEDIUM
**Files:** `routes.ts:244-269`
**Problem:** `POST /database/restore` writes the database file directly without going through `db.enqueueWrite()`. If another write is in the queue simultaneously, this could corrupt the database or cause race conditions.

**Fix:** Drain the write queue before restoring, or use the `db.restore()` method which properly handles the connection.

---

### M6: Sync Fingerprint Only Checks Records and Events
**Severity:** MEDIUM
**Files:** `src/hooks/useData.ts:73-78`
**Problem:** The sync fingerprint only compares record count and event data:
```typescript
const fingerprint = `${records.length}:${events.length}:${events.length > 0 ? events[0].date : ''}`;
```
Changes to students, timetable, seating, or daily notes are NOT detected by the sync.

**Fix:** Include student count, timetable count, and seating hash in the fingerprint.

---

### M7: Reports and Excel Export Have O(n×m) Performance
**Severity:** MEDIUM
**Files:** `src/components/Reports.tsx:44-57`, `src/utils/excel.ts:130`
**Problem:** Both files use nested loops: for each student × each day in month × `records.find()`. With 30 students × 31 days × N records, this is extremely inefficient.

**Fix:** Pre-index records in a Map keyed by `${studentId}:${date}` for O(1) lookup.

---

### M8: Multiple Components Use Native alert() and confirm()
**Severity:** MEDIUM
**Files:** `src/components/Roster.tsx:38,511`, `src/components/Schedule.tsx:92,96`, `src/components/SeatingChart.tsx:39`
**Problem:** These native dialogs block the main thread, are not themeable, and are inconsistent with the rest of the app which uses react-hot-toast.

---

## LOW ISSUES (Nice to Fix)

### L1: Raw SQL Statement Created Inline in Role Management
**Severity:** LOW
**Files:** `routes.ts:529`
**Problem:** `PUT /classes/:classId/teachers/:teacherId/role` creates a raw SQL statement inline instead of using prepared statements:
```typescript
const updateStmt = db.prepare('UPDATE class_teachers SET role = ? WHERE class_id = ? AND teacher_id = ?');
```
This is inconsistent with all other endpoints that use `db.stmt.*`.

---

### L2: Dead Code in Timetable Module
**Severity:** LOW
**Files:** `src/components/Timetable/types.ts`
**Problem:** This file re-exports `TimetableSlot` from the store but is never imported by any other file. It's dead code.

---

### L3: Duplicate parseTime Function
**Severity:** LOW
**Files:** `src/components/Dashboard.tsx:10-20`, `src/components/Timetable/timetableUtils.ts`
**Problem:** `parseTime` is defined in both files. Dashboard should import from timetableUtils.

---

### L4: Dashboard Skeleton Loading Condition Is Dead Code
**Severity:** LOW
**Files:** `src/components/Dashboard.tsx:167`
**Problem:** `students.length === 0 && !isMounted` — `isMounted` is set to true in a useEffect on mount, so `!isMounted` is only true for a fraction of a millisecond. The skeleton never actually displays.

---

### L5: Event IDs Can Collide
**Severity:** LOW
**Files:** `src/components/Schedule.tsx:48`
**Problem:** Event IDs use `evt_${Date.now()}`. If two events are created in the same millisecond, IDs collide. Should use `crypto.randomUUID()`.

---

### L6: RandomPicker Interval Not Cleaned Up
**Severity:** LOW
**Files:** `src/components/RandomPicker.tsx:19-28`
**Problem:** The `setInterval` for the spinning animation is never cleaned up if the component unmounts during spinning. Also, calling `pickRandom` twice rapidly orphans the first interval.

---

### L7: ExamTimer Interval Recreation Anti-Pattern
**Severity:** LOW
**Files:** `src/components/ExamTimer.tsx:25-45`
**Problem:** The timer useEffect has `timerRemaining` in its dependency array, causing the interval to be torn down and recreated every second. Should use a ref-based approach.

---

### L8: Stopwatch Drift
**Severity:** LOW
**Files:** `src/components/ExamTimer.tsx:74-84`
**Problem:** The stopwatch uses `setInterval` at 10ms with incremental updates. Browser timer drift accumulates over time. Should use `Date.now()` delta for accuracy.

---

### L9: Gatekeeper Date Uses UTC Instead of Local
**Severity:** LOW
**Files:** `src/components/Gatekeeper.tsx:27`
**Problem:** `new Date().toISOString().split('T')[0]` returns UTC date, which differs from local date around midnight. Should use `date-fns` `format(new Date(), 'yyyy-MM-dd')`.

---

### L10: Invite Redeem Doesn't Verify Class Exists
**Severity:** LOW
**Files:** `routes.ts:450-481`
**Problem:** If a class is deleted between invite creation and redemption, the `insertClassTeacher` would fail due to FK constraint, but the error message would be confusing to the user.

---

### L11: Compound Index Creation May Silently Fail
**Severity:** LOW
**Files:** `db.ts:231-237`
**Problem:** Index creation for `idx_invite_codes_class_active` and `idx_user_sessions_teacher_active` is wrapped in try/catch. If the tables don't exist yet (race condition during migration), the indexes silently fail to be created.

---

### L12: No Click-Outside Handlers for Dropdowns
**Severity:** LOW
**Files:** `src/components/Roster.tsx`, `src/components/Schedule.tsx`, `src/components/Reports.tsx`, `src/components/Timetable/Timetable.tsx`
**Problem:** Multiple dropdown menus lack click-outside-to-close handlers. Users must click a specific element to close them.

---

### L13: Roster Add Row Column Misalignment
**Severity:** LOW
**Files:** `src/components/Roster.tsx:311-381`
**Problem:** The "add student" row has 4 `<td>` elements but the table header has 6 columns. Column alignment is broken.

---

### L14: Shared Edit State in Roster
**Severity:** LOW
**Files:** `src/components/Roster.tsx`
**Problem:** `editName`, `editRoll`, etc. are shared between add mode and edit mode. Starting to edit student A, then canceling and adding a new student could leak old values.

---

## CROSS-CUTTING ARCHITECTURAL CONCERNS

### 1. No Service/Repository Layer
Every component reads directly from the Zustand store. There's no abstraction layer between components and data. This makes:
- Testing harder (must mock the store)
- Future PostgreSQL migration harder (queries are scattered)
- Data transformation logic duplicated across components

### 2. Store Mutations Are Async but Not Atomic
Store actions like `addStudent` first call the API, then update local state. If the API succeeds but the state update fails (or vice versa), the UI and DB get out of sync.

### 3. No Request Deduplication
Multiple components can trigger the same API call simultaneously. React Query helps but not for Zustand-based store actions.

### 4. Error Handling Inconsistency
- Some endpoints return `{ error: 'message' }` (JSON)
- Some use the global error handler
- Some silently catch and ignore errors
- Frontend mixes `alert()`, `toast.error()`, and silent failures

### 5. No Input Sanitization Beyond Zod
Zod validates shape and length, but doesn't sanitize HTML entities, control characters, or other injection vectors. The app relies on React's automatic JSX escaping, which is fine for rendering but not for data stored in the DB.

### 6. Hardcoded Defaults in Multiple Places
- Default class creation in store.ts, routes.ts, and db.ts
- Default admin creation in db.ts (two places: lines 196-201 and 290-296)
- Default password hints scattered across files

### 7. Zero Native Dialogs Remaining (Session 2026-04-06)
- All 7 alert/confirm calls (M8 scope) replaced in prior session
- 9 additional alert/confirm calls in AdminDashboard.tsx + Sidebar.tsx replaced this session
- **Every `alert()`, `confirm()`, `window.confirm()` in src/ has been eliminated**
- All replaced with `react-hot-toast` custom JSX dialogs with proper dark mode support

---

## UNSTAGED CHANGES (Not Yet Committed)

### db.ts - Prepared Statement Teacher Isolation Refinement
The following prepared statements were updated to use `class_teachers` table instead of direct `teacher_id`:

| Statement | Before | After |
|-----------|--------|-------|
| `updateClass` | `WHERE id = ? AND teacher_id = ?` | `WHERE id = ? AND id IN (SELECT class_id FROM class_teachers WHERE teacher_id = ?)` |
| `deleteClass` | `WHERE id = ? AND teacher_id = ?` | `WHERE id = ? AND id IN (SELECT class_id FROM class_teachers WHERE teacher_id = ? AND role = 'owner')` |
| `getStudentById` | `JOIN classes c ON s.class_id = c.id WHERE ... c.teacher_id = ?` | `JOIN class_teachers ct ON s.class_id = ct.class_id WHERE ... ct.teacher_id = ?` (also returns full student data now) |
| `getEventById` | Same pattern as getStudentById | Same fix, returns full event data |
| `getTimetableSlotById` | Same pattern as getStudentById | Same fix, returns full timetable data |

**Status:** These changes are correct and should be committed.

---

## FIX PRIORITY ORDER

When continuing work, address issues in this order:

1. **C1** - Fix poll-based sync (store.ts:204) — multi-teacher collaboration is broken ✅ FIXED
2. **C2** - Populate updated_at columns (db.ts) — add triggers or update prepared statements ✅ FIXED
3. **C3** - Fix JWT session revocation (routes.ts) — security issue ✅ FIXED
4. **M1** - Standardize middleware on write endpoints ✅ FIXED (prepared statements already include class_teachers isolation)
5. **M2/M3** - Fix cache invalidation (namespace-aware) ✅ FIXED
6. **M4** - Fail closed on session check errors ✅ FIXED
7. **M5** - Protect database restore with write queue drain ✅ FIXED (drain queue + use db.restore())
8. **M6** - Expand sync fingerprint ✅ FIXED
9. **M7** - Optimize Reports/Excel nested loops ✅ FIXED (Map-indexed in Reports.tsx, excel.ts exportMonthlyReportToExcel, importAttendanceFromExcel, exportClassData)
10. **M8** - Replace alert/confirm with toast/modals ✅ FIXED (7 calls replaced with toast.confirm patterns in Roster.tsx, Schedule.tsx, SeatingChart.tsx)
11. **L1** - Use prepared statement for role management ✅ FIXED (added updateClassTeacherRole to db.stmt)
12. **L5** - Use crypto.randomUUID() for event IDs ✅ FIXED
13. **L6** - RandomPicker interval cleanup ✅ FIXED (useRef + useEffect cleanup + guard against double-pick)
14. **L7** - ExamTimer interval recreation anti-pattern ✅ FIXED (ref-based timerRemaining, no dependency on state in useEffect)
15. **L8** - Stopwatch drift ✅ FIXED (Date.now() delta approach with accumulated time)
  16. **L9** - Gatekeeper date uses UTC instead of local ✅ FIXED (use format(new Date(), 'yyyy-MM-dd') from date-fns)
  17. **L2** - Dead code in Timetable/types.ts ✅ FIXED (file deleted, no imports)
  18. **L3** - Duplicate parseTime function ✅ FIXED (Dashboard.tsx imports from timetableUtils)
  19. **L4** - Dashboard skeleton loading dead code ✅ FIXED (removed isMounted state and skeleton branch)
  20. **L10** - Invite redeem doesn't verify class exists ✅ FIXED (added getClassById check before granting access)
  21. **L11** - Compound index creation order ✅ FIXED (moved invite_codes and user_sessions indexes after table creation)
  22. **L12** - No click-outside handlers for dropdowns — ✅ FIXED (created useClickOutside.ts hook, applied to Roster, Schedule, Reports, Timetable/ExportMenu)
  23. **L13** - Roster add row column misalignment ✅ FIXED (added missing checkbox column td)
  24. **L14** - Shared edit state in Roster ✅ FIXED (separate add* and edit* state variables)

---

## FILES TO KNOW

| File | Purpose |
|------|---------|
| `db.ts` | Database schema, prepared statements, write queue, cache layer |
| `routes.ts` | All API endpoints, auth middleware, rate limiting |
| `server.ts` | Express server setup, Vite middleware, error handling |
| `src/store.ts` | Zustand state management, all CRUD actions |
| `src/hooks/useData.ts` | React Query hooks, useClassSync poll hook |
| `src/App.tsx` | Main app component, routing, auth flow |
| `src/lib/api.ts` | Frontend API client (fetch wrapper) |
| `src/lib/validation.ts` | Zod schemas for server-side validation |
| `src/lib/errorHandler.ts` | Express error middleware |
| `src/utils/excel.ts` | Excel import/export utilities |
| `src/utils/cn.ts` | Tailwind class merging utility |
| `MIGRATION_PLAN.md` | Original migration plan with phases and checklist |

---

## SESSION NOTES

- Last session was auditing all 5 phases of the multi-user migration
- All 12 tasks in MIGRATION_PLAN.md are marked complete but have implementation gaps
- Unstaged changes in db.ts are correct and ready to commit
- The most impactful fix is C1 (sync bug) — without it, multi-teacher support doesn't actually work
- The app is on `develop` branch, 7 commits ahead of `origin/develop`
- No changes have been pushed to remote yet

### Session 2026-04-06: Verification + Remaining Fixes
- Started: Cloned `develop` branch from origin, found it was fully up to date with all 35 audit fixes committed
- Verified all 35 fixes (C1-C3, M1-M8, L1-L11, L13-L14) are correctly implemented in code
- Only remaining audit finding: L12 (click-outside handlers)
- Created `src/hooks/useClickOutside.ts` reusable hook — clean, minimal, uses mousedown+touchstart events
- Applied click-outside to 4 dropdown menus: Roster, Schedule, Reports, Timetable/ExportMenu
- Committed L12 fix: `9b208a5` → pushed to origin/develop
- Discovered 10 more alert/confirm calls outside M8 scope (AdminDashboard 9, Sidebar 1)
- Replaced all with react-hot-toast custom JSX dialogs, including nested two-step confirmation for data reset
- Committed remaining alert/confirm fix: `edf52a7` → pushed to origin/develop
- Zero alert/confirm/window.confirm calls remain in src/
- TypeScript compiles cleanly throughout
- Updated MIGRATION_PLAN.md (added items 36-37 to checklist)
- Updated AUDIT_LOG.md (marked L12 as fixed, added cross-cutting concern #7)

### Git State (End of Session 2026-04-06)
- Branch: develop (clean, nothing uncommitted)
- Local and origin/develop are in sync
- Latest commit: `edf52a7`
- Git config: user.email=richiesamlie@users.noreply.github.com, user.name=richiesamlie (set locally in this repo)
