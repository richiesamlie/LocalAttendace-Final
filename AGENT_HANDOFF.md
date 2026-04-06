# Agent Handoff — Next Session Context

**Last Session Date:** 2026-04-06
**Branch:** `develop` (fully synced with `origin/develop`)
**Latest Commit:** `edf52a7` (fix: replace all remaining alert/confirm with toast dialogs)
**Repo:** https://github.com/richiesamlie/LocalAttendace-Final

---

## PROJECT OVERVIEW

Teacher Assistant is a classroom management app:
- **Frontend:** React 19, TypeScript, Vite 6, Tailwind CSS 4, Zustand (state), React Query, react-hot-toast, lucide-react, date-fns, xlsx
- **Backend:** Express.js, better-sqlite3 (synchronous, single connection), JWT auth (7-day), bcrypt, express-rate-limit, Zod validation, helmet, cookie-based auth
- **Database:** SQLite with WAL mode, prepared statements, write queue serialization, in-memory TTL cache
- **Deployment:** Docker + docker-compose, Windows batch startup scripts, Linux systemd service template

**Key Features:** Attendance tracking, roster management, reports/Excel export, timetable/schedule, seating chart, random picker, group generator, exam timer, gatekeeper (exam monitor), admin dashboard, multi-teacher support with invite system

---

## WHAT HAS BEEN DONE

### Migration Phases 1-5 (all complete):
1. **Foundation:** Teacher isolation via `class_teachers` join in ALL queries, write queue serialization, connection pooling, `updated_at` columns + SQLite triggers
2. **Multi-Teacher:** RBAC (owner/admin/teacher/assistant), invite system with codes, session management (device tracking, force logout), session DB table
3. **Real-Time Sync:** Poll-based sync every 30s with fingerprint detection (students, records, events, timetable, seating counts)
4. **Performance:** Compound indexes, in-memory cache with namespace-aware invalidation, batch operations, Map-indexed record lookups (O(n) instead of O(n*m))
5. **PostgreSQL Prep:** Data layer abstraction via prepared statements (all queries use `db.stmt.*`)

### All 37 Audit Items (all complete):
| ID | Status | What |
|----|--------|------|
| C1 | ✅ | Poll-based sync was calling `loadClassData()` with `cls.loaded` guard (no-op). Fixed: created `reloadClassData()` bypassing guard, sync now refetches all data |
| C2 | ✅ | `updated_at` columns existed but were never populated. Fixed: SQLite AFTER UPDATE triggers on all 7 tables |
| C3 | ✅ | JWT remained valid after session revocation, session check silently failed open. Fixed: session validation in requireAuth, revocation check, fail-closed error handling |
| M1 | ✅ | M1: Write endpoints (PUT/DELETE students, events, timetable) use prepared statements with class_teachers isolation |
| M2 | ✅ | M2: Cache invalidation is namespace-aware (`cacheInvalidate('classes:abc123:')` with trailing colon) |
| M3 | ✅ | M3: Cache keys use delimiter format preventing `classes:1` vs `classes:10` collision |
| M4 | ✅ | M4: Session check errors return 401/503 instead of silently passing |
| M5 | ✅ | M5: Database restore drains write queue + uses `db.restore()` |
| M6 | ✅ | M6: Sync fingerprint expanded to 5 dimensions (students, records, events, timetable, seating) |
| M7 | ✅ | M7: Reports/Excel use Map-indexed records for O(1) lookup |
| M8 | ✅ | M8: 7 alert/confirm calls in Roster, Schedule, SeatingChart replaced with react-hot-toast |
| L1 | ✅ | Role management uses prepared statement `db.stmt.updateClassTeacherRole` |
| L2 | ✅ | Dead code `Timetable/types.ts` deleted |
| L3 | ✅ | Dashboard imports `parseTime` from `timetableUtils` |
| L4 | ✅ | Dashboard skeleton loading dead code removed |
| L5 | ✅ | Event IDs use `crypto.randomUUID()` |
| L6 | ✅ | RandomPicker interval cleanup + double-pick guard |
| L7 | ✅ | ExamTimer ref-based countdown (no interval recreation) |
| L8 | ✅ | Stopwatch uses `Date.now()` delta (no drift) |
| L9 | ✅ | Gatekeeper uses `format(new Date(), 'yyyy-MM-dd')` for local date |
| L10 | ✅ | Invite redeem verifies class exists before granting access |
| L11 | ✅ | Compound indexes created after table creation |
| L12 | ✅ | Click-outside handlers for ALL dropdowns (created `useClickOutside.ts` hook) |
| L13 | ✅ | Roster add row has 6 td cells matching 6 header columns |
| L14 | ✅ | Roster has separate add* and edit* state variables |

### Beyond Audit:
- 9 additional alert/confirm in AdminDashboard.tsx + Sidebar.tsx replaced with react-hot-toast
- Zero `alert()`, `confirm()`, `window.confirm()` remain anywhere in `src/`

---

## REMAINING CROSS-CUTTING CONCERNS (from AUDIT_LOG.md)

These were listed in the audit but NOT fixed yet. All require judgment calls before implementing:

1. **No Service/Repository Layer** — Components read directly from Zustand store. No abstraction between components and data. Future PSG migration would scatter changes.
2. **Store Mutations Are Async but Not Atomic** — `addStudent` calls API then updates local state. If API succeeds but state update fails (or vice versa), UI and DB diverge.
3. **No Request Deduplication** — Multiple components can trigger same API call simultaneously. React Query helps but not for Zustand store actions.
4. **Error Handling Inconsistency** — Some endpoints return `{ error: 'message' }`, some use global error handler, some silently catch. Frontend mixes `toast.error()` with silent failures.
5. **No Input Sanitization Beyond Zod** — Zod validates shape/length but doesn't sanitize HTML entities, control characters. App relies on React's automatic JSX escaping (fine for rendering, not for DB storage).
6. **Hardcoded Defaults in Multiple Places** — Default class creation in store.ts, routes.ts, and db.ts. Default admin creation in db.ts (two places). Default password hints scattered.

---

## KEY FILES MAP

```
db.ts          — Database schema, prepared statements, write queue, cache layer
routes.ts      — All API endpoints, auth middleware, rate limiting, invite system
server.ts      — Express setup, Vite middleware integration, error handling
src/store.ts   — Zustand store (all state + CRUD actions + reloadClassData)
src/hooks/useData.ts — React Query hooks + useClassSync poll hook
src/hooks/useClickOutside.ts — Reusable click-outside handler (added this session)
src/components/AdminDashboard.tsx  — Admin panel (backup, reset, password, invite management)
src/components/Dashboard.tsx       — Main dashboard view
src/components/Roster.tsx          — Student roster management
src/components/Schedule.tsx        — Schedule/calendar with events
src/components/Reports.tsx         — Attendance reports + Excel export
src/components/Settings.tsx        — Class settings
src/components/Sidebar.tsx         — Navigation + class switcher
src/components/Timetable/Timetable.tsx — Timetable component
src/components/Timetable/ExportMenu.tsx — Timetable export dropdown
src/components/Timetable/timetableUtils.ts — Shared timetable utilities
src/components/SeatingChart.tsx    — Interactive seating chart
src/components/RandomPicker.tsx    — Random student picker
src/components/GroupGenerator.tsx  — Student group generator
src/components/ExamTimer.tsx       — Exam countdown timer
src/components/Gatekeeper.tsx      — Gate/entry monitor for exams
src/components/TakeAttendance.tsx  — Quick attendance marking
src/lib/api.ts   — Frontend fetch wrapper (all API calls go through here)
src/lib/validation.ts — Zod schemas for server-side validation
src/lib/errorHandler.ts — Express error middleware
src/utils/excel.ts — Excel import/export (xlsx library)
src/utils/cn.ts — Tailwind class merge utility
MIGRATION_PLAN.md — Migration plan (37 items, all complete)
AUDIT_LOG.md — Architecture audit log (all fixes complete)
```

---

## KEY ARCHITECTURE PATTERNS

### Multi-Teacher Access Control
- Every data table is scoped to a class
- `class_teachers` table maps (teacher_id, class_id, role)
- All prepared statements verify teacher access via subquery: `class_id IN (SELECT class_id FROM class_teachers WHERE teacher_id = ?)`
- Middleware: `requireAuth`, `requireClassAccess`, `requireClassOwner`, `requireRole`
- Role hierarchy: owner(4) > admin(3) > teacher(2) > assistant(1)

### Write Queue
- better-sqlite3 is synchronous, so concurrent writes can cause "database is locked"
- `db.enqueueWrite(fn)` serializes writes through a queue, reads bypass the queue
- REST handlers use `withWriteQueue(handler)` wrapper

### Cache Layer
- In-memory TTL cache in `db.ts` with namespace-aware invalidation
- Keys use colon-delimiters: `classes:teacherId`, `teachers:class:classId`, `teachers:all`, `settings:all`
- `cacheInvalidate(pattern)` uses trailing colon to prevent `classes:1` matching `classes:10`
- Default TTL: 5s for class data, 60s for static data (settings, teacher list)

### Real-Time Sync
- `useClassSync` hook polls every 30s
- Compares 5-part fingerprint: `students:length:records:events:timetable:seating`
- On mismatch, calls `reloadClassData(classId)` (bypasses the `cls.loaded` guard)

### Frontend State
- Zustand store with flat state (students, records, events, timetable, etc.)
- `currentClassId` selects which class to display
- `loadClassData()` has `cls.loaded` guard (lazy load only)
- `reloadClassData()` fetches fresh data unconditionally (for sync)
- API layer in `src/lib/api.ts` — centralized fetch wrapper with error handling

---

## COMMON COMMANDS

```bash
cd /home/richiesamlie/LocalAttendace-Final

# Install deps (if needed)
npm install

# TypeScript check
npx tsc --noEmit

# Start dev server
npm run dev

# Commit and push
git add -A && git commit -m "fix: ..." && git push origin develop

# Git config (already set)
git config user.email "richiesamlie@users.noreply.github.com"
git config user.name "richiesamlie"
```

---

## IMPORTANT NOTES FOR NEXT SESSION

1. **DO NOT clone the repo again** — it's already at `/home/richiesamlie/LocalAttendace-Final` with develop branch checked out and synced
2. **Git config is set locally** — `user.email` and `user.name` configured in this repo
3. **All 37 audit items are done** — do not re-verify them unless asked
4. **Cross-cutting concerns are the next priority** — items #1-6 in "Remaining Cross-Cutting Concerns" above
5. **The database is SQLite** — any schema changes need migrations (ALTER TABLE) and trigger updates
6. **Tests exist** but e2e tests share a single DB — runs can be flaky with parallel execution
7. **react-hot-toast** is the only dialog/notification system now — use `toast()`, `toast.success()`, `toast.error()` for all user feedback
8. **useClickOutside hook** is at `src/hooks/useClickOutside.ts` — use for any new dropdowns

---

## CROSS-CUTTING CONCERN PRIORITY RECOMMENDATION

If continuing work, tackle these in order:

1. **Error Handling Consistency (#4)** — Standardize API error format, ensure all endpoints return `{error: 'message'}`, make frontend `api.ts` surface all errors consistently. Low risk, high impact.

2. **Atomic Store Mutations (#2)** — Add rollback in store actions when API fails. Pattern: try API call, if it fails return error without updating local state (most already do this but some don't).

3. **Input Sanitization (#5)** — Add middleware to strip/escape control characters in text fields before DB insert. Low risk.

4. **Hardcoded Defaults (#6)** — Consolidate admin/teacher default creation to one place in db.ts. Low risk.

5. **Request Deduplication (#3)** — Use React Query for all data fetching instead of direct Zustand actions. Higher effort.

6. **Service/Repository Layer (#1)** — Create abstraction between components and store. Highest effort, best for future PostgreSQL migration (#5).
