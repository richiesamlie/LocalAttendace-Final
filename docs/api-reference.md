# API Reference — Teacher Assistant

**Last Updated:** 2026-11-10
**Branch:** `main`

Base URL: `/api`

---

## Authentication

### POST /auth/login
Login with credentials. Supports multi-school resolution via optional `schoolCode` or `username@schoolCode` syntax (defaults to `default` school when omitted).

**Request:**
```json
{ "username": "admin", "password": "password123", "schoolCode": "default" }
```

**Response (200):**
```json
{
  "success": true,
  "teacherId": "...",
  "username": "admin",
  "name": "Administrator",
  "isAdmin": true,
  "schoolId": "school_default",
  "schoolCode": "default",
  "schoolName": "Default School"
}
```
Sets `access_token` (1h) and `refresh_token` (7d) cookies (HttpOnly, `__Host-` prefix when secure cookies are enabled).

**Errors:** 401 — Invalid credentials

---

### POST /auth/register-school
Register a new isolated school workspace along with its initial administrator account and default class (`My First Class`).

**Request:**
```json
{
  "schoolName": "St. Mary's Academy",
  "schoolCode": "stmarys",
  "username": "admin",
  "password": "password123",
  "adminName": "Principal Smith"
}
```

**Response (201):**
```json
{
  "success": true,
  "teacherId": "teacher_...",
  "username": "admin@stmarys",
  "name": "Principal Smith",
  "isAdmin": true,
  "schoolId": "school_...",
  "schoolCode": "stmarys",
  "schoolName": "St. Mary's Academy"
}
```
Sets `access_token` (1h) and `refresh_token` (7d) cookies.

**Errors:** 400 — School code or username already registered

---

### POST /auth/logout
Logout current user, revoke the active refresh-token family, then clear auth cookies.

**Response:** `{ "success": true }`

---

### POST /auth/refresh
Exchange a valid refresh token for a fresh access+refresh pair. Added in F-004 to enable short-lived access tokens (1h) without forcing re-login.

**Request:** No body. Reads `refresh_token` cookie.

**Response (200):**
```json
{ "success": true, "teacherId": "...", "schoolId": "school_default" }
```
Sets new `access_token` (1h) and `refresh_token` (7d) cookies.

**Errors:**
- `401` — refresh token missing, invalid, expired, or session revoked
- `401` — refresh token has been used before (reuse detected → entire token family and session revoked)

**Security:** Refresh tokens are SHA-256 hashed at rest. Reuse of an already-rotated token triggers family-wide revocation as defense against stolen-token replay.

---

### GET /auth/verify
Check authentication status. Requires a valid auth cookie/session.

**Response (200):**
```json
{
  "authenticated": true,
  "teacherId": "...",
  "name": "Administrator",
  "isAdmin": true,
  "schoolId": "school_default",
  "schoolCode": "default",
  "schoolName": "Default School"
}
```

---

### GET /auth/me
Get current teacher info.

**Response (200):**
```json
{
  "id": "...",
  "username": "admin",
  "name": "Administrator",
  "isAdmin": true,
  "schoolId": "school_default",
  "schoolCode": "default",
  "schoolName": "Default School"
}
```

---

### POST /auth/verify-password
Verify the current administrator's password before unlocking sensitive admin actions in the UI. Requires authentication and `is_admin = 1`.

**Request:**
```json
{ "password": "password123" }
```

**Response (200):**
```json
{ "success": true }
```

**Errors:**
- `400` — Password is required
- `401` — Incorrect admin password
- `403` — Administrator access required

## Health

### GET /health
Application health check. Constant-time (50ms) response with no database-type or uptime info leak (F-024).

**Response (200):**
```json
{ "status": "ok" }
```

## Classes

### GET /classes
List classes accessible to the current teacher (or all classes within the admin's school if `is_admin = 1`).

**Response (200):**
```json
[
  {
    "id": "class_123",
    "teacher_id": "...",
    "name": "Math Class",
    "school_id": "school_default",
    "owner_name": "Administrator",
    "role": "owner"
  }
]
```

---

### GET /classes/:classId/dashboard-payload
Get dashboard data (students, attendance records, events, timetable, daily notes, seating layout) for a class in a single response. RBAC enforced via `requireClassAccess`.

**Response (200):**
```json
{
  "students": [...],
  "records": [...],
  "events": [...],
  "timetable": [...],
  "dailyNotes": {...},
  "seatingLayout": {...}
}
```

---

### POST /classes
Create a new class in the caller's school. Non-admin teachers may own at most one Homeroom class. Requires authentication.

**Request:**
```json
{ "id": "class_123", "name": "Math Class" }
```

**Response (200):**
```json
{ "id": "class_123", "teacher_id": "...", "name": "Math Class", "school_id": "school_default" }
```

---

### PUT /classes/:id
Update class name. Requires authentication and class owner role.

**Request:**
```json
{ "name": "Mathematics" }
```

**Response (200):** `{ "success": true }`

---

### DELETE /classes/:id
Delete a class. Requires authentication and class owner role.

**Response (200):** `{ "success": true }`

## Class Teachers

### GET /classes/:classId/teachers
List teachers with access to a class. Requires authentication and class access.

**Response (200):**
```json
[
  { "id": "...", "username": "...", "name": "...", "role": "owner" }
]
```

---

### POST /classes/:classId/teachers
Add a teacher to a class. Requires authentication and class owner role.

**Request:**
```json
{ "teacherId": "..." }
```

**Response (200):** `{ "success": true }`

---

### DELETE /classes/:classId/teachers/:teacherId
Remove a teacher from a class. Requires authentication and class owner role.

**Response (200):** `{ "success": true }`

---

### PUT /classes/:classId/teachers/:teacherId/role
Update a teacher's role in a class. Requires class owner role.

**Request:**
```json
{ "role": "teacher" }
```
Valid roles: `owner`, `teacher`, `assistant`.

**Response (200):** `{ "success": true }`

## Students

### GET /classes/:classId/students
List students in a class. Also available at `/students/:classId/students` (legacy mount).

**Response (200):**
```json
[
  { "id": "s1", "name": "John", "rollNumber": "001", "isFlagged": false, "isArchived": false }
]
```

---

### POST /classes/:classId/students
Add a student to a class.

**Request:**
```json
{ "id": "s_new", "name": "Alice", "rollNumber": "010", "isFlagged": false }
```

**Response (201):** `{ "success": true, "id": "s_new" }`

---

### PUT /students/:id
Update a student's fields. At least one field required.

**Request (partial):**
```json
{ "name": "Alice Smith", "isFlagged": true }
```

**Response (200):** `{ "success": true }`

---

### DELETE /students/:id
Archive a student (`is_archived = 1`). Requires authentication and access to the student's class.

**Response (200):** `{ "success": true }`

---

### POST /classes/:classId/students/sync
Bulk create/update students. Used for Excel import.

**Request:**
```json
{
  "students": [
    { "id": "s1", "name": "John", "rollNumber": "001" },
    { "id": "s2", "name": "Jane", "rollNumber": "002" }
  ]
}
```

**Response (200):**
```json
{ "success": true, "inserted": 3, "updated": 12 }
```

## Attendance Records

### GET /classes/:classId/records
Get attendance records for a class.

**Query params:**
- `from` (optional, YYYY-MM-DD)
- `to` (optional, YYYY-MM-DD)

**Response (200):**
```json
[
  { "studentId": "s1", "date": "2026-04-22", "status": "Present", "reason": null }
]
```

---

### POST /records
Save attendance records. Accepts single object or array. Verifies that every referenced class and student belongs to the caller's authorized classes/school.

**Request (single):**
```json
{ "studentId": "s1", "classId": "class_123", "date": "2026-04-22", "status": "Present" }
```

**Request (array):**
```json
[{ "studentId": "s1", "classId": "class_123", "date": "2026-04-22", "status": "Present" }]
```

**Response (200):** `{ "success": true }`

## Events

### GET /classes/:classId/events
List calendar events for a class.

**Response (200):**
```json
[{ "id": "...", "date": "2026-04-22", "title": "Math Test", "type": "Test" }]
```

---

### POST /classes/:classId/events
Create one or more calendar events. Accepts a single event object or a non-empty array of events.

**Request:**
```json
{ "id": "evt_1", "date": "2026-04-22", "title": "Math Test", "type": "Test", "description": "..." }
```
Valid types: `Classwork`, `Test`, `Exam`, `Holiday`, `Other`.

**Response (200):** `{ "success": true }`

---

### PUT /events/:id
Update an event.

**Response (200):** `{ "success": true }`

---

### DELETE /events/:id
Delete an event.

**Response (200):** `{ "success": true }`

## Daily Notes

### GET /classes/:classId/daily-notes
Get daily notes keyed by date.

**Response (200):**
```json
{ "2026-04-22": "Students were active today..." }
```

---

### POST /classes/:classId/daily-notes
Save a daily note.

**Request:**
```json
{ "date": "2026-04-22", "note": "Students were active today..." }
```

**Response (200):** `{ "success": true }`

## Timetable

### GET /classes/:classId/timetable
Get weekly timetable slots for a class.

**Response (200):**
```json
[
  { "id": "...", "dayOfWeek": 1, "startTime": "08:00", "endTime": "09:00", "subject": "Math", "lesson": "Algebra" }
]
```

---

### POST /classes/:classId/timetable
Add a timetable slot.

**Request:**
```json
{ "dayOfWeek": 1, "startTime": "08:00", "endTime": "09:00", "subject": "Math", "lesson": "Algebra" }
```

**Response (201):** `{ "success": true }`

---

### PUT /timetable/:id
Update a timetable slot.

**Response (200):** `{ "success": true }`

---

### DELETE /timetable/:id
Delete a timetable slot.

**Response (200):** `{ "success": true }`

## Seating

### GET /classes/:classId/seating
Get seating layout.

**Response (200):**
```json
{ "seat_1": "student_123", "seat_2": "student_456" }
```

---

### POST /classes/:classId/seating
Update a single seat.

**Request:**
```json
{ "seatId": "seat_1", "studentId": "student_123" }
```
Set `studentId: null` to clear a seat.

**Response (200):** `{ "success": true }`

---

### PUT /classes/:classId/seating
Replace entire seating layout.

**Request:**
```json
{ "seat_1": "student_123", "seat_2": "student_456" }
```

**Response (200):** `{ "success": true }`

---

### DELETE /classes/:classId/seating
Clear the seating layout.

**Response (200):** `{ "success": true }`

## Invites

### GET /classes/:classId/invites
List active invites for a class. Requires class teacher or owner role.

**Response (200):**
```json
[
  { "code": "ABC123", "role": "teacher", "expiresAt": "...", "usedBy": null }
]
```

---

### POST /classes/:classId/invites
Create an invite code. Requires class teacher or owner role.

**Request:**
```json
{ "role": "teacher", "expiresInHours": 168 }
```
Default expiry 48h, max 720h (30 days). Default role: `teacher` (`teacher` or `assistant`).

**Response (200):**
```json
{
  "success": true,
  "code": "inv-abc123def456",
  "inviteUrl": "http://localhost:3000/invite/inv-abc123def456",
  "role": "teacher",
  "expiresAt": "2026-11-17T07:00:00.000Z"
}
```

---

### DELETE /classes/:classId/invites/:code
Delete an invite code belonging to `:classId`.

**Response (200):** `{ "success": true }`

---

### POST /invites/redeem
Redeem an invite code to join a class within the caller's school. Rate-limited to 10/15min per IP. Returns a generic error message regardless of failure reason (F-012, prevents enumeration).

**Request:**
```json
{ "code": "inv-abc123def456" }
```

**Response (200):**
```json
{ "success": true, "className": "Math Class", "role": "teacher" }
```

**Errors:** `404` or `400` `{ "error": "Invalid or expired invite code" }` (generic — same message for invalid, expired, used, or cross-school invite)

## Sessions

### GET /sessions
List active sessions for current teacher.

**Response (200):**
```json
[
  { "id": "...", "device_name": "Chrome", "created_at": "...", "expires_at": "...", "is_revoked": 0 }
]
```

---

### POST /sessions/revoke
Revoke a session. Requires authentication.

**Request:**
```json
{ "sessionId": "..." }
```
Use `sessionId: "all"` to revoke every session for the current teacher.

**Response (200):** `{ "success": true }`

## Teachers

### POST /teachers/register
Register a new teacher in the caller's school. Requires Administrator or Homeroom Teacher (`owner`) role. For non-default schools, the username is automatically qualified as `username@schoolCode`.

**Request:**
```json
{ "username": "teacher1", "password": "***", "name": "John Smith" }
```

**Response (200):**
```json
{ "success": true, "id": "teacher_...", "username": "teacher1", "name": "John Smith", "schoolId": "school_default" }
```

---

### GET /teachers
List all teachers in the caller's school.

**Response (200):**
```json
[
  { "id": "...", "username": "admin", "name": "Administrator", "school_id": "school_default", "created_at": "..." }
]
```

## Admin

All admin endpoints require authentication AND `is_admin = 1`, enforced by `adminRouter.use(requireAuth, requireAdmin)` (F-011) at the router level.
- **School-scoped admin endpoints** (`/admin/settings`) are accessible to any school administrator and scope keys to the caller's `school_id`.
- **System-wide admin endpoints** (`/admin/database/*`, `/admin/profiling/*`, `/admin/metrics*`, `/admin/resources*`) additionally enforce `requireSystemAdmin` (restricted to administrators of the primary `school_default` tenant).

### GET /admin/settings
Get all settings for the caller's school.

**Response (200):**
```json
{ "theme": "light", "schoolName": "Teacher Assistant" }
```
`adminPassword` is intentionally excluded from this response.

---

### POST /admin/settings
Update a setting for the caller's school (or update the caller's admin password when `key === "adminPassword"`).

**Request:**
```json
{ "key": "theme", "value": "dark" }
```

**Response (200):** `{ "success": true }`

---

### POST /admin/database/backup
Download database backup as a binary SQLite file. Requires `requireSystemAdmin`.

**Response:** Binary SQLite file download (`Content-Disposition: attachment; filename="database.sqlite"`)

---

### POST /admin/database/restore
Restore from backup. Requires `requireSystemAdmin`.

**Request:** raw SQLite bytes (`Content-Type: application/octet-stream`)

**Limits:** max payload 25MB

**Response:** `{ "success": true, "message": "Database restored successfully. Refresh to apply changes." }`

**Errors:**
- `403` system administrator access required
- `415` unsupported content type
- `413` backup too large
- `400` invalid SQLite payload

---

### POST /admin/profiling/query
Profile a SQL statement. Requires `requireSystemAdmin`.

**Restriction:** only a single `SELECT` statement is allowed (no semicolons).

**Request:**
```json
{ "sql": "SELECT * FROM teachers LIMIT 10" }
```

**Response (200):** profile details plus optimization score (`{ ...result, score }`).

**Errors:**
- `400` missing/invalid SQL
- `400` non-SELECT or multi-statement SQL

---

### GET /admin/profiling/statements
Profile representative prepared statements with SQLite `EXPLAIN QUERY PLAN`. Requires `requireSystemAdmin`.

**Response (200):**
```json
{
  "message": "Use POST /api/admin/profiling/query with { \"sql\": \"SELECT ...\" } to profile specific queries.",
  "example": { "sql": "SELECT * FROM students WHERE class_id = ? AND archived = 0" },
  "statements": [{ "name": "getStudentsByClass", "profile": {...}, "score": 100 }]
}
```

---

### GET /admin/profiling/indexes
List all indexes in the database with their columns. Requires `requireSystemAdmin`.

**Response (200):**
```json
{ "indexes": [...] }
```

---

### GET /admin/profiling/stats
Get table statistics (row counts, index count, total rows). Requires `requireSystemAdmin`.

**Response (200):**
```json
{ "tables": [...], "indexCount": 24, "totalRows": 150 }
```

---

### GET /admin/metrics
Get aggregated in-memory metrics (request counts, latency percentiles, query stats) and circular buffer status. Requires `requireSystemAdmin`.

**Query params:**
- `window` (optional, minutes; default 60)

**Response (200):**
```json
{
  "summary": { "requestsPerMinute": 12, "avgResponseTime": 18, "slowRequestCount": 0, "errorRate": 0 },
  "bufferInfo": { "requestCount": 120, "queryCount": 45, "maxSize": 10000 },
  "metrics": {
    "requests": { "total": 120, "successful": 120, "failed": 0, "avgDuration": 18, "p50": 12, "p95": 45, "p99": 90, "slowest": [...], "byMethod": {...}, "byEndpoint": {...} },
    "queries": { "total": 45, "avgDuration": 2, "slowest": [...] },
    "timeRange": { "start": 1731200000000, "end": 1731203600000 }
  }
}
```

---

### GET /admin/metrics/summary
Aggregated metrics summary and buffer info. Requires `requireSystemAdmin`.

**Response (200):**
```json
{
  "summary": { "requestsPerMinute": 12, "avgResponseTime": 18, "slowRequestCount": 0, "errorRate": 0 },
  "bufferInfo": { "requestCount": 120, "queryCount": 45, "maxSize": 10000 }
}
```

---

### DELETE /admin/metrics
Clear in-memory metrics store. Requires `requireSystemAdmin`.

**Response (200):** `{ "success": true, "message": "Metrics cleared" }`

---

### GET /admin/resources
Current resource snapshot (CPU, memory, event loop lag). Requires `requireSystemAdmin`.

**Response (200):**
```json
{ "current": {...}, "status": "ok" }
```

---

### GET /admin/resources/history
Resource usage history over a time window. Requires `requireSystemAdmin`.

**Query params:**
- `window` (optional, minutes; default 60)

**Response (200):**
```json
{ "current": {...}, "history": [...], "stats": {...}, "status": "ok" }
```

---

### GET /admin/resources/alerts
Active alerts (high CPU, memory pressure, event loop lag). Requires `requireSystemAdmin`.

**Query params:**
- `window` (optional, minutes; default 60)

**Response (200):**
```json
{ "alerts": [...] }
```

## Validation Schemas

| Schema | Fields |
|--------|--------|
| `loginSchema` | username (1-100), password (1-200), schoolCode (max 64, optional) |
| `registerSchoolSchema` | schoolName (1-200), schoolCode (2-64, `[a-zA-Z0-9_-]+`), username (1-100), password (4-200), adminName (1-200) |
| `classSchema` | id (max 100), name (1-200) |
| `studentSchema` | id (max 100), name (1-200), rollNumber (1-100), parentName, parentPhone, isFlagged |
| `attendanceRecordSchema` | studentId, classId, date (YYYY-MM-DD), status (Present/Absent/Sick/Late), reason |
| `attendanceRecordsPayloadSchema` | single object OR non-empty array of attendance records |
| `eventSchema` | id, date (YYYY-MM-DD), title (1-200), type (Classwork/Test/Exam/Holiday/Other), description |
| `eventPayloadSchema` | single `eventSchema` OR non-empty array of `eventSchema` |
| `eventUpdateSchema` | partial `eventSchema` without `id` |
| `timetableSlotSchema` | id, dayOfWeek (0-6), startTime (HH:MM), endTime (HH:MM), subject, lesson |
| `timetableSlotUpdateSchema` | dayOfWeek (0-6), startTime (HH:MM), endTime (HH:MM), subject, lesson (no id) |
| `teacherSchema` | username (1-100), password (4-200), name (1-200) |
| `settingSchema` | key (1-100), value (1-10000) |
| `dailyNotePayloadSchema` | date (YYYY-MM-DD), note (max 5000, sanitized) |
| `seatingSeatUpdatePayloadSchema` | seatId (1-100), studentId (max 100 \| null) |
| `seatingLayoutPayloadSchema` | Record\<seatId, studentId\> (string map, sanitized) |
| `classUpdateSchema` | name (1-200) |
| `classTeacherAddSchema` | teacherId (1-100) |
| `classTeacherRoleUpdateSchema` | role (owner \| teacher \| assistant) |
| `classInviteCreateSchema` | role (teacher \| assistant, optional), expiresInHours (1-720, optional) |
| `inviteRedeemSchema` | code (1-100, non-empty) |
| `sessionRevokeSchema` | sessionId (string, required; special value "all" supported) |
| `studentUpdateSchema` | partial Student fields, at least 1 field required |
| `studentSyncItemSchema` | `studentSchema` + optional `isArchived` |
| `studentSyncPayloadSchema` | students (array of `studentSyncItemSchema`) |

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Validation error (with details) |
| 401 | Authentication required |
| 403 | Permission denied |
| 404 | Not found |
| 413 | Payload too large (e.g., backup >25MB, JSON >100kb) |
| 415 | Unsupported media type |
| 429 | Rate limited |
| 500 | Server error |
| 503 | Service unavailable (e.g., DB unavailable) |

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| `POST /auth/login` | 150 / 15min / IP |
| All other write endpoints | 500 / 15min / IP |
| `POST /invites/redeem` | 10 / 15min / teacher (or IP fallback) |

Limits are configurable via `express-rate-limit` env vars. Tests bypass rate limits automatically.
