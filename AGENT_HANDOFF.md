# Agent Handoff — Teacher Assistant Project

**Last Session:** 2026-04-06 12:00 PM
**Current Branch:** `develop` — fully synced with `origin/develop`
**Latest Commit:** `687abb5` (fix(#5,#6): add input sanitization to Zod schemas, consolidate hardcoded defaults)
**Repo:** https://github.com/richiesamlie/LocalAttendace-Final/tree/develop
**Local Path:** `/home/richiesamlie/LocalAttendace-Final`

---

## TABLE OF CONTENTS

1. Project Overview
2. Tech Stack & Dependencies
3. File Map with Line Counts
4. Architecture Deep Dive
   4.1 Database Schema
   4.2 Backend API (routes.ts)
   4.3 Frontend State (store.ts)
   4.4 API Client (api.ts)
   4.5 Frontend Components
   4.6 Server Setup (server.ts)
   4.7 Validation (validation.ts)
   4.8 Error Handling (errorHandler.ts)
5. Completed Work (41 Audit Items + Beyond)
6. Migration Plan Status (All 41 items ✅)
7. Remaining Cross-Cutting Concerns (2 items)
8. How The App Works End-to-End
9. Common Patterns & Gotchas
10. Commands & Workflow
11. Testing
12. Deployment
13. Important Notes for Next Agent

---

## 1. PROJECT OVERVIEW

Teacher Assistant is a **local-first classroom management web app** for teachers. It was originally single-user and has been fully migrated to multi-user support with teacher isolation, RBAC, invite system, session tracking, and real-time sync.

**Core Features:**
- Attendance marking per-class per-day with undo
- Student roster management (CRUD, archive, bulk import/export via Excel)
- Attendance reports with monthly Excel export (configurable columns)
- Timetable/schedule builder (day-of-week slots with subjects and lessons)
- Class schedule calendar with events (Classwork, Test, Exam, Holiday, Other)
- Seating chart (drag-and-drop style grid)
- Random student picker with spinning animation
- Student group generator
- Exam countdown timer + stopwatch
- Gatekeeper: exam entry monitor that verifies student ID against roster
- Admin dashboard: backup/restore, data reset, teacher management, invite management

**Design Philosophy:** Local-first (runs on a single machine, SQLite file database), dark/light theme, responsive.

---

## 2. TECH STACK & DEPENDENCIES

### Frontend
- **React 19** with TypeScript
- **Vite 6** (dev server + build)
- **Tailwind CSS 4** (with `@tailwindcss/vite` plugin)
- **Zustand 5** (global state management, no Redux)
- **React Query 5** (auth + data fetching hooks)
- **react-hot-toast** (all notifications/dialogs — zero alert/confirm remaining)
- **lucide-react** (icons)
- **date-fns 4** (date formatting)
- **xlsx 0.18.5** (Excel import/export)
- **motion** (animations)
- **recharts 3.7** (charts in Reports)
- **react-window + react-virtualized-auto-sizer** (virtualized lists)
- **clsx + tailwind-merge** (class merging via `cn()` utility)
- **react-error-boundary** (error recovery)

### Backend
- **Express 4.21** (API server)
- **better-sqlite3 12.4** (synchronous SQLite, single connection)
- **jsonwebtoken 9.0.3** (JWT auth, 7-day expiry)
- **bcrypt 6.0** (password hashing)
- **express-rate-limit 8.3** (throttling: 5 login attempts/15min, 100 POST/15min)
- **helmet 8.1** (security headers)
- **compression** (gzip responses)
- **cookie-parser** (cookie-based auth)
- **dotenv** (.env file)
- **Zod 4.3.6** (request validation schemas)

### Dev/Tooling
- **TypeScript 5.8** (`tsc --noEmit`)
- **tsx 4.21** (TypeScript runner for server/scripts)
- **Playwright 1.58.2** (E2E testing)
- **Vitest 4.0.18** (unit testing)
- **@testing-library/react 16.3** (component testing)

---

## 3. FILE MAP WITH LINE COUNTS

```
├── db.ts (533 lines)              — Database: schema, prepared statements, write queue, cache, migrations
├── routes.ts (986 lines)          — All API endpoints + auth/rate-limit middleware
├── server.ts (129 lines)          — Express setup, Vite integration, request logger, error handling
├── package.json (75 lines)        — Dependencies + npm scripts
├── MIGRATION_PLAN.md              — Original migration plan, all 37 items complete
├── AUDIT_LOG.md                   — Architecture audit, all fixes complete
├── AGENT_HANDOFF.md               — This file
│
├── src/
│   ├── store.ts (776 lines)       — Zustand state: all data types + CRUD actions + sync
│   ├── App.tsx (205 lines)        — Main app: auth routing, layout, class sync
│   ├── main.tsx                   — React entry point
│   ├── index.css                  — Tailwind directives + global styles
│   │
│   ├── lib/
│   │   ├── api.ts (82 lines)      — Frontend fetch wrapper (all API calls go through here)
│   │   ├── validation.ts (74 lines) — Zod schemas + validation middleware
│   │   └── errorHandler.ts (85 lines) — Express error middleware
│   │
│   ├── hooks/
│   │   ├── useData.ts (99 lines)  — React Query hooks + useClassSync poll hook
│   │   └── useClickOutside.ts (28 lines) — Dropdown click-outside handler
│   │
│   ├── components/
│   │   ├── AdminDashboard.tsx     — Admin panel (backup, reset, password, teacher management)
│   │   ├── Dashboard.tsx          — Main dashboard (stats + today's attendance)
│   │   ├── Roster.tsx             — Student roster: add/edit/archive/import/export
│   │   ├── Schedule.tsx           — Monthly calendar with event CRUD
│   │   ├── Reports.tsx            — Attendance reports per student per month
│   │   ├── Settings.tsx           — Class settings
│   │   ├── Sidebar.tsx            — Navigation + class switcher
│   │   ├── TakeAttendance.tsx     — Quick attendance grid
│   │   ├── SeatingChart.tsx       — Interactive seating chart
│   │   ├── RandomPicker.tsx       — Spinning random student picker
│   │   ├── GroupGenerator.tsx     — Student group generator
│   │   ├── ExamTimer.tsx          — Countdown timer + stopwatch
│   │   ├── Gatekeeper.tsx         — Exam entry gate monitor
│   │   ├── InviteTeacherModal.tsx — Invite system modal
│   │   ├── ErrorBoundary.tsx      — React error boundary wrapper
│   │   ├── Skeleton.tsx           — Loading skeleton component
│   │   │
│   │   └── Timetable/
│   │       ├── Timetable.tsx      — Main timetable component
│   │       ├── ExportMenu.tsx     — Timetable export dropdown
│   │       ├── DaySelector.tsx    — Day-of-week selector
│   │       ├── SlotForm.tsx       — Add/edit slot form
│   │       ├── SlotCard.tsx       — Slot card display
│   │       ├── SlotListItem.tsx   — Slot list display
│   │       ├── WeekView.tsx       — Weekly timetable view
│   │       ├── index.ts           — Re-exports
│   │       └── timetableUtils.ts  — Shared utilities (DAYS, parseTime, colors)
│   │
│   ├── utils/
│   │   ├── excel.ts (673 lines)   — All Excel import/export functions
│   │   └── cn.ts (6 lines)        — Tailwind class merge: clsx + twMerge
│   │
│   └── test/
│       ├── setup.ts               — Test setup
│       ├── store.test.ts          — Store unit tests
│       └── e2e/                   — Playwright E2E tests
│           ├── auth.spec.ts
│           ├── attendance.spec.ts
│           ├── classroom-tools.spec.ts
│           ├── dashboard.spec.ts
│           ├── reports-settings-navigation.spec.ts
│           ├── roster.spec.ts
│           └── timetable.spec.ts
```

---

## 4. ARCHITECTURE DEEP DIVE

### 4.1 Database Schema (db.ts, 533 lines)

**Tables:**
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| teachers | Teacher accounts | id, username, password_hash, name, created_at, last_login |
| classes | Class metadata | id, teacher_id (owner), name, updated_at |
| students | Student records | id, class_id, name, roll_number, parent_name, parent_phone, is_flagged, is_archived, updated_at |
| attendance_records | Daily attendance | student_id, class_id, date, status, reason (composite PK: student_id+date), updated_at |
| daily_notes | Per-class notes | class_id, date, note (composite PK: class_id+date) |
| events | Calendar events | id, class_id, date, title, type, description, updated_at |
| timetable_slots | Weekly timetable | id, class_id, day_of_week(0-6), start_time, end_time, subject, lesson, updated_at |
| seating_layout | Seating chart | class_id, seat_id, student_id (composite PK: class_id+seat_id) |
| admin_settings | Key-value settings | key, value |
| class_teachers | Teacher-class access | class_id, teacher_id, role (owner/admin/teacher/assistant), (composite PK) |
| invite_codes | Invite system | code, class_id, role, created_by, created_at, expires_at, used_by, used_at |
| user_sessions | Session tracking | id, teacher_id, device_name, ip_address, created_at, last_active, expires_at, is_revoked |

**Indexes:** 20+ indexes covering class_id, date, compound patterns:
- idx_students_class_archived (class_id, is_archived)
- idx_records_class_date_status (class_id, date, status)
- idx_events_class_date_type (class_id, date, type)
- idx_timetable_class_day (class_id, day_of_week)
- idx_invite_codes_class_active (class_id, expires_at, used_by)
- idx_user_sessions_teacher_active (teacher_id, is_revoked, expires_at)

**Key Patterns:**
- All data-modifying prepared statements include teacher isolation via `class_id IN (SELECT class_id FROM class_teachers WHERE teacher_id = ?)`
- SQLite triggers auto-populate `updated_at` on UPDATE for 7 tables
- Write queue serializes writes: `db.enqueueWrite(fn)` prevents "database is locked"
- In-memory TTL cache with namespace-aware invalidation: `db.cache.get(key)`, `db.cache.invalidate('classes:abc123:')`

**dbProxy:** The exported `db` is a Proxy wrapping the SQLite connection. It exposes:
- All native better-sqlite3 methods (.prepare, .pragma, .close, etc.)
- `db.stmt` — 57 pre-compiled prepared statements
- `db.enqueueWrite(fn)` — Queue a write operation
- `db.cache` — { get, set, invalidate, cached }
- `db.restore(buffer)` — Safely replace the database file with proper connection handling

### 4.2 Backend API (routes.ts, 986 lines)

**Middleware Stack:**
1. `requireAuth` — Validates JWT cookie, checks session revocation, fails closed on errors
2. `requireClassAccess(paramName)` — Verifies teacher has access to the class via class_teachers
3. `requireClassOwner(paramName)` — Verifies teacher is the class owner
4. `requireRole(paramName, minRole)` — Verifies minimum role level
5. `withWriteQueue(handler)` — Wraps write handlers through the serializing queue

**Auth Endpoints (no auth required):**
- `POST /auth/login` — Username/password → JWT cookie + session record
- `POST /auth/logout` — Clear auth cookie
- `GET /auth/verify` — Check if authenticated
- `GET /auth/me` — Get current teacher info
- `GET /health` — Database health check

**Public (post-auth required):**
- `/teachers/register` — Create new teacher (auth required, rate limited)
- `/teachers` — List all teachers (public, cached)
- `/database/backup` — Download database file (auth required)
- `/database/restore` — Upload and restore database (auth required, drains write queue first)

**Class-scoped endpoints (all require auth + class access):**
- GET/POST/PUT/DELETE `/classes` and `/classes/:id`
- GET/POST `/classes/:classId/students` + PUT/DELETE `/students/:id`
- GET/POST `/classes/:classId/records` + POST `/records` (batch save)
- GET/POST `/classes/:classId/daily-notes`
- GET/POST `/classes/:classId/events` + PUT/DELETE `/events/:id`
- GET/POST `/classes/:classId/timetable` + PUT/DELETE `/timetable/:id`
- GET/POST/PUT/DELETE `/classes/:classId/seating`
- GET `/settings`, POST `/settings`

**Multi-Teacher endpoints:**
- GET/POST/DELETE `/classes/:classId/teachers`
- GET/POST/DELETE `/classes/:classId/invites`
- POST `/invites/redeem`
- PUT `/classes/:classId/teachers/:teacherId/role`
- GET `/sessions`, POST `/sessions/revoke`
- GET `/classes` — returns classes teacher has access to via class_teachers

**Admin endpoints (after requireAuth):**
- Admin dashboard data aggregated across ALL classes/teachers
- `/classes` GET returns all classes when teacher has admin role
- Global settings management

### 4.3 Frontend State (store.ts, 776 lines)

**Zustand Store Structure:**
```
AppState:
  isInitialized: boolean
  isAuthenticated: boolean
  teacherId: string | null
  teacherName: string | null
  classes: ClassData[]          // All classes (loaded on demand)
  currentClassId: string | null
  
  // Flat view of current class data (what components subscribe to):
  students: Student[]
  records: AttendanceRecord[]
  dailyNotes: Record<string, string>
  events: CalendarEvent[]
  timetable: TimetableSlot[]
  seatingLayout: Record<string, string>
  theme: 'light' | 'dark'
  lastAttendanceChange: AttendanceRecord | null   // For undo
```

**Key Methods & Flow:**
1. `initializeStore()` — Fetches classes from API, eagerly loads first class, sets flat state
2. `loadClassData(classId)` — Lazy-loads a class ONCE (guarded by `cls.loaded`)
3. `reloadClassData(classId)` — FORCE-reloads class data (used by sync, bypasses guard)
4. `setCurrentClass(id)` — Triggers loadClassData if not loaded, then updates flat state
5. All CRUD methods: call API → update local state on success → toast on error
6. `setStudents()` — Bulk sync (used by Excel import)
7. `clearAllData()` — Deletes all classes, creates fresh default class

**Dual-State Pattern:** The store maintains BOTH `classes[]` (per-class data) AND flat fields (`students`, `records`, etc. for current class). The `updateCurrentClass()` helper syncs both when mutating.

### 4.4 API Client (api.ts, 82 lines)

Single `fetchApi()` wrapper:
- Base path: `/api`
- Always includes `credentials: 'include'` (cookie auth)
- Always sets `Content-Type: application/json`
- On non-200: parses JSON error body and throws `new Error(body.error || response.statusText)` — preserves server's human-readable error message

Exports 30+ typed methods matching all API endpoints by name.

### 4.5 Frontend Components

Every component follows this pattern:
```tsx
const students = useStore((state) => state.students);
const addStudent = useStore((state) => state.addStudent);
// ... subscribe to specific slices
```

No prop drilling of data — components read directly from Zustand. All mutations go through store actions (which handle API calls).

**Notable patterns:**
- Reports.tsx: Uses Map-indexed records for O(1) lookup (M7 fix)
- SeatingChart.tsx: Grid-based layout with editable seats
- ExamTimer.tsx: Ref-based countdown + Date.now() delta stopwatch (L7, L8 fixes)
- RandomPicker.tsx: setInterval with cleanup on unmount (L6 fix)
- Gatekeeper.tsx: Local date format for matching records (L9 fix)

### 4.6 Server Setup (server.ts, 129 lines)

- Express on port 3000
- Local mode: `127.0.0.1` only
- Network mode: `0.0.0.0` (run with `npm run dev:network`)
- Vite middleware in dev mode, static files in production
- Custom request logger (color-coded, 500s to server-error.log)
- Global error handler at the end
- Uncaught exception/rejection handlers log to server-error.log

### 4.7 Validation (validation.ts, 74 lines)

Zod schemas for: login, class, student, attendance_record, event, timetable_slot, teacher, setting.

The `validate(schema)` middleware wraps Zod parsing. On ZodError, returns 400 with field-level error details.

### 4.8 Error Handling (errorHandler.ts, 85 lines)

- `APIError` class with statusCode
- `Errors` factory: NotFound, Unauthorized, Forbidden, BadRequest, Conflict
- `errorHandler` middleware: handles APIError, SyntaxError, SQLite constraints, defaults to 500
- `asyncHandler` for async route wrappers (not used in routes.ts, routes use manual try/catch)
- `validateRequest` for custom validators

---

## 5. COMPLETED WORK (ALL 37 AUDIT ITEMS)

### Critical (3/3 fixed)
- **C1:** Poll-based sync was no-op (loadClassData guarded by cls.loaded). Fix: created reloadClassData() that bypasses guard. useClassSync calls it.
- **C2:** updated_at columns were NULL forever. Fix: SQLite AFTER UPDATE triggers on all 7 tables.
- **C3:** JWT session revocation bypassable. Fix: requireAuth now checks session, fails closed on DB errors, auth is cookie-only (no Authorization header bypass).

### Medium (8/8 fixed)
- **M1:** PUT/DELETE endpoints use class_teachers isolation in prepared statements
- **M2/M3:** Cache invalidation uses namespace-aware pattern with trailing colon (`classes:abc123:`)
- **M4:** Session check errors return 401/503 instead of silently passing
- **M5:** Database restore drains write queue + uses db.restore()
- **M6:** Sync fingerprint expanded to 5 dimensions
- **M7:** Reports + Excel use Map-indexed records (O(n) instead of O(n*m))
- **M8:** 7 alert/confirm in Roster, Schedule, SeatingChart → react-hot-toast

### Low (12/12 fixed)
- **L1:** Prepared statement for role management
- **L2:** Dead code Timetable/types.ts deleted
- **L3:** Dashboard imports parseTime from timetableUtils
- **L4:** Dashboard skeleton dead code removed
- **L5:** Event IDs use crypto.randomUUID()
- **L6:** RandomPicker interval cleanup
- **L7:** ExamTimer ref-based countdown
- **L8:** Stopwatch Date.now() delta
- **L9:** Gatekeeper local date format
- **L10:** Invite redeem verifies class exists
- **L11:** Compound index creation order fixed
- **L12:** Click-outside handlers for ALL dropdowns (useClickOutside hook)
- **L13:** Roster add row column alignment
- **L14:** Separate add/edit state in Roster

### Beyond Audit
- **9 additional** alert/confirm replaced in AdminDashboard.tsx + Sidebar.tsx
- **Zero** alert(), confirm(), window.confirm() remain in src/
- **useClickOutside hook** created and applied to 4 dropdowns

### Cross-Cutting Concerns (Session 2026-04-06)
- **#4 Error Handling Consistency:** Fixed `api.ts` to parse JSON error body. Logged empty catches in `routes.ts`. Fixed `setStudents` rollback and `toggleTheme` try/catch in `store.ts`.
- **#2 Atomic Store Mutations:** Wrapped `loadClassData`/`reloadClassData` in try/catch. Cleaned up `clearData`. All 22 async store actions consistent.
- **#5 Input Sanitization:** Created `safeString()` helper — strips null bytes, trims whitespace, validates min/max. All 8 Zod schemas updated.
- **#6 Hardcoded Defaults:** Extracted `DEFAULTS` constant object and `getDefaultPassword()` in `db.ts`. `store.ts` uses matching constants.

---

## 6. MIGRATION PLAN STATUS

All 41 items complete. See MIGRATION_PLAN.md for the original plan with phases 1-5.

**Commits on develop (recent):**
```
687abb5  fix(#5,#6): add input sanitization to Zod schemas, consolidate hardcoded defaults
298f7a3  fix(#2): wrap loadClassData/reloadClassData in try/catch, clean up clearData
a1f8eb8  fix(#4): standardize error handling across api, routes, and store
3752e31  docs: add agent handoff file, update migration plan and audit log
edf52a7  fix: replace all remaining alert/confirm with toast dialogs
9b208a5  fix(L12): add click-outside handlers for all dropdown menus
f345dd8  fix: resolve remaining low-priority audit findings (L2-L4, L10-L11, L13-L14)
9da0db1  fix: resolve all remaining audit findings (M5, M7, M8, L1, L5-L9)
213cee3  fix(M7): optimize Reports and Excel export from O(n×m) to O(n) with record indexing
dd799c9  fix(M2,M3): implement namespace-aware cache invalidation
ec70cb7  fix(M1): add teacher isolation to UPDATE/DELETE prepared statements
51680f5  fix(C3,M4): fix JWT session revocation bypass and fail-closed session checks
d2ead48  fix(C2): add SQLite triggers to auto-populate updated_at columns
3339055  fix(C1): fix poll-based sync no-op bug
```

---

## 7. REMAINING CROSS-CUTTING CONCERNS (NOT FIXED YET)

These require judgment calls before implementing. Priority order recommended:

(None currently — all cross-cutting concerns have been addressed)

### Future: PostgreSQL Migration (Phase 5)

When SQLite limits are reached (50+ concurrent users), migrate to PostgreSQL:

1. **5.1 Data Layer Abstraction** ✅ COMPLETE
   - Repository interfaces created in `src/repositories/`
   - SQLite implementations ready
   - Repository container (`repositories` object) for easy swapping
   - To add PostgreSQL: create `PostgreSQL*Repository` classes, update `createRepositoryContainer()`

2. **5.2 Keep API Same** ✅ COMPLETE
   - Route handlers stay mostly the same
   - Only update repository implementations

---

## TODO: Tomorrow — PostgreSQL Implementation

**Status:** Repository layer ready, PostgreSQL implementations NOT YET written.

### What's Needed:
Create these new files in `src/repositories/`:

| File | Description |
|------|-------------|
| `PostgreSQLClassRepository.ts` | Class CRUD with `pg` library |
| `PostgreSQLStudentRepository.ts` | Student CRUD + sync |
| `PostgreSQLRecordRepository.ts` | Attendance records |
| `PostgreSQLEventRepository.ts` | Calendar events |
| `PostgreSQLTimetableRepository.ts` | Timetable slots |
| `PostgreSQLSeatingRepository.ts` | Seating chart |
| `PostgreSQLNoteRepository.ts` | Daily notes |

### How:
1. Install `pg` package: `npm install pg && npm install -D @types/pg`
2. Create connection pool in new file or config
3. Copy SQLite repository and replace `better-sqlite3` calls with `pg` queries
4. Update `createRepositoryContainer()` in `container.ts` to return PostgreSQL repos
5. Test that API works the same

### Example Pattern:
```typescript
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export class PostgreSQLClassRepository implements IClassRepository {
  async getAll(): Promise<ClassSummary[]> {
    const result = await pool.query('SELECT id, teacher_id, name, owner_name FROM classes');
    return result.rows;
  }
  // ... other methods
}
```

### Notes:
- PostgreSQL connection string: `postgresql://user:pass@host:port/database`
- Add to `.env.example`: `DATABASE_URL`
- Keep SQLite implementations as fallback or remove if not needed

---

## COMPLETED CROSS-CUTTING CONCERNS

### #1 — No Service/Repository Layer ✅ FIXED
**What was done:**
- Created `src/services/` directory with 6 service modules:
  - `classService.ts` — Class CRUD operations
  - `studentService.ts` — Student CRUD + sync
  - `recordService.ts` — Attendance records
  - `eventService.ts` — Calendar events
  - `timetableService.ts` — Timetable slots
  - `seatingService.ts` — Seating chart
  - `noteService.ts` — Daily notes
- Each service wraps `api` calls with typed methods
- Services are available for future component migration
- Store continues to work (hybrid approach) — no breaking changes
- Future PostgreSQL migration: only update service implementations, not components
- Exports typed interfaces: `ClassSummary` for class list

### #3 — No Request Deduplication ✅ FIXED
**What was done:**
- Added centralized `queryKeys` object with typed keys for all data types (students, records, events, timetable, seating, dailyNotes, classes, settings, etc.)
- Created React Query hooks for all data fetching: `useClasses`, `useStudents`, `useRecords`, `useEvents`, `useTimetable`, `useSeating`, `useDailyNotes`, `useSettings`
- Each hook has proper `staleTime` (5s for class data, 30s for classes/settings)
- Created mutation hooks with auto-invalidation: `useCreateStudent`, `useUpdateStudent`, `useDeleteStudent`, `useSyncStudents`, `useSaveRecords`, `useCreateEvent`, `useUpdateEvent`, `useDeleteEvent`, `useCreateTimetableSlot`, `useUpdateTimetableSlot`, `useDeleteTimetableSlot`, `useUpdateSeat`, `useSaveSeatingLayout`, `useClearSeating`, `useSaveDailyNote`, `useCreateClass`, `useUpdateClass`, `useDeleteClass`, `useSaveSetting`
- `useClassSync` now uses `queryClient.fetchQuery()` instead of direct API calls — React Query handles deduplication automatically
- All components can now use these hooks instead of going through Zustand store actions for data fetching

### #4 — Error Handling Consistency ✅ FIXED
**What was done:**
- `src/lib/api.ts`: Parses JSON error body on non-200, throws server's actual error message instead of generic `API error: ${statusText}`
- `routes.ts`: Added logging to session tracking catch block. Clarified intentional empty catch in `getTeacherId`
- `src/store.ts`: Fixed `setStudents` rollback pattern (removed state update in catch). Added try/catch to `toggleTheme`
- All 22 async store actions follow consistent try/API/then/catch pattern

### #2 — Store Mutations Are Async but Not Atomic ✅ FIXED
**What was done:**
- `loadClassData` and `reloadClassData` wrapped in try/catch with error logging
- `clearData` caches `className` before API calls to avoid stale lookup mid-operation
- No state mutation occurs on API failure in any action

### #5 — No Input Sanitization Beyond Zod ✅ FIXED
**What was done:**
- Created `safeString()` helper in `validation.ts`: strips null bytes (`\x00`) + trims whitespace, then validates min/max
- All 8 Zod schemas use `safeString()` for every string field
- Regex patterns (date, time) converted to `.refine()` on sanitized strings

### #6 — Hardcoded Defaults in Multiple Places ✅ FIXED
**What was done:**
- Extracted `DEFAULTS` constant object in `db.ts`: TEACHER_ID, TEACHER_USERNAME, TEACHER_NAME, CLASS_ID, CLASS_NAME
- Created single `getDefaultPassword()` function — eliminates duplicated password logic
- Both admin creation locations in db.ts use `DEFAULTS` and `getDefaultPassword()`
- store.ts uses matching local constants — `clearAllData` creates `'My First Class'` instead of `'Default Class'`

---

## 8. HOW THE APP WORKS END-TO-END

### User Journey
1. **First visit:** User opens app at localhost:3000 → sees login screen
2. **Login:** Default admin username=`admin` with auto-generated password (logged to console on first start)
3. **After auth:** Dashboard shows attendance stats for the current class
4. **Sidebar:** Switch between classes, create new class, access admin panel
5. **Main features:** Take attendance, manage roster, view reports, build timetable, create schedule events, manage seating chart, use random picker, generate groups, run exam timer, use gatekeeper

### Data Flow (Read)
```
Component renders → useStore(selector) reads flat state → display data

On mount (App.tsx):
  1. useAuth() queries /auth/verify
  2. If authenticated: initializeStore() fetches classes from /api/classes
  3. First class data is eagerly loaded (students, records, events, timetable, notes, seating)
  4. Flat state populated from first class
  
On class switch:
  1. setCurrentClass(id) called
  2. If class not loaded: loadClassData(id) fetches all 6 data types from API
  3. Flat state updated from the class's data
```

### Data Flow (Write)
```
User action → store method (e.g., addStudent) → api.createStudent() → POST /api/classes/:id/students
  → Express handler validates → writes to SQLite (via db.enqueueWrite) → returns success
  → Store updates local state → component re-renders

Sync (30s):
  → useClassSync polls API (GET all 5 data types)
  → Compares fingerprint with previous
  → If changed: reloadClassData() forces fresh fetch
  → Store state updated, all subscribed components re-render
```

### Security Model
- All routes after line 315 of routes.ts require `requireAuth` (JWT cookie)
- `/database/restore` drains write queue first to prevent corruption
- All class-scoped reads/writes verify teacher has access via class_teachers
- Role hierarchy prevents non-owners from admin actions
- Rate limiting prevents brute-force login
- Helmet sets security headers
- Prepared statements prevent SQL injection
- Foreign keys with CASCADE delete prevent orphaned data

---

## 9. COMMON PATTERNS & GOTCHAS

### The `api.ts` error handling
```typescript
// Current api.ts (FIXED):
if (!response.ok) {
  let message = response.statusText;
  try {
    const body = await response.json();
    if (body?.error) message = body.error;
  } catch { /* ignore JSON parse errors */ }
  throw new Error(message);  // Preserves server's human-readable error
}
```

### Store action pattern (consistent)
```typescript
// All 22 async actions follow this pattern:
addStudent: async (student) => {
  try {
    await api.createStudent(classId, student);  // API call first
    set(...);  // Update state only if API succeeds
  } catch {
    toast.error('Failed to add student');  // NO state update on failure
  }
}
```

### Cache key collision awareness
```typescript
// GOOD: Keys use colons, invalidation uses trailing colon
db.cache.set(`classes:${teacherId}`, value);  
db.cache.invalidate(`classes:${teacherId}`); // becomes "classes:abc123:" for matching

// The cache TTL is short (5s) so this is mainly for burst protection, not long-term caching.
```

### The `setRecordForClass` method
This exists to record attendance for a class that is NOT the current class. It's used by some admin flows. Unlike other methods, it doesn't update flat state unless the target class IS the current class.

### Class ID format
Client-generated IDs: `class_${Date.now()}` format. This means if two classes are created in the same millisecond, IDs collide. Consider crypto.randomUUID() for future-proofing (like was done for events in L5).

### SQLite WAL files
You'll see `database.sqlite-wal` and `database.sqlite-shm` files in the directory. These are normal — SQLite WAL mode creates them automatically. Do not delete them while the server is running.

### Testing caveat
All E2E tests share a single database. Running the full suite in parallel causes flaky failures. The tests are designed to be run one at a time or with a clean DB between runs.

---

## 10. COMMANDS & WORKFLOW

```bash
cd /home/richiesamlie/LocalAttendace-Final

# Dependencies
npm install                          # Install all deps

# Dev server
npm run dev                          # Start on localhost:3000
npm run dev:network                  # Start on 0.0.0.0:3000 (LAN access)

# Build
npm run build                        # Production build to dist/
npm run preview                      # Preview production build
npm run clean                        # Remove dist/

# TypeScript
npm run lint                         # tsc --noEmit (type check only)

# Database
npm run db:backup                    # Copy database.sqlite to backups/
npm run db:restore                   # Interactive restore from backup
npm run db:restore:list              # List available backups
npm run db:seed                      # Seed database with test data

# Docker
npm run docker:build                 # Build Docker image
npm run docker:up                    # docker-compose up -d
npm run docker:down                  # docker-compose down
npm run docker:logs                  # docker-compose logs -f

# Tests
npx playwright test                  # Run all E2E tests (can be flaky)
npx vitest                           # Run unit tests
npx vitest --ui                      # Run with UI

# Git
git status                           # Check working tree
git log --oneline -10                # Recent commits
git add -A && git commit -m "..."    # Stage and commit
git push origin develop              # Push to remote
git fetch origin && git diff develop origin/develop  # Check remote divergence
```

**Git config** (already set locally in this repo):
```
user.email = richiesamlie@users.noreply.github.com
user.name = richiesamlie
```

---

## 11. TESTING

### E2E Tests (Playwright)
Located in `src/test/e2e/`. 7 test files covering:
- auth.spec.ts — login, logout, auth flows
- attendance.spec.ts — taking attendance, marking all present, undo
- roster.spec.ts — adding students, importing, exporting, archiving
- timetable.spec.ts — adding/removing/editing slots
- classroom-tools.spec.ts — random picker, group generator
- reports-settings-navigation.spec.ts — reports, navigation
- dashboard.spec.ts — dashboard stats and rendering

**Caveat:** Tests share a single database. The CI workflow (`.github/workflows/ci.yml`) handles DB isolation. Local runs may need manual DB management between test runs.

### Unit Tests
`src/test/store.test.ts` — Tests Zustand store actions in isolation.

---

## 12. DEPLOYMENT

### Docker
```dockerfile
# Multi-stage: builds frontend with Vite, then serves with Node
# Uses node:22-alpine base
# Exposes port 3000
# Environment: NODE_ENV=production
```

### Production Startup
```bash
npm run build          # Build frontend
NODE_ENV=production npm start    # Serve with Express
```

### Environment Variables
See `.env.example`:
- `JWT_SECRET` (required) — for JWT signing
- `DEFAULT_ADMIN_PASSWORD` (optional) — override default admin password
- `NODE_ENV` — 'production' for prod mode

---

## 13. IMPORTANT NOTES FOR NEXT AGENT

### CRITICAL — Read These First
1. **DO NOT clone the repo** — it is already at `/home/richiesamlie/LocalAttendace-Final` with `develop` branch checked out and fully synced with origin
2. **Git config is set** — `user.email` and `user.name` configured locally
3. **All 37 audit items are DONE** — do not re-verify them unless explicitly asked
4. **TypeScript compiles cleanly** — `npx tsc --noEmit` exits 0
5. **Dependencies are installed** — `npm install` already ran, `node_modules/` exists
6. **The database file exists** — `database.sqlite` is present (may have test data from seed)

### When Committing
- Always run `npx tsc --noEmit` first to confirm no type errors
- Commit incrementally per fix/change (small, descriptive commits)
- Always push to `origin/develop` after committing
- Follow the existing commit message pattern: `fix(label): description` or `feat(label): description`

### When Modifying Specific Files
- **db.ts:** Always add migrations for schema changes. Check if column/index/trigger exists before creating. Use `db.stmt` for all queries.
- **routes.ts:** Write endpoints MUST use `withWriteQueue()`. All class-scoped endpoints MUST verify access. Use `requireClassAccess` or `requireClassOwner` middleware.
- **store.ts:** All async actions: API call first, then set state in try block, catch shows toast.
- **src/lib/api.ts:** All fetch calls go through this file. Currently throws generic errors.
- **Any new dropdown:** Use `useClickOutside` hook from `src/hooks/useClickOutside.ts`
- **Any user notification:** Use `react-hot-toast` — NO alert/confirm anywhere

### Cross-Cutting Concern Priority
If asked to continue improving the codebase, work through them in this order:
1. **#3 Request Deduplication** — Only if migrating to React Query
2. **#1 Service/Repository Layer** — Major refactor, plan first

### Known Quirks
- The app auto-creates a default class if none exist (on first install)
- Student archive (soft delete) keeps the record in DB with `is_archived=1`
- The write queue serializes writes but reads are concurrent and uncached unless explicitly cached
- The cache TTL is 5 seconds — it's for burst protection, not long-term caching
- The session system creates a session record on login, checks it on every request via cookie
- JWT has 7-day expiry matching session expiry (intentional design, no refresh token)
- `clearData()` deletes the class and recreates it with the same name (resets all data for that class)

---

*Last updated: 2026-04-06 by AI Agent, session following the multi-user migration + architecture audit.*
