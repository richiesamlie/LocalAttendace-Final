# Codebase Improvement Plan

**Last Updated:** 2026-04-20 (Phase 1 complete)
**Project:** Teacher Assistant (c:/repo)
**Branch:** improvement/phase-1

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Priority Classification](#2-priority-classification)
3. [High Priority Items](#3-high-priority-items)
4. [Medium Priority Items](#4-medium-priority-items)
5. [Low Priority Items](#5-low-priority-items)
6. [What's Working Well](#6-whats-working-well)
7. [Implementation Phases](#7-implementation-phases)
8. [Rollback Plan](#8-rollback-plan)

---

## 1. Executive Summary

This project is a well-structured, well-documented local-first classroom management app. Security is solid, documentation is excellent, and the database layer is performant. However, there are architectural issues that create maintenance burden and risk of regression as the codebase grows.

**Tech Stack:** React 19 + TypeScript + Vite (frontend), Express + better-sqlite3 (backend), Zustand + React Query (state)

**Key Numbers:**
- ~80 source files, ~60 TypeScript files
- 4 monolithic backend files: `routes.ts` (974L), `services.ts` (716L), `db.ts` (581L), `store.ts` (813L)
- 1 unit test file with 4 tests, 7 E2E test files
- 2000+ lines of documentation across 4 docs files

---

## 2. Priority Classification

| Priority | Impact | Effort | Items |
|----------|--------|--------|-------|
| **High** | Architectural defects that create maintenance burden or risk | Medium-Low | 3 items |
| **Medium** | Code quality / developer experience | Medium | 3 items |
| **Low** | Polish / nice-to-have | Low | 3 items |

---

## 3. High Priority Items

### H1: Remove or Utilize the Broken Repository Layer

**Status: RESOLVED.** The `src/repositories/` directory (10+ files, ~920 lines) has been deleted on branch `improvement/phase-1`. It was confirmed completely unused — no code imported from it. The `SQLiteClassRepository` made HTTP calls (`api.getClasses()`) instead of direct DB access. All actual DB access flowed through `db.ts` prepared statements and `services.ts` directly.

The `postgres.ts` helper (Pool, query, queryOne, pgTransaction) was inside `src/repositories/` but WAS used by `services.ts` for PostgreSQL support. It was moved to `src/lib/postgres.ts` rather than deleted.

**Affected Files (deleted):**

---

### H2: Split Monolithic Backend Files

**Problem:** Four files exceed 500 lines and do too many things:

| File | Lines | Responsibilities |
|------|-------|-----------------|
| `routes.ts` | 974 | All 40+ API endpoints + 5 middleware types + auth + rate limiting |
| `services.ts` | 716 | All DB access via `db.stmt.*` for 7 entities |
| `db.ts` | 581 | Schema + 57 prepared statements + cache + write queue + migrations |
| `store.ts` | 813 | Zustand store with 30+ actions + all entity types |

**Why This Matters:**
- Hard to navigate (find-in-file is the only way)
- Can't have multiple people editing safely
- High risk of merge conflicts
- Tests require importing entire files
- Circular dependency risk (all import from each other)

**Solution:**

**Phase H2a — Split `routes.ts` (974 lines → 10-15 route modules)**
```
src/routes/
├── index.ts           # Express router aggregation + middleware setup
├── auth.routes.ts     # /auth/* endpoints
├── class.routes.ts    # /classes/* endpoints  
├── student.routes.ts  # /students/* + /classes/:id/students/*
├── record.routes.ts   # /records/*
├── event.routes.ts    # /events/*
├── timetable.routes.ts
├── seating.routes.ts
├── note.routes.ts
├── invite.routes.ts   # /invites/*
├── session.routes.ts
├── admin.routes.ts    # /settings, /database/*
└── teacher.routes.ts  # /teachers/*
```

**Phase H2b — Split `services.ts` (715 lines → 7 service files)**
`services.ts` is a backend monolith containing 7 service objects (teacherService, classService, studentService, recordService, eventService, timetableService, seatingService, noteService, sessionService, inviteService). There is also a `src/services/` directory but it contains CLIENT-SIDE API wrappers that make HTTP calls, not a split of the backend services. The true backend services are all in `services.ts` (root).

**Status:** Confirmed — there are TWO service layers: (1) `services.ts` (root, 715L, backend, direct DB) and (2) `src/services/` (frontend, HTTP API wrappers). They are unrelated. The backend monolith remains.

**Phase H2c — Split `db.ts` (581 lines → logical modules)**
```
src/db/
├── connection.ts      # SQLite connection setup, WAL, pragmas
├── schema.ts          # CREATE TABLE statements
├── statements.ts      # 57 prepared statements (grouped by table)
├── cache.ts           # In-memory TTL cache
├── writeQueue.ts      # Serialized write queue
├── migrations.ts      # Schema migration helpers
└── index.ts           # Re-exports db proxy
```

**Phase H2d — Split `store.ts` (813 lines → logical slices)**
```
src/store/
├── index.ts           # Store aggregation
├── slices/
│   ├── auth.ts        # Auth-related state + actions
│   ├── classSlice.ts  # Classes + currentClass state
│   ├── studentSlice.ts
│   ├── recordSlice.ts
│   ├── eventSlice.ts
│   ├── timetableSlice.ts
│   ├── seatingSlice.ts
│   └── uiSlice.ts     # Theme, loading, lastAttendanceChange
└── middleware/
    └── persist.ts     # (future: localStorage persistence)
```

**Effort:** High (3-5 hours across 4 files)
**Risk:** Medium (many imports to update; use feature branches + test)

---

### H3: Type Safety — Eliminate `as any` Casts

**Problem:** Heavy use of `as any` throughout, especially in:

| File | Count | Notable Examples |
|------|-------|-----------------|
| `routes.ts` | ~10 | `updateData: any = {}` (L646), `teacher as any`, student ID casts |
| `store.ts` | ~3 | `as unknown as ClassData` casts in initializeStore |
| `App.tsx` | ~2 | Auth state casts |

**Why This Matters:**
- TypeScript's type checking is defeated — bugs that TS could catch are silently ignored
- Refactoring is dangerous when types are `any`
- The API boundary between client/server has no type sharing

**Solution:**

1. **Audit all `as any` occurrences** — For each one, either:
   - Fix the actual type (preferred)
   - Use `unknown` + type guard if truly dynamic
   - Use `// eslint-disable-next-line @typescript-eslint/no-explicit-any` with a comment explaining WHY it's safe (rare cases)

2. **Create shared DTO types** — The `api.ts` uses generics `<T>` but endpoints return inconsistent shapes. Create a `src/types/dto.ts` with request/response types used by BOTH client and server.

3. **Validation middleware consistency** — Not all routes use `validate(schema)` middleware. Some parse bodies manually. Standardize.

**Effort:** Medium (2-3 hours to audit and fix)
**Risk:** Low (behavior-preserving refactors)

---

## 4. Medium Priority Items

### M1: Dual State Management Confusion

**Problem:** The app uses BOTH Zustand (`store.ts`) AND React Query (`useData.ts`). The store has `classes[]` (per-class data) AND flat fields (`students`, `records`, etc. for current class). Components read from flat fields. But React Query hooks also exist for all data types.

**Confusion Points:**
- When to use `useStore(s => s.students)` vs `useStudents(classId)` hook?
- `updateCurrentClass()` helper tries to keep `classes[]` and flat fields in sync — error-prone
- `loadClassData` has a `loaded` flag that can be stale

**Current State (from AGENT_HANDOFF.md):**
- Cross-cutting concern #3 (Request Deduplication) was marked FIXED — React Query hooks added
- Store still exists and is the primary state source
- Components still use Zustand directly

**Decision Required — Two Options:**

**Option A: Consolidate on Zustand** — Keep Zustand as single source of truth. Remove React Query hooks (or deprecate them). Use Zustand for all state; React Query's deduplication isn't needed since Zustand already deduplicates via `loadClassData` guard.

**Option B: Consolidate on React Query** — Migrate all components to use React Query hooks. Zustand becomes UI-only state (theme, loading, currentClassId). This requires refactoring all 15 components.

**Option C: Keep hybrid, document clearly** — The hybrid approach works. Add a `STATE_MANAGEMENT.md` doc explaining which layer to use for what. Improve `updateCurrentClass` to be less error-prone.

**Recommendation:** Option C. The hybrid already works. The real issue is `updateCurrentClass` complexity. Refactor it to be a proper derived state mechanism.

**Effort:** Medium (1-2 hours to add docs + refactor `updateCurrentClass`)
**Risk:** Low

---

### M2: Test Coverage Expansion

**Problem:**
- Only 1 unit test file (`store.test.ts`) with 4 tests
- No test coverage reporting configured
- No integration tests for API routes
- E2E tests share a DB (flaky)

**Solution:**

1. **Add unit tests** for:
   - `src/lib/validation.ts` — Zod schema validation
   - `src/lib/errorHandler.ts` — Error factory + handler
   - `src/utils/excel.ts` — Parse/export logic (complex, 673 lines)
   - `src/db.ts` — Write queue, cache TTL (with mocks)
   - Each service file — business logic

2. **Add API integration tests** using Supertest:
   ```typescript
   // e.g., src/test/routes/auth.test.ts
   describe('POST /auth/login', () => {
     it('returns 401 for invalid credentials', async () => { ... });
     it('sets JWT cookie on success', async () => { ... });
   });
   ```

3. **Configure coverage** with Vitest's built-in coverage:
   ```json
   // vitest.config.ts
   coverage: { reporter: ['text', 'html'], threshold: { lines: 50 } }
   ```

4. **Fix E2E DB isolation** — Use `test.describe.serial` or PerFile cleanup

**Effort:** High (4-6 hours)
**Risk:** Low (tests don't change behavior)

---

### M3: Request Validation Gaps

**Problem:** Some routes don't use the `validate(schema)` middleware:

- `PUT /classes/:id` — validates via manual check, not `classSchema`
- `POST /records` — validates `studentId` belongs to class but not via schema
- Session revoke — minimal validation

**Solution:**
Audit `routes.ts` for all `req.body` usages and ensure each has a Zod schema validation. This is already documented in AGENT_HANDOFF.md section 13.

**Effort:** Low (1-2 hours to audit + fix)
**Risk:** Low

---

## 5. Low Priority Items

### L1: JWT Secret Fallback in Dev Mode

**Problem (routes.ts line 14):**
```typescript
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
```
Even though `DEFAULT_ADMIN_PASSWORD` throws on startup if missing, JWT_SECRET has a fallback. In dev this is fine, but it could accidentally get shipped to production.

**Solution:** Throw on startup if `NODE_ENV === 'production'` and `JWT_SECRET` is not set. Keep fallback for dev only.

**Effort:** 10 minutes
**Risk:** Very low

---

### L2: SQLite Write Queue Async Wrapper

**Problem (db.ts):** The `processWriteQueue` is declared `async` but `better-sqlite3` is synchronous. The await of a sync function is confusing:

```typescript
async function processWriteQueue(): Promise<void> {
  // ...
  await task.fn(); // fn() is synchronous, await is no-op
}
```

**Solution:** Document clearly or refactor the queue to be genuinely async. The current implementation works (sync writes serialize correctly) but the async keyword is misleading.

**Effort:** 30 minutes
**Risk:** Very low

---

### L3: AGENT_HANDOFF.md is 883 Lines

**Problem:** The handoff doc is extremely long. New developers may not read it all. At 883 lines, it's more of a novel than a reference doc.

**Solution:** Split into focused documents:
- `ARCHITECTURE.md` — System design, data flow, security model
- `DEVELOPER_GUIDE.md` — How to add features, coding conventions
- `API_REFERENCE.md` — All endpoints with request/response types (auto-generated)
- `TROUBLESHOOTING.md` — Common issues and fixes
- `CONTRIBUTING.md` — Git workflow, commit conventions

Keep AGENT_HANDOFF.md as a SHORT summary (50-100 lines) pointing to the other docs.

**Effort:** Medium (2-3 hours to split + update)
**Risk:** Very low

---

## 6. What's Working Well

This is important to acknowledge — don't fix what isn't broken:

### Security (Excellent)
- Prepared statements prevent SQL injection
- Helmet security headers + CSP in production
- Rate limiting (5 login/15min, 100 POST/15min)
- JWT with httpOnly cookies + session revocation
- RBAC with teacher isolation via `class_teachers`
- Input sanitization via `safeString()` (null byte stripping)
- Foreign keys with CASCADE delete
- `DEFAULT_ADMIN_PASSWORD` required on startup (no fallback)
- No Authorization header bypass

### Database Layer (Excellent)
- WAL mode with auto-checkpointing
- 64MB cache, 256MB mmap
- 57 pre-compiled prepared statements
- Compound indexes for common query patterns
- In-memory TTL cache (5s/60s) with namespace-aware invalidation
- Write queue preventing "database is locked" errors
- PostgreSQL support with auto-detection

### Documentation (Excellent)
- 391-line README with screenshots, Docker guide, setup instructions
- 883-line AGENT_HANDOFF (comprehensive but too long — see L3)
- Separate docs: REALTIME.md, MIGRATION_PLAN.md, AUDIT_LOG.md, USER_GUIDE.md
- Well-documented scripts and configuration

### Developer Experience (Good)
- `setup-env.ps1` / `setup-env.sh` for secret generation
- `start-app.bat` / `start-app.sh` for easy startup
- Database backup/restore with pruning (keeps last 10)
- Color-coded request logger
- react-hot-toast for all user notifications (zero alert/confirm remaining)

### Code Quality (Good)
- Zod validation with field-level error details
- Error boundary for React components
- React.lazy() + Suspense for code splitting
- useClickOutside hook for all dropdowns
- Numeric-aware sort consistently applied across all pages

### CI/CD (Good)
- GitHub Actions with type check + build + test
- Multi-stage Docker build with health checks
- Automated releases with versioning

---

## 7. Implementation Phases

### Phase 1: Quick Wins (1-2 hours total)
- [x] **H1:** Remove broken repository layer (deleted `src/repositories/`). Note: `src/services/` is a client-side API wrapper layer (HTTP calls), NOT a split of the backend `services.ts`. The backend services remain in the monolithic `services.ts` (715L). The plan had incorrectly assumed `services.ts` was already split — it is NOT.
- [x] **L1:** Make JWT_SECRET throw in production mode (added `NODE_ENV === 'production'` guard)
- [x] **M3:** Added explicit validation to `PUT /classes/:id` (was missing any validation)
- [x] **L2:** Documented SQLite write queue async behavior (await is no-op for sync better-sqlite3)

**Before/After:** `tsc --noEmit` passes after each change.

**Note on repositories/postgres.ts:** The `postgresql.ts` helper (Pool, query, queryOne, pgTransaction) was inside `src/repositories/`. Since it IS used by `services.ts`, it was moved to `src/lib/postgres.ts` rather than deleted.

---

### Phase 2: Type Safety (2-3 hours)
- [ ] **H3:** Audit all `as any` casts in routes.ts, store.ts, App.tsx
- [ ] **H3:** Fix each cast with proper types or `unknown`
- [ ] **H3:** Create `src/types/dto.ts` with shared request/response types

**Verification:** Run `tsc --noEmit` — should be cleaner with fewer suppression comments.

---

### Phase 3: File Splitting — Backend (3-4 hours)
- [ ] **H2a:** Split `routes.ts` into `src/routes/` module
- [ ] **H2c:** Split `db.ts` into `src/db/` module

**Detailed Implementation Plan for H2a:**

**Step 1: Create src/routes/middleware.ts** (extract shared middleware)
- JWT_SECRET constant
- requireAuth handler
- requireClassAccess handler
- requireClassOwner handler
- requireRole handler
- withWriteQueue wrapper

**Step 2: Create individual route files** (each module imports middleware)
- src/routes/auth.routes.ts — /auth/* (4 routes)
- src/routes/class.routes.ts — /classes/* (9 routes)
- src/routes/student.routes.ts — /students/* (4 routes)
- src/routes/record.routes.ts — /records/* (2 routes)
- src/routes/event.routes.ts — /events/* (4 routes)
- src/routes/timetable.routes.ts — /timetable/* (4 routes)
- src/routes/seating.routes.ts — /seating/* (4 routes)
- src/routes/invite.routes.ts — /invites/* (4 routes)
- src/routes/session.routes.ts — /sessions/* (2 routes)
- src/routes/teacher.routes.ts — /teachers/* (2 routes)
- src/routes/admin.routes.ts — /settings, /database/* (6 routes)
- src/routes/health.routes.ts — /health (1 route)

**Step 3: Create src/routes/index.ts**
- Re-exports all route routers

**Step 4: Update routes.ts**
- Import all route routers from src/routes/
- Mount them using router.use('/path', routeRouter)

**Critical Notes:**
- DO NOT move service calls to route modules - keep them in routes.ts initially
- Import services as `import * as svc from './services'` (root services.ts)
- Import validation schemas as-is from src/lib/validation.ts
- Each route file should import middleware from ./middleware.ts
- Mount pattern: router.use('/auth', authRouter), router.use('/classes', classRouter), etc.

**Strategy:** Work on a feature branch. Copy file to new location, refactor imports, test locally with `npm run dev`, ensure E2E tests pass before merging.

---

### Phase 4: File Splitting — Frontend (2-3 hours)
- [ ] **H2d:** Split `store.ts` into `src/store/slices/`

**Strategy:** Extract slices one at a time. Test each slice extraction independently.

---

### Phase 5: State Management + Testing (4-6 hours)
- [ ] **M1:** Refactor `updateCurrentClass` helper to reduce sync errors
- [ ] **M1:** Create `STATE_MANAGEMENT.md` doc
- [ ] **M2:** Add unit tests for validation, error handler, excel utils
- [ ] **M2:** Configure coverage reporting in Vitest
- [ ] **M2:** Add API integration tests with Supertest
- [ ] **M2:** Fix E2E DB isolation

---

### Phase 6: Documentation (2-3 hours)
- [ ] **L3:** Split AGENT_HANDOFF.md into ARCHITECTURE.md, DEVELOPER_GUIDE.md, API_REFERENCE.md, TROUBLESHOOTING.md, CONTRIBUTING.md
- [ ] **L3:** Shorten AGENT_HANDOFF.md to 50-100 line summary

---

### Total Estimated Effort

| Phase | Hours | Items |
|-------|-------|-------|
| Phase 1 | 1-2 | 4 |
| Phase 2 | 2-3 | 3 |
| Phase 3 | 3-4 | 2 |
| Phase 4 | 2-3 | 1 |
| Phase 5 | 4-6 | 5 |
| Phase 6 | 2-3 | 2 |
| **Total** | **14-21** | **17** |

---

## 8. Rollback Plan

For each phase:

1. **Before changes:** Run `npm run db:backup` to create a DB snapshot
2. **Work on feature branch** (`improvement/phase-N`)
3. **After each sub-task:** Run `npm run lint` (`tsc --noEmit`) + `npx vitest run`
4. **Test E2E:** `npx playwright test` (sequential, single DB)
5. **Merge to develop** only after all checks pass
6. **If broken:** `git checkout develop && npm run db:restore` to recover

---

## Appendix: File Reference

### Key Files by Priority

| Priority | File | Lines | Notes |
|----------|------|-------|-------|
| H2 | `routes.ts` | 974 | Needs splitting |
| H2 | `store.ts` | 813 | Needs splitting |
| H2 | `services.ts` | 715 | NOT split — confirmed by deep scan, `src/services/` is client-side HTTP wrappers, unrelated |
| H2 | `db.ts` | 581 | Needs splitting |
| H1 | `src/repositories/` | ~400 | Dead code — remove |
| H3 | `routes.ts` | 974 | Many `as any` casts |
| M2 | `src/test/store.test.ts` | ~100 | Only 4 tests |
| L3 | `AGENT_HANDOFF.md` | 883 | Too long |

### Dependencies Tree (Simplified)

```
routes.ts
├── services.ts (7 entity services)
│   └── db.ts (prepared statements + cache + queue)
├── db.ts (connection, schema, migrations)
└── validation.ts (Zod schemas)

store.ts
├── api.ts (fetch wrapper)
│   └── (all API calls)
└── useData.ts (React Query hooks)

App.tsx
├── store.ts (Zustand)
├── useData.ts (React Query)
└── components/ (15+ React components)
```