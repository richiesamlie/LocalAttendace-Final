# API Reference — Teacher Assistant

**Last Updated:** 2026-06-18
**Branch:** `develop`

Base URL: `/api`

---

## Authentication

### POST /auth/login
Login with credentials.

**Request:**
```json
{ "username": "admin", "password": "password123" }
```

**Response (200):**
```json
{ "success": true, "teacherId": "...", "name": "Administrator", "isAdmin": true }
```
Sets `access_token` (1h) and `refresh_token` (7d) cookies (HttpOnly, `__Host-` prefix in production).

**Errors:** 401 — Invalid credentials

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
{ "success": true, "teacherId": "...", "name": "...", "isAdmin": false }
```
Sets new `access_token` (1h) and `refresh_token` (7d) cookies.

**Errors:**
- `404` — refresh token missing, invalid, or expired
- `401` — refresh token has been used before (reuse detected → entire token family revoked)

**Security:** Refresh tokens are SHA-256 hashed at rest. Reuse of an already-rotated token triggers family-wide revocation as defense against stolen-token replay.

---

### GET /auth/verify
Check authentication status. Requires a valid auth cookie/session.

**Response (200):**
```json
{ "authenticated": true, "teacherId": "...", "name": "Administrator" }
```

---

### GET /auth/me
Get current teacher info.

**Response (200):**
```json
{ "id": "...", "username": "admin", "name": "Administrator", "isAdmin": 1 }
```

## Health

### GET /health
Database health check. Constant-time response, no DB-type info leak (F-024).

**Response (200):**
```json
{ "status": "ok", "uptime": 12345, "timestamp": "2026-06-18T12:00:00.000Z" }
```

## Classes

### GET /classes
List classes for current teacher.

**Response (200):**
```json
[
  {
    "id": "class_123",
    "teacher_id": "...",
    "name": "Math Class",
  }
]
```

---

### GET /classes/:classId/dashboard-payload
Get dashboard data (students, attendance, events, notes) for a class in a single response. RBAC enforced via requireClassAccess.

**Response (200):**
```json
{
  "students": [...],
  "attendance": [...],
  "events": [...],
  "notes": {...}
}
```

---

### POST /classes
Create a new class. Requires authentication.

**Request:**
```json
{ "id": "class_123", "name": "Math Class" }
```

**Response (201):** `{ "success": true, "id": "class_123" }`

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
Delete a student. Cascades to attendance records.

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
{ "records": [{ "studentId": "s1", "date": "2026-04-22", "status": "Present" }] }
```

---

### POST /records
Save attendance records. Accepts single object or array.

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
Create an event.

**Request:**
```json
{ "date": "2026-04-22", "title": "Math Test", "type": "Test", "description": "..." }
```
Valid types: `Classwork`, `Test`, `Exam`, `Holiday`, `Other`.

**Response (201):** `{ "success": true }`

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
Default expiry 48h, max 720h (30 days). Default role: teacher.

**Response (201):**
```json
{ "code": "ABC123", "inviteUrl": "http://localhost:3000/invite/ABC123" }
```

---

### DELETE /classes/:classId/invites/:code
Delete an invite code.

**Response (200):** `{ "success": true }`

---

### POST /invites/redeem
Redeem an invite code to join a class. Rate-limited to 10/15min per teacher. Returns generic error message regardless of failure reason (F-012, prevents enumeration).

**Request:**
```json
{ "code": "ABC123" }
```

**Response (200):**
```json
{ "success": true, "className": "Math Class", "role": "teacher" }
```

**Errors:** `404` "Unable to redeem invite" (generic — same for invalid, expired, used, no-such-class)

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
Register a new teacher.

**Request:**
```json
{ "username": "teacher1", "password": "***", "name": "John Smith" }
```

**Response (201):** `{ "success": true }`

---

### GET /teachers
List all teachers.

**Response (200):**
```json
[
  { "id": "...", "username": "admin", "name": "Administrator", "created_at": "..." }
]
```

## Admin

All admin endpoints require authentication AND `is_admin = 1`. This is enforced by `adminRouter.use(requireAuth, requireAdmin)` (F-011) at the router level — no per-handler duplication.

### GET /admin/settings
Get all settings.

**Response (200):**
```json
{ "theme": "light", "schoolName": "Teacher Assistant" }
```
`adminPassword` is intentionally excluded from this response.

---

### POST /admin/settings
Update a setting.

**Request:**
```json
{ "key": "theme", "value": "dark" }
```

**Response (200):** `{ "success": true }`

---

### POST /admin/database/backup
Download database backup as a binary SQLite file.

**Response:** Binary SQLite file download (`Content-Disposition: attachment; filename="database.sqlite"`)

---

### POST /admin/database/restore
Restore from backup.

**Request:** raw SQLite bytes (`Content-Type: application/octet-stream`)

**Limits:** max payload 25MB

**Response:** `{ "success": true }`

**Errors:**
- `415` unsupported content type
- `413` backup too large
- `400` invalid SQLite payload

---

## Validation Schemas

| Schema | Fields |
|--------|--------|
| `loginSchema` | username (1-100), password (1-200) |
| `classSchema` | id (max 100), name (1-200) |
| `studentSchema` | id, name (1-200), rollNumber (1-100), parentName, parentPhone, isFlagged |
| `attendanceRecordSchema` | studentId, classId, date (YYYY-MM-DD), status (Present/Absent/Sick/Late), reason |
| `attendanceRecordsPayloadSchema` | single object OR non-empty array of attendance records |
| `eventSchema` | id, date (YYYY-MM-DD), title (1-200), type (Classwork/Test/Exam/Holiday/Other), description |
| `timetableSlotSchema` | id, dayOfWeek (0-6), startTime (HH:MM), endTime (HH:MM), subject, lesson |
| `timetableSlotUpdateSchema` | dayOfWeek (0-6), startTime (HH:MM), endTime (HH:MM), subject, lesson (no id) |
| `teacherSchema` | username (1-100), password (4-200), name (1-200) |
| `settingSchema` | key (1-100), value (1-10000) |
| `dailyNotePayloadSchema` | date (YYYY-MM-DD), note (max 5000, sanitized) |
| `seatingSeatUpdatePayloadSchema` | seatId (string), studentId (string \| null) |
| `seatingLayoutPayloadSchema` | Record\<seatId, studentId\> (string map, sanitized) |
| `classUpdateSchema` | name (1-200) |
| `classTeacherAddSchema` | teacherId (string) |
| `classTeacherRoleUpdateSchema` | role (owner \| teacher \| assistant) |
| `classInviteCreateSchema` | role (optional), expiresInHours (1-8760, optional) |
| `inviteRedeemSchema` | code (1-100, non-empty) |
| `sessionRevokeSchema` | sessionId (string, required; special value "all" supported) |
| `studentUpdateSchema` | partial Student fields, at least 1 field required |
| `studentSyncPayloadSchema` | students (non-empty array of Student objects) |

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
