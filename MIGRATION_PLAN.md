# Migration Plan: Teacher Assistant to Multi-User Support

## Version: 1.0
## Last Updated: 2026-04-01
## Branch: develop

---

## Overview

This document outlines the complete migration plan to scale Teacher Assistant from a single-user personal tool to a multi-user system suitable for departmental/school-wide deployment (10-50+ concurrent users).

---

## Current Architecture Analysis

### Database Layer (db.ts) - ALREADY WAL-ENABLED ✅
- WAL mode enabled for concurrent reads
- Connection timeout: 5000ms
- Optimized pragmas: synchronous=NORMAL, cache_size=64MB, temp_store=MEMORY, mmap_size=256MB
- Pre-compiled statements for performance
- Periodic WAL checkpoint every 60s

### API Layer (routes.ts) ✅ + ⚠️
- Rate limiting implemented (auth: 5 attempts/15min, POST: 100/15min)
- JWT-based authentication with 7-day expiry
- Prepared statements (SQL injection safe)
- ⚠️ NO connection pooling (single connection)
- ⚠️ NO request queuing
- ⚠️ Teacher isolation NOT verified in all queries

### Frontend (React + Zustand) ✅
- Zustand store for local state management
- API calls via fetch to /api endpoints

---

## Migration Phases

### PHASE 1: Foundation (Required for ANY multi-user)

**Goal:** Secure the architecture so ANY multi-user scenario works correctly.

#### 1.1 Teacher Isolation in ALL Queries (CRITICAL)
- **Problem:** Currently only verifies teacher owns the CLASS, not that they have access to the specific data
- **Solution:** ALL queries must verify class access via `class_teachers` table
- **Files:** `routes.ts`
- **Impact:** High - security fix

```sql
-- BEFORE (current - dangerous for multi-user)
SELECT * FROM students WHERE class_id = ?

-- AFTER (required for multi-user)
SELECT * FROM students 
WHERE class_id = ? 
AND class_id IN (SELECT class_id FROM class_teachers WHERE teacher_id = ?)
```

#### 1.2 Connection Pooling
- **Problem:** Single connection cannot handle concurrent requests
- **Solution:** Implement connection pool with better-sqlite3
- **Files:** `db.ts`
- **Impact:** Medium - performance

#### 1.3 Request Queueing for Writes
- **Problem:** Concurrent writes cause DB lock contention
- **Solution:** Serialize write operations while allowing concurrent reads
- **Files:** `routes.ts` (middleware)
- **Impact:** Medium - reliability

#### 1.4 Add updated_at for Optimistic Locking
- **Problem:** No way to detect if data changed since last read
- **Solution:** Add timestamp columns for conflict detection
- **Files:** `db.ts` (schema), `routes.ts` (updates)
- **Impact:** Low - data integrity

---

### PHASE 2: Multi-Teacher Support

**Goal:** Enable multiple teachers to collaborate on same classes.

#### 2.1 Role-Based Access Control
- **Roles:** owner, admin, teacher, assistant
- **Implementation:** Add role column to class_teachers table

#### 2.2 Invite System
- **Flow:** 
  1. Owner generates invite link/code
  2. New teacher registers with code
  3. System links them to class
- **Files:** New routes + UI components

#### 2.3 Session Management
- **Purpose:** Track active sessions per teacher
- **Features:** Device naming, active sessions list, force logout

---

### PHASE 3: Real-Time Data Sync

**Goal:** Teachers see each other's changes without manual refresh.

#### 3.1 Poll-Based Sync (Simple)
- **Implementation:** Refresh data every 30-60 seconds
- **Files:** `store.ts` (polling hook)
- **Complexity:** Low

#### 3.2 WebSocket (Future - if needed)
- **Only if:** Poll-based insufficient for use case
- **Complexity:** High

---

### PHASE 4: Performance at Scale

**Goal:** Support 10-50+ concurrent users.

#### 4.1 Query Optimization
- Add compound indexes for common patterns
- Optimize expensive queries

#### 4.2 Caching Layer
- Cache frequently accessed data in memory

#### 4.3 Batch Operations
- Optimize bulk inserts/updates

---

### PHASE 5: PostgreSQL Migration (Future)

**Goal:** If SQLite limits reached (50+ concurrent users), migrate to PostgreSQL.

#### 5.1 Data Layer Abstraction
- Create repository interfaces
- Separate SQLite-specific code into adapters

#### 5.2 Keep API Same
- Minimal changes to route handlers

---

## Implementation Checklist

| # | Task | Phase | Files | Status |
|---|------|-------|-------|--------|
| 1 | Teacher Isolation - ALL queries verify class access | 1.1 | routes.ts | ⬜ |
| 2 | Connection Pooling | 1.2 | db.ts | ⬜ |
| 3 | Request Queueing for Writes | 1.3 | routes.ts | ⬜ |
| 4 | Add updated_at columns | 1.4 | db.ts | ⬜ |
| 5 | Role-Based Access Control | 2.1 | db.ts, routes.ts | ⬜ |
| 6 | Invite System API | 2.2 | routes.ts | ⬜ |
| 7 | Invite System UI | 2.2 | React components | ⬜ |
| 8 | Session Management | 2.3 | db.ts, routes.ts | ⬜ |
| 9 | Poll-Based Sync | 3.1 | store.ts | ⬜ |
| 10 | Query Optimization | 4.1 | db.ts | ⬜ |

---

## Risk Mitigation

| Risk | Mitigation Strategy |
|------|---------------------|
| Query injection via classId | ALWAYS verify class ownership via class_teachers |
| Race conditions | Add updated_at checks + serialize writes |
| Lost writes | Use write queue to prevent DB locks |
| Performance degradation | Monitor with request timing logs |
| Data loss on migration | Full backup before any schema change |

---

## Testing Strategy

### Unit Tests
- Test each new DB function
- Test API endpoint security (verify isolation)

### E2E Tests (Existing)
- Already have comprehensive test suite
- Add tests for multi-teacher scenarios

### Performance Tests
- Load test with multiple concurrent users
- Measure response times under load

---

## Codebase Reference

### Key Files to Modify

| File | Purpose | Changes Needed |
|------|---------|----------------|
| `db.ts` | Database layer | Schema changes, connection pool, prepared statements |
| `routes.ts` | API endpoints | All queries need teacher isolation, new routes for invites/sessions |
| `store.ts` | Frontend state | Add polling, session management |
| `Sidebar.tsx` | Navigation | Add invite UI |
| `InviteTeacherModal.tsx` | New component | Invite system UI |

### Key Tables

| Table | Purpose | Changes |
|-------|---------|---------|
| `teachers` | Teacher accounts | Add last_login, device_info |
| `classes` | Class metadata | Add updated_at |
| `students` | Student records | Add updated_at |
| `attendance_records` | Attendance data | Add updated_at |
| `class_teachers` | Teacher-class access | Add role column, session tracking |
| `user_sessions` | (NEW) Active sessions | New table for session management |

---

## Notes

- **Phase 1 is CRITICAL** - Without it, multi-user introduces security vulnerabilities
- Current e2e tests work but can have flaky runs when all tests share DB (expected)
- Keep main branch clean, all changes on `develop` branch
- Test each phase thoroughly before moving to next

---

## Future Considerations

- Docker deployment for easier scaling
- Cloud backup (already partially implemented)
- Mobile-responsive UI (already done)