# API Reference — Teacher Assistant

**Last Updated:** 2026-04-22
**Branch:** `feature/split-routes-v2`

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
Sets `auth_token` cookie (httpOnly).

**Errors:** 401 — Invalid credentials

---

### POST /auth/logout
Clear auth cookie.

**Response:** `{ "success": true }`

---

### GET /auth/verify
Check authentication status.

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

---

## Health

### GET /health
Database health check.

**Response (200):**
```json
{ "status": "ok" }
```

---

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
    "owner_name": "Administrator",
    "role": "owner"
  }
]
```

---

### POST /classes
Create a new class.

**Request:**
```json
{ "id": "class_123", "name": "Math Class" }
```

**Response (201):** `{ "success": true }`

---

### PUT /classes/:id
Update class name.

**Request:**
```json
{ "name": "Updated Name" }
```

**Response (200):** `{ "success": true }`

---

### DELETE /classes/:id
Delete a class.

**Response (200):** `{ "success": true }`

---

## Class Teachers

### GET /classes/:classId/teachers
List teachers in a class.

**Response (200):**
```json
[
  { "teacher_id": "...", "username": "admin", "name": "Admin", "role": "owner" }
]
```

---

### POST /classes/:classId/teachers
Add teacher to class.

**Request:**
```json
{ "teacherId": "...", "role": "teacher" }
```

**Response (201):** `{ "success": true }`

---

### DELETE /classes/:classId/teachers/:teacherId
Remove teacher from class.

**Response (200):** `{ "success": true }`

---

### PUT /classes/:classId/teachers/:teacherId/role
Update teacher role.

**Request:**
```json
{ "role": "assistant" }
```

**Response (200):** `{ "success": true }`

---

## Students

### GET /classes/:classId/students
List students in a class.

**Response (200):**
```json
[
  {
    "id": "student_123",
    "name": "John Doe",
    "rollNumber": "001",
    "parentName": "Jane Doe",
    "parentPhone": "123-456",
    "isFlagged": false,
    "isArchived": false
  }
]
```

---

### POST /classes/:classId/students
Add a student.

**Request:**
```json
{
  "id": "student_123",
  "name": "John Doe",
  "rollNumber": "001",
  "parentName": "Jane Doe",
  "parentPhone": "123-456"
}
```

**Response (201):** `{ "success": true }`

---

### PUT /students/:id
Update a student.

**Request:**
```json
{
  "name": "Jane Doe",
  "rollNumber": "002",
  "isFlagged": true
}
```

**Response (200):** `{ "success": true }`

---

### DELETE /students/:id
Archive a student (soft delete).

**Response (200):** `{ "success": true }`

---

### POST /classes/:classId/students/sync
Bulk sync students.

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
{ "students": [...] }
```

---

## Attendance Records

### GET /classes/:classId/records
Get attendance records for a class.

**Query:** `?date=2026-04-22`

**Response (200):**
```json
[
  { "studentId": "student_123", "date": "2026-04-22", "status": "Present", "reason": null }
]
```

---

### POST /records
Save attendance records (batch).

**Request:**
```json
[
  { "studentId": "student_123", "classId": "class_123", "date": "2026-04-22", "status": "Present" },
  { "studentId": "student_456", "classId": "class_123", "date": "2026-04-22", "status": "Absent", "reason": "Sick" }
]
```

**Response (200):** `{ "success": true }`

---

## Events

### GET /classes/:classId/events
Get calendar events.

**Response (200):**
```json
[
  { "id": "event_123", "date": "2026-04-22", "title": "Math Test", "type": "Test", "description": "Chapter 5" }
]
```

---

### POST /classes/:classId/events
Create an event.

**Request:**
```json
{ "id": "event_123", "date": "2026-04-22", "title": "Math Test", "type": "Test" }
```

**Response (201):** `{ "success": true }`

---

### PUT /events/:id
Update an event.

**Request:**
```json
{ "title": "Updated Title", "type": "Exam" }
```

**Response (200):** `{ "success": true }`

---

### DELETE /events/:id
Delete an event.

**Response (200):** `{ "success": true }`

---

## Daily Notes

### GET /classes/:classId/daily-notes
Get daily notes.

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

---

## Timetable

### GET /classes/:classId/timetable
Get timetable slots.

**Response (200):**
```json
[
  { "id": "slot_123", "dayOfWeek": 1, "startTime": "09:00", "endTime": "10:00", "subject": "Math", "lesson": "Algebra" }
]
```

---

### POST /classes/:classId/timetable
Create a timetable slot.

**Request:**
```json
{ "id": "slot_123", "dayOfWeek": 1, "startTime": "09:00", "endTime": "10:00", "subject": "Math", "lesson": "Algebra" }
```

**Response (201):** `{ "success": true }`

---

### PUT /timetable/:id
Update a timetable slot.

**Request:**
```json
{ "startTime": "10:00", "endTime": "11:00" }
```

**Response (200):** `{ "success": true }`

---

### DELETE /timetable/:id
Delete a timetable slot.

**Response (200):** `{ "success": true }`

---

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

**Response (200):** `{ "success": true }`

---

### PUT /classes/:classId/seating
Save full seating layout.

**Request:**
```json
{ "seat_1": "student_123", "seat_2": "student_456" }
```

**Response (200):** `{ "success": true }`

---

### DELETE /classes/:classId/seating
Clear seating layout.

**Response (200):** `{ "success": true }`

---

## Invites

### GET /classes/:classId/invites
List invite codes for a class.

**Response (200):**
```json
[
  { "code": "ABC123", "role": "teacher", "created_at": "...", "expires_at": "...", "used_by": null }
]
```

---

### POST /classes/:classId/invites
Create an invite code.

**Request:**
```json
{ "role": "teacher", "expiresIn": "7d" }
```

**Response (201):**
```json
{ "code": "ABC123" }
```

---

### DELETE /classes/:classId/invites/:code
Delete an invite code.

**Response (200):** `{ "success": true }`

---

### POST /invites/redeem
Redeem an invite code.

**Request:**
```json
{ "code": "ABC123" }
```

**Response (200):**
```json
{ "success": true, "className": "Math Class", "role": "teacher" }
```

---

## Sessions

### GET /sessions
List active sessions.

**Response (200):**
```json
[
  { "id": "...", "device_name": "Chrome", "created_at": "...", "expires_at": "...", "is_revoked": 0 }
]
```

---

### POST /sessions/revoke
Revoke a session.

**Request:**
```json
{ "sessionId": "..." }
```

**Response (200):** `{ "success": true }`

---

## Teachers

### POST /teachers/register
Register a new teacher.

**Request:**
```json
{ "username": "teacher1", "password": "password", "name": "John Smith" }
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

---

## Admin

### GET /settings
Get all settings.

**Response (200):**
```json
{ "theme": "light", "adminPassword": "..." }
```

---

### POST /settings
Update a setting.

**Request:**
```json
{ "key": "theme", "value": "dark" }
```

**Response (200):** `{ "success": true }`

---

### GET /database/backup
Download database backup.

**Response:** Binary SQLite file download

---

### POST /database/restore
Restore from backup.

**Request:** Multipart form with `.sqlite` file

**Response:** `{ "success": true }`

---

## Validation Schemas

| Schema | Fields |
|--------|--------|
| `loginSchema` | username (1-100), password (1-200) |
| `classSchema` | id (max 100), name (1-200) |
| `studentSchema` | id, name (1-200), rollNumber (1-100), parentName, parentPhone, isFlagged |
| `attendanceRecordSchema` | studentId, classId, date (YYYY-MM-DD), status (Present/Absent/Sick/Late), reason |
| `eventSchema` | id, date (YYYY-MM-DD), title (1-200), type (Classwork/Test/Exam/Holiday/Other), description |
| `timetableSlotSchema` | id, dayOfWeek (0-6), startTime (HH:MM), endTime (HH:MM), subject, lesson |
| `teacherSchema` | username (1-100), password (4-200), name (1-200) |
| `settingSchema` | key, value |

---

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Validation error (with details) |
| 401 | Authentication required |
| 403 | Permission denied |
| 404 | Not found |
| 500 | Server error |