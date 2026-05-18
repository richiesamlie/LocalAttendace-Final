     1|# Architecture — Teacher Assistant
     2|
     3|**Last Updated:** 2026-05-11
     4|**Branch:** `develop`
     5|
     6|---
     7|
     8|## Tech Stack
     9|
    10|| Layer | Technology |
    11||-------|------------|
    12|| Frontend | React 19, TypeScript, Vite 6, Tailwind CSS 4 |
    13|| State | Zustand 5 (primary), React Query 5 (caching) |
    14|| Backend | Express 4.21, better-sqlite3 12.4 |
    15|| Auth | JWT (7-day expiry), httpOnly cookies, session tracking |
    16|| Validation | Zod 4.3.6 |
    17|| Security | Helmet, express-rate-limit, prepared statements |
    18|
    19|---
    20|
    21|## Architecture Overview
    22|
    23|```
    24|Browser ──── JWT Cookie ──── Express API ──── SQLite/PostgreSQL
    25|                │                   │
    26|                ▼                   ▼
    27|         React Query          services.ts
    28|         (caching)               │
    29|                │           db.stmt.*
    30|                ▼               │
    31|          Zustand Store    prepared statements
    32|               │
    33|               ▼
    34|         Components (15+ pages)
    35|```
    36|
    37|### Frontend State (src/store.ts + src/hooks/useData.ts)
    38|
    39|**Hybrid approach** — Zustand is the primary state source, React Query provides caching/deduplication.
    40|
    41|---
    42|
    43|## Backend Structure
    44|
    45|### routes.ts (now split into src/routes/)
    46|
    47|All API endpoints + middleware. Routes delegate to modules:
    48|
    49|| Module | Route Prefix | Purpose |
    50||--------|-------------|---------|
    51|| auth.routes.ts | /auth | Login, logout, verify, me |
    52|| class.routes.ts | /classes | Class CRUD + teacher management |
    53|| student.routes.ts | /students, /:classId/students | Student CRUD + sync |
    54|| record.routes.ts | /records | Attendance records |
    55|| event.routes.ts | /events | Calendar events |
    56|| note.routes.ts | /daily-notes | Daily notes |
    57|| timetable.routes.ts | /timetable | Weekly schedule |
    58|| seating.routes.ts | /seating | Seating chart |
    59|| invite.routes.ts | /invites, /invites/redeem | Invite system |
    60|| session.routes.ts | /sessions | Session management |
    61|| teacher.routes.ts | /teachers | Teacher list + register |
    62|| admin.routes.ts | /settings, /database | Admin ops |
    63|| health.routes.ts | /health | Health check |
    64|
    65|### Middleware Stack
    66|
    67|1. `requireAuth` — Validates JWT cookie, checks session revocation
    68|2. `requireClassAccess(param)` — Verifies teacher has access via class_teachers
    69|3. `requireClassOwner(param)` — Verifies teacher is class owner (role=owner)
    70|4. `requireRole(param, minRole)` — Verifies minimum role level
    71|5. `withWriteQueue(handler)` — Serializes write operations
    72|
    73|### services.ts (715 lines)
    74|
    75|Service layer with 11 service objects (teacherService, classService, etc.). All DB access flows through here. Uses `db.stmt.*` for prepared statements.
    76|
    77|### db.ts (now src/db/)
    78|
    79|```
    80|src/db/
    81|├── connection.ts — DB file, pragmas, _db instance
    82|├── schema.ts — initSchema + migrations
    83|├── statements.ts — 57 prepared statements
    84|├── cache.ts — TTL cache functions (5s default, 60s for static)
    85|├── writeQueue.ts — Serialized write queue
    86|└── index.ts — Re-exports dbProxy with restore support
    87|```
    88|
    89|Key patterns:
    90|- `db.stmt.*` — Pre-compiled prepared statements (teacher isolation via class_teachers)
    91|- `db.enqueueWrite(fn)` — Queue write operations (prevents "database is locked")
    92|- `db.cache` — { get, set, invalidate, cached }
    93|- `db.restore(buffer)` — Safely replace database file
    94|
    95|---
    96|
    97|## Database Schema
    98|
    99|### Tables
   100|
   101|| Table | Purpose | Key Columns |
   102||-------|---------|-------------|
   103|| teachers | Teacher accounts | id, username, password_hash, is_admin, last_login |
   104|| classes | Class metadata | id, teacher_id (owner), name |
   105|| students | Student records | id, class_id, name, roll_number, is_flagged, is_archived |
   106|| attendance_records | Daily attendance | student_id, date (composite PK), status, reason |
   107|| events | Calendar events | id, class_id, date, title, type, description |
   108|| timetable_slots | Weekly schedule | id, day_of_week(0-6), start/end time, subject, lesson |
   109|| seating_layout | Seating chart | class_id, seat_id, student_id |
   110|| class_teachers | Teacher-class access | class_id, teacher_id, role |
   111|| invite_codes | Invite system | code, class_id, role, expires_at, used_by |
   112|| user_sessions | Session tracking | id, teacher_id, expires_at, is_revoked |
   113|| admin_settings | Key-value settings | key, value |
   114|
   115|### Key Patterns
   116|
   117|- **Teacher isolation:** All data-modifying statements include `class_id IN (SELECT class_id FROM class_teachers WHERE teacher_id = ?)`
   118|- **Triggers:** SQLite triggers auto-populate `updated_at` on UPDATE for 7 tables
   119|- **Indexes:** 20+ indexes including compound indexes for common query patterns
   120|- **Foreign keys:** CASCADE delete prevents orphaned data
   121|
   122|---
   123|
   124|## Security Model
   125|
   126|1. **JWT cookie-only auth** — No Authorization header bypass
   127|2. **Session tracking** — Session revocation checked on every request
   128|3. **RBAC** — Global admin vs class-level roles (owner/teacher/assistant)
   129|4. **Rate limiting** — 150 login attempts/15min, 500 POST/15min (test env bypassed)
   130|5. **Helmet** — Security headers (CSP, XSS, clickjacking)
   131|6. **SQL injection** — Prepared statements prevent injection
   132|7. **Input sanitization** — `safeString()` strips null bytes + trims whitespace
   133|
   134|---
   135|
   136|## File Structure
   137|
   138|```
   139|├── db.ts (→ src/db/) ─ Database: schema, statements, cache, queue
   140|├── routes.ts (→ src/routes/) ─ API endpoints + middleware
   141|├── services.ts ─ Service layer (11 service objects)
   142|├── server.ts ─ Express setup, Vite integration
   143|├── src/
   144|│   ├── store.ts ─ Zustand state management
   145|│   ├── App.tsx ─ Main app: auth routing, layout, sync
   146|│   ├── lib/
   147|│   │   ├── api.ts ─ Frontend fetch wrapper (30+ methods)
   148|│   │   ├── validation.ts ─ Zod schemas
   149|│   │   └── errorHandler.ts ─ Express error middleware
   150|│   ├── hooks/
   151|│   │   ├── useData.ts ─ React Query hooks + useClassSync
   152|│   │   └── useClickOutside.ts ─ Dropdown handler
   153|│   ├── components/ (15+ pages)
   154|│   └── types/
   155|│       ├── db.ts ─ Database row types
   156|│       └── store.ts ─ Store types (ClassData, Student, etc.)
   157|```
   158|
   159|---
   160|
   161|## Multi-Teacher Support
   162|
   163|**Role hierarchy:** administrator > owner > teacher > assistant
   164|
   165|| Role | Scope | Permissions |
   166||------|-------|-------------|
   167|| Administrator | Global | Access any class, register teachers, unlimited classes |
   168|| Owner (Homeroom) | Class | Full control of their class |
   169|| Subject Teacher | Class | Students, attendance, events, timetable, invites |
   170|| Assistant | Class | Limited helper access |
   171|
   172|**Invite system:** Teachers create invite codes with role (teacher/assistant). Other teachers redeem codes to join classes.
   173|
   174|---
   175|
   176|## PostgreSQL Support
   177|
   178|App auto-detects PostgreSQL when `DATABASE_URL` is set. See `.env.example` for setup. To switch:
   179|
   180|```bash
   181|export DATABASE_URL=postgresql://user:***@localhost:5432/teacher_assistant
   182|bun run dev
   183|```
   184|
   185|---
   186|
   187|## Key Patterns
   188|
   189|### Store Action Pattern
   190|```typescript
   191|addStudent: async (student) => {
   192|  try {
   193|    await api.createStudent(classId, student);
   194|    set(state => updateCurrentClass(state, { students: [...state.students, student] }));
   195|    toast.success('Student added');
   196|  } catch {
   197|    toast.error('Failed to add student');
   198|  }
   199|}
   200|```
   201|
   202|### API Error Handling
   203|```typescript
   204|if (!response.ok) {
   205|  const body = await response.json().catch(() => ({}));
   206|  throw new Error(body.error || response.statusText);
   207|}
   208|```
   209|
   210|### Cache Key Pattern
   211|```typescript
   212|db.cache.set(`classes:${teacherId}`, value);
   213|db.cache.invalidate(`classes:${teacherId}`); // trailing colon for prefix match
   214|```
   215|
   216|---
   217|
   218|## See Also
   219|
   220|- `api-reference.md` — All API endpoints with types
   221|- `developer-guide.md` — Coding conventions and workflows
   222|- `documentation-map.md` — Active documentation index
   223|