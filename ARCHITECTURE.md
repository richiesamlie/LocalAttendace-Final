# Architecture — Teacher Assistant

**Last Updated:** 2026-04-22
**Branch:** `feature/split-routes-v2`

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite 6, Tailwind CSS 4 |
| State | Zustand 5 (primary), React Query 5 (caching) |
| Backend | Express 4.21, better-sqlite3 12.4 |
| Auth | JWT (7-day expiry), httpOnly cookies, session tracking |
| Validation | Zod 4.3.6 |
| Security | Helmet, express-rate-limit, prepared statements |

---

## Architecture Overview

```
Browser ──── JWT Cookie ──── Express API ──── SQLite/PostgreSQL
                │                   │
                ▼                   ▼
         React Query          services.ts
         (caching)               │
                │           db.stmt.*
                ▼               │
          Zustand Store    prepared statements
               │
               ▼
         Components (15+ pages)
```

### Frontend State (src/store.ts + src/hooks/useData.ts)

**Hybrid approach** — Zustand is the primary state source, React Query provides caching/deduplication.

```
AppState:
├── Auth: teacherId, teacherName, isAdmin, isAuthenticated
├── UI: theme, isLoading
├── Class List: classes[] (all classes with full data)
└── Current Class (flat view):
    ├── students, records, events, timetable
    ├── seatingLayout, dailyNotes
    └── lastAttendanceChange (for undo)

Data Flow:
1. initializeStore() → fetches classes, eagerly loads first class
2. loadClassData(classId) → lazy-loads class data (guarded by cls.loaded)
3. setCurrentClass(id) → switches current class, triggers load if needed
4. updateCurrentClass(updates) → syncs flat fields AND classes[] entry
```

See `STATE_MANAGEMENT.md` for full details.

---

## Backend Structure

### routes.ts (now split into src/routes/)

All API endpoints + middleware. Routes delegate to modules:

| Module | Route Prefix | Purpose |
|--------|-------------|---------|
| auth.routes.ts | /auth | Login, logout, verify, me |
| class.routes.ts | /classes | Class CRUD + teacher management |
| student.routes.ts | /students, /:classId/students | Student CRUD + sync |
| record.routes.ts | /records | Attendance records |
| event.routes.ts | /events | Calendar events |
| note.routes.ts | /daily-notes | Daily notes |
| timetable.routes.ts | /timetable | Weekly schedule |
| seating.routes.ts | /seating | Seating chart |
| invite.routes.ts | /invites, /invites/redeem | Invite system |
| session.routes.ts | /sessions | Session management |
| teacher.routes.ts | /teachers | Teacher list + register |
| admin.routes.ts | /settings, /database | Admin ops |
| health.routes.ts | /health | Health check |

### Middleware Stack

1. `requireAuth` — Validates JWT cookie, checks session revocation
2. `requireClassAccess(param)` — Verifies teacher has access via class_teachers
3. `requireClassOwner(param)` — Verifies teacher is class owner (role=owner)
4. `requireRole(param, minRole)` — Verifies minimum role level
5. `withWriteQueue(handler)` — Serializes write operations

### services.ts (715 lines)

Service layer with 11 service objects (teacherService, classService, etc.). All DB access flows through here. Uses `db.stmt.*` for prepared statements.

### db.ts (now src/db/)

```
src/db/
├── connection.ts — DB file, pragmas, _db instance
├── schema.ts — initSchema + migrations
├── statements.ts — 57 prepared statements
├── cache.ts — TTL cache functions (5s default, 60s for static)
├── writeQueue.ts — Serialized write queue
└── index.ts — Re-exports dbProxy with restore support
```

Key patterns:
- `db.stmt.*` — Pre-compiled prepared statements (teacher isolation via class_teachers)
- `db.enqueueWrite(fn)` — Queue write operations (prevents "database is locked")
- `db.cache` — { get, set, invalidate, cached }
- `db.restore(buffer)` — Safely replace database file

---

## Database Schema

### Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| teachers | Teacher accounts | id, username, password_hash, is_admin, last_login |
| classes | Class metadata | id, teacher_id (owner), name |
| students | Student records | id, class_id, name, roll_number, is_flagged, is_archived |
| attendance_records | Daily attendance | student_id, date (composite PK), status, reason |
| events | Calendar events | id, class_id, date, title, type, description |
| timetable_slots | Weekly schedule | id, day_of_week(0-6), start/end time, subject, lesson |
| seating_layout | Seating chart | class_id, seat_id, student_id |
| class_teachers | Teacher-class access | class_id, teacher_id, role |
| invite_codes | Invite system | code, class_id, role, expires_at, used_by |
| user_sessions | Session tracking | id, teacher_id, expires_at, is_revoked |
| admin_settings | Key-value settings | key, value |

### Key Patterns

- **Teacher isolation:** All data-modifying statements include `class_id IN (SELECT class_id FROM class_teachers WHERE teacher_id = ?)`
- **Triggers:** SQLite triggers auto-populate `updated_at` on UPDATE for 7 tables
- **Indexes:** 20+ indexes including compound indexes for common query patterns
- **Foreign keys:** CASCADE delete prevents orphaned data

---

## Security Model

1. **JWT cookie-only auth** — No Authorization header bypass
2. **Session tracking** — Session revocation checked on every request
3. **RBAC** — Global admin vs class-level roles (owner/teacher/assistant)
4. **Rate limiting** — 5 login/15min, 100 POST/15min
5. **Helmet** — Security headers (CSP, XSS, clickjacking)
6. **SQL injection** — Prepared statements prevent injection
7. **Input sanitization** — `safeString()` strips null bytes + trims whitespace

---

## File Structure

```
├── db.ts (→ src/db/) ─ Database: schema, statements, cache, queue
├── routes.ts (→ src/routes/) ─ API endpoints + middleware
├── services.ts ─ Service layer (11 service objects)
├── server.ts ─ Express setup, Vite integration
├── src/
│   ├── store.ts ─ Zustand state management
│   ├── App.tsx ─ Main app: auth routing, layout, sync
│   ├── lib/
│   │   ├── api.ts ─ Frontend fetch wrapper (30+ methods)
│   │   ├── validation.ts ─ Zod schemas
│   │   └── errorHandler.ts ─ Express error middleware
│   ├── hooks/
│   │   ├── useData.ts ─ React Query hooks + useClassSync
│   │   └── useClickOutside.ts ─ Dropdown handler
│   ├── components/ (15+ pages)
│   └── types/
│       ├── db.ts ─ Database row types
│       └── store.ts ─ Store types (ClassData, Student, etc.)
```

---

## Multi-Teacher Support

**Role hierarchy:** administrator > owner > teacher > assistant

| Role | Scope | Permissions |
|------|-------|-------------|
| Administrator | Global | Access any class, register teachers, unlimited classes |
| Owner (Homeroom) | Class | Full control of their class |
| Subject Teacher | Class | Students, attendance, events, timetable, invites |
| Assistant | Class | Limited helper access |

**Invite system:** Teachers create invite codes with role (teacher/assistant). Other teachers redeem codes to join classes.

---

## PostgreSQL Support

App auto-detects PostgreSQL when `DATABASE_URL` is set. See `.env.example` for setup. To switch:

```bash
export DATABASE_URL=postgresql://user:pass@localhost:5432/teacher_assistant
npm run dev
```

---

## Key Patterns

### Store Action Pattern
```typescript
addStudent: async (student) => {
  try {
    await api.createStudent(classId, student);
    set(state => updateCurrentClass(state, { students: [...state.students, student] }));
    toast.success('Student added');
  } catch {
    toast.error('Failed to add student');
  }
}
```

### API Error Handling
```typescript
if (!response.ok) {
  const body = await response.json().catch(() => ({}));
  throw new Error(body.error || response.statusText);
}
```

### Cache Key Pattern
```typescript
db.cache.set(`classes:${teacherId}`, value);
db.cache.invalidate(`classes:${teacherId}`); // trailing colon for prefix match
```

---

## See Also

- `STATE_MANAGEMENT.md` — Hybrid state architecture in depth
- `IMPROVEMENT_PLAN.md` — Technical debt and refactoring roadmap
- `API_REFERENCE.md` — All API endpoints with types
- `DEVELOPER_GUIDE.md` — Coding conventions and workflows