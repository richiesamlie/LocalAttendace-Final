# Architecture — Teacher Assistant

**Last Updated:** 2026-11-10
**Branch:** `main`

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite 6, Tailwind CSS 4 |
| State | Zustand 5 (primary), React Query 5 (caching + real-time Socket.IO sync) |
| Backend | Express 4.22+, better-sqlite3 12, optional PostgreSQL (`pg` 8.22+) |
| Realtime | Socket.IO 4 (`allowRequest` origin check + JWT handshake auth + tenant-verified rooms) |
| Auth | JWT (access token 1h + refresh token 7d rotation), httpOnly cookies |
| Validation | Zod 4 |
| Security | Helmet (CSP), express-rate-limit, prepared statements, PII log redaction, multi-school tenant isolation |
| Password hashing | bcrypt cost 12 (async-only; no sync hash paths) |
| Container | Docker multi-stage (alpine, non-root UID 1001, capability drops) |

## Architecture Overview

```
Browser ──── JWT/Refresh Cookies ──── Express API ──── SQLite/PostgreSQL
   │                                    │
   ▼                                    ▼
React Query (caching)              services.ts (13 services)
   │                                    │
   ▼                              db.stmt.* / pgQuery
Zustand Store                          │
   │                              prepared statements
   ▼
Components (15+ pages)
```

### Frontend State (src/store.ts + src/hooks/useData.ts + src/hooks/useSocket.ts)

**Hybrid approach** — Zustand is the primary state source, React Query provides caching/deduplication, and `useSocket` reconciles real-time Socket.IO events (`students_updated`, `records_updated`, `events_updated`, `timetable_updated`, `seating_updated`, `notes_updated`) across both React Query caches and the active Zustand store.

## Backend Structure

### Route Modules (src/routes/)

| Module | Route Prefix | Purpose |
|--------|--------------|---------|
| auth.routes.ts | /auth | login, register-school, logout, refresh, verify, me, verify-password |
| class.routes.ts | /classes | class CRUD, dashboard payload, teachers, invites |
| student.routes.ts | /classes, /students | student CRUD + sync (`/:classId/students`, `/:id`) |
| record.routes.ts | /, /records | attendance records (`/classes/:classId/records`, `POST /records`) |
| event.routes.ts | /, /events | calendar events (`/classes/:classId/events`, `PUT/DELETE /events/:id`) |
| note.routes.ts | /, /notes | daily notes (`/classes/:classId/daily-notes`) |
| timetable.routes.ts | /, /timetable | weekly schedule (`/classes/:classId/timetable`, `PUT/DELETE /timetable/:id`) |
| seating.routes.ts | /, /seating | seating chart (`/classes/:classId/seating`) |
| invite.routes.ts | /invites | invite redemption (`POST /invites/redeem`) |
| session.routes.ts | /sessions | session management (`GET /sessions`, `POST /sessions/revoke`) |
| teacher.routes.ts | /teachers | school-scoped teacher list + register |
| admin.routes.ts | /admin | settings (school-scoped), database, metrics, profiling, resources (system-admin) |
| health.routes.ts | /health | health check (constant-time, no DB info leak) |

### Middleware Stack (src/routes/middleware.ts)

1. **`authLimiter`** — 150 login attempts / 15min / IP
2. **`postLimiter`** — 500 write requests / 15min / IP
3. **`inviteRedeemLimiter`** — 10 attempts / 15min / IP (F-008)
4. **`requireAuth`** — Validates access cookie JWT (HS256), checks session revocation, populates `req.teacherId` and `req.schoolId`, updates last-active
5. **`requireAdmin`** — (F-011) Single point of admin RBAC. Runs AFTER `requireAuth`. Looks up teacher record, checks `is_admin=1`, returns 403 if false. Exposes `req.adminTeacher` for audit logging.
6. **`requireSystemAdmin`** — Restricts global database and host operations (`/admin/database/*`, `/admin/profiling/*`, `/admin/metrics*`, `/admin/resources*`) to administrators belonging to the primary `school_default` tenant.
7. **`requireClassAccess(param)`** — Verifies teacher has access via `class_teachers` (or is an admin of the same `school_id`)
8. **`requireClassOwner(param)`** — Verifies teacher is class owner (`role=owner`) or same-school admin
9. **`requireRole(param, minRole)`** — Verifies minimum role level within the class/school
10. **`withWriteQueue(handler)`** — Serializes write operations

Admin endpoints are protected by **a single `adminRouter.use(requireAuth, requireAdmin)`** at the router level (F-011), with `requireSystemAdmin` layered onto host/database-wide endpoints.

### Auth Flow (F-004)

```
1. POST /auth/login (or POST /auth/register-school)
   → resolve school (default, explicit schoolCode, or username@schoolCode)
   → bcrypt.compare(password, teacher.password_hash)
   → emit Set-Cookie: access_token (1h, carries teacherId, sessionId, schoolId)
                      + refresh_token (7d, HttpOnly, Secure in prod)
   → store refresh_tokens row (token_hash = sha256(rawValue))

2. Subsequent API calls
   → requireAuth verifies access_token JWT (HS256, algorithms pinned)
   → cookie name: __Host-access_token in production, access_token otherwise

3. POST /auth/refresh
   → lookup refresh_tokens by sha256(raw cookie value)
   → if used_at IS NOT NULL: REUSE DETECTED → revoke entire token family + session
   → if expires_at < now: REJECT (401)
   → rotate: mark used_at, issue new access + new refresh tokens

4. POST /auth/logout
   → revoke entire refresh token family (cascades all rotation chain)
   → clear cookies

SECURITY: Refresh tokens are SHA-256 hashed at rest; raw value only ever
exists in the user's cookie. Reuse-detection prevents stolen-token replay
attack.
```

### services.ts (→ src/services/)

Service layer with 13 service modules (`schoolService`, `teacherService`, `sessionService`, `classService`, `studentService`, `recordService`, `noteService`, `eventService`, `timetableService`, `seatingService`, `settingService`, `inviteService`, `refreshTokenService`) plus shared database helpers in `src/services/utils.ts`. All DB access flows through here via `db.stmt.*` prepared statements (SQLite) or parameterized `pgQuery` (PostgreSQL). Examples:

- `schoolService.getByCode()` / `insert()` — manages multi-school tenant records
- `refreshTokenService.issue()` — generates raw value, stores sha256 hash
- `refreshTokenService.rotate()` — chain rotation with family revocation on reuse
- `refreshTokenService.cleanupExpired()` — purges expired rows

### db.ts (→ src/db/)

```
src/db/
├── connection.ts    — DB file, pragmas, _db instance
├── schema.ts        — initSchema + migrations (incl. schools & refresh_tokens)
├── auto-migrate.ts  — PostgreSQL schema creation + SQLite-to-PostgreSQL auto-migration
├── statements.ts    — prepared statements (incl. schools, tenant-scoped CRUD, refresh_tokens)
├── cache.ts         — TTL cache (5s default, 60s for static)
├── writeQueue.ts    — Serialized write queue
├── profiling.ts     — Query profiling + EXPLAIN QUERY PLAN
└── index.ts         — Re-exports dbProxy with restore support
```

Key patterns:
- `db.stmt.*` — Pre-compiled prepared statements (teacher & school isolation via `class_teachers` and `school_id`)
- `db.enqueueWrite(fn)` — Queue write operations (prevents "database is locked")
- `db.cache` — `{ get, set, invalidate, cached }`
- `db.restore(buffer)` — Safely replace database file

## Database Schema

### Tables (14 tables)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| schools | Multi-school tenants | id, code (unique), name, created_at |
| teachers | Teacher accounts | id, username, password_hash, name, is_admin, school_id, last_login |
| classes | Class metadata | id, teacher_id (owner), name, school_id, updated_at |
| class_teachers | Teacher-class access | class_id, teacher_id, role |
| students | Student records | id, class_id, name, roll_number, is_flagged, is_archived, updated_at |
| attendance_records | Daily attendance | student_id, class_id, date (composite PK: student_id, date), status, reason, updated_at |
| daily_notes | Daily class notes | class_id, date (composite PK), note, updated_at |
| events | Calendar events | id, class_id, date, title, type, description, updated_at |
| timetable_slots | Weekly schedule | id, class_id, day_of_week (0-6), start/end time, subject, lesson, updated_at |
| seating_layout | Seating chart | class_id, seat_id (composite PK), student_id, updated_at |
| invite_codes | Invite system | code, class_id, role, created_by, expires_at, used_by, used_at |
| user_sessions | Session tracking | id, teacher_id, device_name, ip_address, expires_at, is_revoked |
| **refresh_tokens** | **F-004: Access token rotation chain** | **id, family_id, token_hash, teacher_id, session_id, created_at, expires_at, used_at, rotated_to** |
| admin_settings | Key-value settings | key (prefixed with `schoolId:` for non-default schools), value |

### Key Patterns

- **Multi-school & teacher isolation:** Teachers and classes belong to a `school_id` (default `'school_default'`). Data-modifying statements verify class membership via `class_teachers` or same-school admin ownership (`classes.school_id = teachers.school_id`).
- **Refresh token reuse detection** (F-004): When a refresh token is presented with `used_at IS NOT NULL`, the entire token family is revoked (defense against stolen-token replay). Both SQLite and PostgreSQL backends are supported.
- **ISO 8601 datetime** (RES-1): All `expires_at` columns store ISO 8601 strings; prepared statements wrap with `datetime(expires_at)` for correct comparison against `datetime('now')`.
- **Triggers:** SQLite triggers auto-populate `updated_at` on UPDATE for 7 tables.
- **Indexes:** 25+ indexes including compound indexes for common query patterns and `school_id` lookups.
- **Foreign keys:** CASCADE delete prevents orphaned data.

## Security Model

| Layer | Mechanism |
|-------|-----------|
| **Auth** | JWT access (1h) + refresh (7d, rotation, reuse detection) |
| **Cookies** | HttpOnly, `__Host-` prefix when secure cookies enabled, SameSite=Strict |
| **Session** | DB-tracked sessions with revocation check on every request |
| **Multi-School Tenancy** | Strict `school_id` isolation across classes, teachers, records, invites, settings, and Socket.IO rooms |
| **RBAC** | System admin (`school_default`) vs school admin vs class-level roles (owner/teacher/assistant); `requireAdmin` + `requireSystemAdmin` middleware at router/endpoint level (F-011) |
| **Rate limiting** | 150 login/15min, 500 writes/15min, 10 invite redeem/15min |
| **Headers** | Helmet with CSP, XSS, clickjacking protection |
| **SQL injection** | Prepared statements / parameterized queries prevent injection |
| **Excel formula safety** | Export cells starting with `=`, `+`, `-`, `@`, `\t`, `\r` are escaped to prevent CSV/Excel formula injection |
| **Input validation** | Zod schemas on all endpoints |
| **Error messages** | Generic ("Invalid or expired invite code") to prevent enumeration |
| **Log redaction** | `safeLog()` strips emails/phones/bearer tokens from error logs |
| **JSON body** | Capped at 100kb (override via `JSON_BODY_LIMIT`) |
| **Socket.IO** | JWT handshake auth + `allowRequest` origin check + class/school access check on `join_class` |
| **Password hashing** | bcrypt cost 12, async-only |
| **Health endpoint** | Constant-time response, no DB-type info leak |
| **Container** | Non-root UID 1001, drops ALL caps, no-new-privileges, bounded resources |

## File Structure

```
db.ts (→ src/db/)  — Database: schema, auto-migrate, statements, cache, queue
routes.ts (→ src/routes/)  — API endpoints + middleware aggregator
services.ts (→ src/services/)  — Service layer (13 service modules + utils.ts)
server.ts  — Express setup, Socket.IO with allowRequest & room auth, Vite integration
src/
├── store.ts  — Zustand state management
├── App.tsx  — Main app: auth routing, layout, sync
├── lib/
│   ├── api.ts  — Frontend fetch wrapper
│   ├── validation.ts  — Zod schemas
│   ├── bcrypt.ts  — hashPassword/verifyPassword (centralized cost factor)
│   ├── postgres.ts  — PostgreSQL connection pool and query helpers
│   ├── log-redact.ts  — PII log redaction
│   └── errorHandler.ts  — Express error middleware
├── middleware/
│   ├── performance.ts  — URL-sanitized performance monitor
│   ├── metricsStore.ts  — In-memory metrics
│   └── resourceMonitor.ts  — Resource tracking
├── hooks/
│   ├── useData.ts  — React Query hooks + useClassSync
│   ├── useSocket.ts  — Socket.IO real-time cache/store sync
│   ├── useTimer.ts / useStopwatch.ts  — Classroom timer & stopwatch hooks
│   └── useClickOutside.ts  — Dropdown handler
├── components/  (15+ pages)
└── types/
    ├── db.ts  — Database row types
    └── store.ts  — Store types (ClassData, Student, etc.)
```

## Multi-School & Multi-Teacher Support

**Role hierarchy:** system administrator (`school_default`) > school administrator > owner > teacher > assistant

| Role | Scope | Permissions |
|------|-------|-------------|
| System Administrator | Global (`school_default`) | All school admin permissions + database backup/restore, SQL profiling, and server metrics/resources |
| School Administrator | School (`school_id`) | Access any class in their school, register teachers, manage school settings, unlimited classes |
| Owner (Homeroom) | Class | Full control of their class, register teachers in their school |
| Subject Teacher | Class | Students, attendance, events, timetable, invites |
| Assistant | Class | Limited helper access |

**Invite system:** Teachers create invite codes with role (`teacher`/`assistant`). Codes are short random strings; `inviteRedeemLimiter` prevents brute-force enumeration (10 attempts/15min). Redeem enforces same-school membership and returns a generic error message on any failure to prevent probing.

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

## Windows Desktop & Deployment Architecture

### Native System Tray Runner (`TeacherAssistant.exe`)

For standard Windows desktop environments, the application includes a native, lightweight GUI tray runner written in C# WinForms ([`tray/TeacherAssistantTray.cs`](../tray/TeacherAssistantTray.cs)):

```
[ TeacherAssistant.exe (C# WinForms, ~20KB) ]
  ├── Single-Instance Mutex (Local\TeacherAssistant_Tray_SingleInstance_App)
  ├── System Tray NotifyIcon & Context Menu (Open, Mode, Restart, Exit)
  ├── Background Thread: Polling /api/health with SynchronizationContext.Post()
  └── Child Process: Hidden Node.js runtime (dist-server/index.cjs)
```

1. **Zero-Dependency Compilation**:
   - Compiled using the built-in Windows .NET Framework compiler (`%windir%\Microsoft.NET\Framework64\v4.0.30319\csc.exe`) via [`scripts/build-tray.ps1`](../scripts/build-tray.ps1).
   - Produces a standalone `/target:winexe` binary (~20 KB) with no external runtimes required.
2. **Single-Instance Enforcement**:
   - Uses a session-scoped `Local\` mutex. If launched while already running, the secondary instance sends a browser open signal to `http://127.0.0.1:3000` and exits immediately.
3. **Thread-Safe Asynchronous Health Monitoring**:
   - Spawns the backend engine asynchronously, then polls `http://127.0.0.1:3000/api/health` from a background worker thread.
   - Dispatches UI status and balloon tips to the main WinForms thread using `SynchronizationContext.Post()`, ensuring stability even before context menu Win32 window handles (`HWND`) are allocated.
4. **Lifecycle & Clean Shutdown**:
   - Listens to `Application.ApplicationExit` and `SystemEvents.SessionEnding` to gracefully terminate the backend child process and free port 3000.

### Release Packaging Pipeline

The release pipeline ([`scripts/build-release.ps1`](../scripts/build-release.ps1)) generates two release artifacts:
1. **`TeacherAssistant-Setup.exe`**: Built via NSIS (`installer/teacher-assistant.nsi`). Installs per-user to `$LOCALAPPDATA\Programs\Teacher Assistant` (zero admin rights required), registers uninstaller with running process termination hooks, and supports opt-in autostart via `$SMSTARTUP`.
2. **`TeacherAssistant-v1.0.0-Windows-Portable.zip`**: Self-contained portable distribution bundling portable Node.js (Node 22 LTS), production SQLite driver, bundled frontend assets, and `TeacherAssistant.exe`.

## See Also

- [`api-reference.md`](api-reference.md) — All API endpoints with types
- [`developer-guide.md`](developer-guide.md) — Coding conventions and workflows
- [`operations.md`](operations.md) — Runbook + CI triage
- [`documentation-map.md`](documentation-map.md) — Active documentation index
