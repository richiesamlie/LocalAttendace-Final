# Architecture â€” Teacher Assistant

**Last Updated:** 2026-05-11
**Branch:** `develop`

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
Browser â”€â”€â”€â”€ JWT Cookie â”€â”€â”€â”€ Express API â”€â”€â”€â”€ SQLite/PostgreSQL
                â”‚                   â”‚
                â–¼                   â–¼
         React Query          services.ts
         (caching)               â”‚
                â”‚           db.stmt.*
                â–¼               â”‚
          Zustand Store    prepared statements
               â”‚
               â–¼
         Components (15+ pages)
```

### Frontend State (src/store.ts + src/hooks/useData.ts)

**Hybrid approach** â€” Zustand is the primary state source, React Query provides caching/deduplication.

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

1. `requireAuth` â€” Validates JWT cookie, checks session revocation
2. `requireClassAccess(param)` â€” Verifies teacher has access via class_teachers
3. `requireClassOwner(param)` â€” Verifies teacher is class owner (role=owner)
4. `requireRole(param, minRole)` â€” Verifies minimum role level
5. `withWriteQueue(handler)` â€” Serializes write operations

### services.ts (715 lines)

Service layer with 11 service objects (teacherService, classService, etc.). All DB access flows through here. Uses `db.stmt.*` for prepared statements.

### db.ts (now src/db/)

```
src/db/
â”œâ”€â”€ connection.ts â€” DB file, pragmas, _db instance
â”œâ”€â”€ schema.ts â€” initSchema + migrations
â”œâ”€â”€ statements.ts â€” 57 prepared statements
â”œâ”€â”€ cache.ts â€” TTL cache functions (5s default, 60s for static)
â”œâ”€â”€ writeQueue.ts â€” Serialized write queue
â””â”€â”€ index.ts â€” Re-exports dbProxy with restore support
```

Key patterns:
- `db.stmt.*` â€” Pre-compiled prepared statements (teacher isolation via class_teachers)
- `db.enqueueWrite(fn)` â€” Queue write operations (prevents "database is locked")
- `db.cache` â€” { get, set, invalidate, cached }
- `db.restore(buffer)` â€” Safely replace database file

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

1. **JWT cookie-only auth** â€” No Authorization header bypass
2. **Session tracking** â€” Session revocation checked on every request
3. **RBAC** â€” Global admin vs class-level roles (owner/teacher/assistant)
4. **Rate limiting** â€” 150 login attempts/15min, 500 POST/15min (test env bypassed)
5. **Helmet** â€” Security headers (CSP, XSS, clickjacking)
6. **SQL injection** â€” Prepared statements prevent injection
7. **Input sanitization** â€” `safeString()` strips null bytes + trims whitespace

---

## File Structure

```
â”œâ”€â”€ db.ts (â†’ src/db/) â”€ Database: schema, statements, cache, queue
â”œâ”€â”€ routes.ts (â†’ src/routes/) â”€ API endpoints + middleware
â”œâ”€â”€ services.ts â”€ Service layer (11 service objects)
â”œâ”€â”€ server.ts â”€ Express setup, Vite integration
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ store.ts â”€ Zustand state management
â”‚   â”œâ”€â”€ App.tsx â”€ Main app: auth routing, layout, sync
â”‚   â”œâ”€â”€ lib/
â”‚   â”‚   â”œâ”€â”€ api.ts â”€ Frontend fetch wrapper (30+ methods)
â”‚   â”‚   â”œâ”€â”€ validation.ts â”€ Zod schemas
â”‚   â”‚   â””â”€â”€ errorHandler.ts â”€ Express error middleware
â”‚   â”œâ”€â”€ hooks/
â”‚   â”‚   â”œâ”€â”€ useData.ts â”€ React Query hooks + useClassSync
â”‚   â”‚   â””â”€â”€ useClickOutside.ts â”€ Dropdown handler
â”‚   â”œâ”€â”€ components/ (15+ pages)
â”‚   â””â”€â”€ types/
â”‚       â”œâ”€â”€ db.ts â”€ Database row types
â”‚       â””â”€â”€ store.ts â”€ Store types (ClassData, Student, etc.)
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
export DATABASE_URL=postgresql://user:***@localhost:5432/teacher_assistant
bun run dev
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

- `api-reference.md` â€” All API endpoints with types
- `developer-guide.md` â€” Coding conventions and workflows
- `documentation-map.md` â€” Active documentation index

