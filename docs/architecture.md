# Architecture — Teacher Assistant

**Last Updated:** 2026-06-18
**Branch:** `develop`

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite 6, Tailwind CSS 4 |
| State | Zustand 5 (primary), React Query 5 (caching) |
| Backend | Express 4.21, better-sqlite3 12.4 |
| Realtime | Socket.IO 4 (`allowRequest` origin check + JWT handshake auth) |
| Auth | JWT (access token 1h + refresh token 7d rotation), httpOnly cookies |
| Validation | Zod 4 |
| Security | Helmet (CSP), express-rate-limit, prepared statements, PII log redaction |
| Password hashing | bcrypt cost 12 (async-only; no sync hash paths) |
| Container | Docker multi-stage (alpine, non-root UID 1001, capability drops) |

## Architecture Overview

```
Browser ──── JWT/Refresh Cookies ──── Express API ──── SQLite/PostgreSQL
   │                                    │
   ▼                                    ▼
React Query (caching)              services.ts
   │                                    │
   ▼                              db.stmt.*
Zustand Store                          │
   │                              prepared statements
   ▼
Components (15+ pages)
```

### Frontend State (src/store.ts + src/hooks/useData.ts)

**Hybrid approach** — Zustand is the primary state source, React Query provides caching/deduplication.

## Backend Structure

### Route Modules (src/routes/)

| Module | Route Prefix | Purpose |
|--------|--------------|---------|
| auth.routes.ts | /auth | login, logout, refresh, verify, me |
| class.routes.ts | /classes | class CRUD, dashboard payload, teachers, invites |
| student.routes.ts | /students, /:classId/students | student CRUD + sync |
| record.routes.ts | /records | attendance records |
| event.routes.ts | /events | calendar events |
| note.routes.ts | /daily-notes | daily notes |
| timetable.routes.ts | /timetable | weekly schedule |
| seating.routes.ts | /seating | seating chart |
| inviteRouter | /invites | invite CRUD + redeem |
| sessionRouter | /sessions | session management |
| teacherRouter | /teachers | teacher list + register |
| adminRouter | /settings, /database, /metrics, /profiling, /resources | admin ops |
| healthRouter | /health | health check (constant-time, no DB info leak) |

### Middleware Stack (src/routes/middleware.ts)

1. **`authLimiter`** — 150 login attempts / 15min / IP
2. **`postLimiter`** — 500 write requests / 15min / IP
3. **`inviteRedeemLimiter`** — 10 attempts / 15min / IP (F-008)
4. **`requireAuth`** — Validates access cookie JWT (HS256), checks session revocation, updates last-active
5. **`requireAdmin`** — (F-011) Single point of admin RBAC. Runs AFTER requireAuth. Looks up teacher record, checks `is_admin=1`, returns 403 if false. Exposes `req.adminTeacher` for audit logging.
6. **`requireClassAccess(param)`** — Verifies teacher has access via class_teachers
7. **`requireClassOwner(param)`** — Verifies teacher is class owner (role=owner)
8. **`requireRole(param, minRole)`** — Verifies minimum role level
9. **`withWriteQueue(handler)`** — Serializes write operations per-class

Admin endpoints are protected by **a single `adminRouter.use(requireAuth, requireAdmin)`** at the router level (F-011). Before F-011, every admin handler duplicated the is_admin check (14 duplicates across the file).

### Auth Flow (F-004)

```
1. POST /auth/login
   → bcrypt.compare(password, teacher.password_hash)
   → emit Set-Cookie: access_token (1h) + refresh_token (7d, HttpOnly, Secure in prod)
   → store refresh_tokens row (token_hash = sha256(rawValue))

2. Subsequent API calls
   → requireAuth verifies access_token JWT (HS256, algorithms pinned)
   → cookie name: __Host-access_token in production, access_token otherwise

3. POST /auth/refresh
   → lookup refresh_tokens by sha256(raw cookie value)
   → if used_at IS NOT NULL: REUSE DETECTED → revoke entire token family
   → if expires_at < now: REJECT (404)
   → rotate: mark used_at, issue new access + new refresh tokens

4. POST /auth/logout
   → revoke entire refresh token family (cascades all rotation chain)
   → clear cookies

SECURITY: Refresh tokens are SHA-256 hashed at rest; raw value only ever
exists in the user's cookie. Reuse-detection prevents stolen-token replay
attack.
```

### services.ts

Service layer with 11 service objects (teacherService, classService, etc.). All DB access flows through here via `db.stmt.*` prepared statements. Examples:

- `refreshTokenService.issue()` — generates raw value, stores sha256 hash
- `refreshTokenService.rotate()` — chain rotation with family revocation on reuse
- `refreshTokenService.cleanupExpired()` — purges expired rows

### db.ts (→ src/db/)

```
src/db/
├── connection.ts    — DB file, pragmas, _db instance
├── schema.ts        — initSchema + migrations
├── statements.ts    — prepared statements (incl. refresh_tokens CRUD)
├── cache.ts         — TTL cache (5s default, 60s for static)
├── writeQueue.ts    — Serialized write queue
└── index.ts         — Re-exports dbProxy with restore support
```

Key patterns:
- `db.stmt.*` — Pre-compiled prepared statements (teacher isolation via class_teachers)
- `db.enqueueWrite(fn)` — Queue write operations (prevents "database is locked")
- `db.cache` — { get, set, invalidate, cached }
- `db.restore(buffer)` — Safely replace database file

## Database Schema

### Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| teachers | Teacher accounts | id, username, password_hash, is_admin, last_login |
| classes | Class metadata | id, teacher_id (owner), name |
| students | Student records | id, class_id, name, roll_number, is_flagged, is_archived |
| attendance_records | Daily attendance | student_id, date (composite PK), status, reason |
| events | Calendar events | id, class_id, date, title, type, description |
| timetable_slots | Weekly schedule | id, day_of_week (0-6), start/end time, subject, lesson |
| seating_layout | Seating chart | class_id, seat_id, student_id |
| class_teachers | Teacher-class access | class_id, teacher_id, role |
| invite_codes | Invite system | code, class_id, role, expires_at, used_by, used_at |
| user_sessions | Session tracking | id, teacher_id, expires_at, is_revoked |
| **refresh_tokens** | **F-004: Access token rotation chain** | **id, teacher_id, session_id, family_id, token_hash, expires_at, created_at, used_at, rotated_to, revoked_at, user_agent, ip** |
| admin_settings | Key-value settings | key, value |

### Key Patterns

- **Teacher isolation:** All data-modifying statements include `class_id IN (SELECT class_id FROM class_teachers WHERE teacher_id = ?)`
- **Refresh token reuse detection** (F-004): When a refresh token is presented with `used_at IS NOT NULL`, the entire token family is revoked (defense against stolen-token replay)
- **ISO 8601 datetime** (RES-1): All `expires_at` columns store ISO 8601 strings; prepared statements wrap with `datetime(expires_at)` for correct comparison against `datetime('now')`
- **Triggers:** SQLite triggers auto-populate `updated_at` on UPDATE for 7 tables
- **Indexes:** 20+ indexes including compound indexes for common query patterns
- **Foreign keys:** CASCADE delete prevents orphaned data

## Security Model

| Layer | Mechanism |
|-------|-----------|
| **Auth** | JWT access (1h) + refresh (7d, rotation, reuse detection) |
| **Cookies** | HttpOnly, `__Host-` prefix in production, SameSite=Strict |
| **Session** | DB-tracked sessions with revocation check on every request |
| **RBAC** | Global admin vs class-level roles (owner/teacher/assistant); `requireAdmin` middleware at router level (F-011) |
| **Rate limiting** | 150 login/15min, 500 writes/15min, 10 invite redeem/15min |
| **Headers** | Helmet with CSP, XSS, clickjacking protection |
| **SQL injection** | Prepared statements prevent injection |
| **Input validation** | Zod schemas on all endpoints |
| **Error messages** | Generic ("Unable to redeem invite") to prevent enumeration |
| **Log redaction** | `safeLog()` strips emails/phones/bearer tokens from error logs |
| **JSON body** | Capped at 100kb (override via `JSON_BODY_LIMIT`) |
| **Socket.IO** | JWT handshake auth + `allowRequest` origin check at handshake time |
| **Password hashing** | bcrypt cost 12, async-only |
| **Health endpoint** | Constant-time response, no DB-type info leak |
| **Container** | Non-root UID 1001, drops ALL caps, no-new-privileges, bounded resources |

## File Structure

```
db.ts (→ src/db/)  — Database: schema, statements, cache, queue
routes.ts (→ src/routes/)  — API endpoints + middleware aggregator
services.ts  — Service layer (11 service objects + refreshTokenService)
server.ts  — Express setup, Socket.IO with allowRequest, Vite integration
src/
├── store.ts  — Zustand state management
├── App.tsx  — Main app: auth routing, layout, sync
├── lib/
│   ├── api.ts  — Frontend fetch wrapper
│   ├── validation.ts  — Zod schemas
│   ├── bcrypt.ts  — hashPassword/verifyPassword (centralized cost factor)
│   └── errorHandler.ts  — Express error middleware
├── middleware/
│   ├── performance.ts  — URL-sanitized performance monitor
│   ├── metricsStore.ts  — In-memory metrics
│   └── resourceMonitor.ts  — Resource tracking
├── hooks/
│   ├── useData.ts  — React Query hooks + useClassSync
│   └── useClickOutside.ts  — Dropdown handler
├── components/  (15+ pages)
└── types/
    ├── db.ts  — Database row types
    └── store.ts  — Store types (ClassData, Student, etc.)
```

## Multi-Teacher Support

**Role hierarchy:** administrator > owner > teacher > assistant

| Role | Scope | Permissions |
|------|-------|-------------|
| Administrator | Global | Access any class, register teachers, unlimited classes |
| Owner (Homeroom) | Class | Full control of their class |
| Subject Teacher | Class | Students, attendance, events, timetable, invites |
| Assistant | Class | Limited helper access |

**Invite system:** Teachers create invite codes with role (teacher/assistant). Codes are short random strings; `inviteRedeemLimiter` prevents brute-force enumeration (10 attempts/15min). All redeem errors return the same generic message to prevent probing.

## PostgreSQL Support

App auto-detects PostgreSQL when `DATABASE_URL` is set:

```bash
export DATABASE_URL=postgresql://user:***@localhost:5432/teacher_assistant
bun run dev
```

Service layer abstracts the driver; both SQLite and Postgres paths are tested.

## Container Architecture (Docker)

Multi-stage Dockerfile:
1. **Builder stage** — `node:20-alpine`, `npm ci --ignore-scripts --no-audit --no-fund`, builds frontend
2. **Production stage** — `node:20-alpine`, copies built assets + server source, runs as non-root user (UID 1001)

`docker-compose.yml` hardening:
- `security_opt: no-new-privileges:true`
- `cap_drop: [ALL]` (no Linux capabilities needed)
- `user: "1001:1001"` (explicit)
- `cpus: 1.0` / `memory: 512M` / `pids: 100` (resource limits)
- Named volume `teacher-assistant-data` (not bind mount)
- `tmpfs: /app/backups` (100M cap, ephemeral)

Healthcheck uses Node.js HTTP (already in image) instead of wget.

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

### Middleware Composition (F-011)
```typescript
export const adminRouter = express.Router();
adminRouter.use(requireAuth, requireAdmin);  // applied ONCE

adminRouter.get('/settings', async (_req, res) => {
  // No per-handler is_admin check needed
  // req.adminTeacher available for audit logging
});
```

## See Also

- [`api-reference.md`](api-reference.md) — All API endpoints with types
- [`developer-guide.md`](developer-guide.md) — Coding conventions and workflows
- [`operations.md`](operations.md) — Runbook + CI triage
- [`documentation-map.md`](documentation-map.md) — Active documentation index
