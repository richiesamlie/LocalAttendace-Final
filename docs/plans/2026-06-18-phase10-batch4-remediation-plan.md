# Phase 10 Batch 4 — Architectural Hardening Plan

> Branch: `develop`
> Mode: incremental; commits ordered least-risky → most-risky
> Skipped per user (already accepted as risk): F-003 (password length)

## Scope

| ID | Title | Severity | Effort | Risk |
|----|-------|----------|--------|------|
| F-023 | performanceMonitor logs PII in URLs | Low | XS | Low |
| F-022 | `/api/classes/:classId` mounted twice | Low | XS | Low |
| F-018 | Socket.IO CORS allowRequest checker | Medium | S | Low |
| F-016 | Sync I/O in request paths (fs.*Sync) | Medium | S | Low |
| F-017 | server-error.log via appendFileSync (hot path) | Medium | S | Low |
| F-011 | Extract `requireAdmin` middleware | Medium | M | Low |

## Execution Order (least → most risky)

### Step 1: F-023 — performanceMonitor URL/PII sanitization
**Risk:** Low. Logs already collected; just need to scrub PII.

**Change:**
- Review `src/middleware/performance.ts`
- Sanitize URLs that contain IDs before logging (replace with hash)
- Skip logging of request bodies entirely
- Add config flag to disable verbose mode in production

### Step 2: F-022 — Dedupe student routes mount
**Risk:** Low. Two mount points `/classes` and `/students` both route
to `studentRouter`. Need to verify RBAC parity.

**Change:**
- Confirm RBAC checks are identical at both mount points
- Document the dual-mount as a deprecation alias with comment
- (Out of scope: removing the alias since that would break clients)

### Step 3: F-018 — Socket.IO custom allowRequest checker
**Risk:** Low. Defense-in-depth on top of existing `cors: { origin }`.

**Change:**
- Add `allowRequest` callback to Socket.IO server options
- Validates Origin header against `getAllowedOrigins()` AND
  requires a valid `auth_token` cookie (or `token` handshake field)
- Reject handshake if either check fails

### Step 4: F-016 — Sync I/O migration
**Risk:** Low. Performance improvement, no behavior change.

**Change:**
- `server.ts` global error handler: `fs.appendFileSync` → write to
  an async stream (handled in F-017 step)
- `admin.routes.ts` backup/restore: `fs.copyFileSync` → `fs.promises.copyFile`
- `fs.existsSync` → `fs.promises.access`
- `fs.mkdirSync` → `fs.promises.mkdir`

### Step 5: F-017 — Async error log stream
**Risk:** Low. Closes the hot-path sync fs from F-016 + F-017.

**Change:**
- Replace `appendFileSync('server-error.log', ...)` with a
  module-level `fs.createWriteStream` opened at boot
- Add write-stream backpressure handling
- Include timestamp + correlation ID in each entry

### Step 6: F-011 — Extract requireAdmin middleware
**Risk:** Low (touches many lines, but pattern is mechanical).

**Change:**
- New `requireAdmin: RequestHandler` in `src/routes/middleware.ts`
  that calls requireAuth + checks `is_admin` from JWT payload
- Replace ~20 instances in `admin.routes.ts` of:
  ```typescript
  const caller = await teacherService.getById(callerId);
  if (!caller || !(caller as Teacher).is_admin) return res.status(403)...
  ```
  with `adminRouter.use(requireAdmin)`
- Source-grep test verifies no admin route is missing the middleware

## Commit Strategy

Each finding → 1 commit (test + impl combined for small ones, separate
for larger ones like F-011).

## Verification (end of batch)

- `npm run lint` clean
- `npm run lint:eslint --max-warnings=0` clean
- `npm run test:critical` passing (target: 133 + 25-30 new = ~160)
- `npm run build` succeeds
- `npm audit --omit=dev --audit-level=high` still 0 HIGH

## Out of Scope (deferred)

- **RES-1** carry-forward: fix `user_sessions.deleteExpiredSessions` 
  ISO 8601 issue. Will check as a small bonus.
- **Batch 5:** Docker & ops (F-028, F-029, F-027)
- **Batch 6:** Hygiene (F-015, F-026)

## Reference

- Audit source: `C:\repo\audit\localattendance\SECURITY_RESIDUAL_RISK_REGISTER.md`
- Batches 1+2+3 closeouts: `docs/plans/2026-06-18-phase10-batch{1,2,3}-remediation-report.md`