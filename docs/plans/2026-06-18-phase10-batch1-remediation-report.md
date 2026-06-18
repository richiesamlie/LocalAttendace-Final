# Phase 10 Close-out Report — Batch 1 Remediation (Audit Fixes)

Tanggal: 2026-06-18
Status: COMPLETE — AWAITING DEVELOP → MAIN PROMOTION APPROVAL
Branch: `develop`
Decision: READY for promotion; do NOT push to main without explicit user approval

## Scope
Phased remediation Batch 1 of the audit findings documented in:
- `C:\repo\audit\localattendance\SECURITY_AUDIT_REPORT.md`
- `C:\repo\audit\localattendance\SECURITY_RESIDUAL_RISK_REGISTER.md`

5 Critical/High findings addressed:

| ID | Title | Severity | Commit |
|----|-------|----------|--------|
| F-001 | Socket.IO handshake has NO JWT authentication | 🟠 High | `18d4e2a` |
| F-013 | 5 HIGH npm-audit CVEs in runtime deps | 🟠 High | `d757d03` |
| F-014 | CI gate effect on audit findings unverified | 🟠 High | `6e8b3d2` |
| F-019 | Release zip missing `.env*`/logs/backups exclusions | 🟡 Medium | `38e361b` |
| F-021 | JWT verify doesn't pin algorithm | 🟡 Medium | `b6cc4d1` |

Plus setup commits:
- `452d7a0` — `docs(plans): add phase 10 batch 1 remediation plan`
- `654fd88` — `chore(gitignore): exclude audit/ workdir`

## Execution Summary

### F-021 — JWT algorithm pinning (defense-in-depth)
- Pinned `algorithms: ['HS256']` at 3 `jwt.verify` callsites:
  - `src/routes/middleware.ts:62` (getTeacherId)
  - `src/routes/middleware.ts:78` (requireAuth)
  - `src/routes/auth.routes.ts:54` (logout)

### F-019 — Release zip exclusions
- Added exclusions to `.github/workflows/release.yml`:
  - `*.env*`, `*.log`, `backups/*`, `coverage/*`, `test-results/*`, `spikes/*`, `.github/*`
- Without these, release zip could include `.env` files, server logs, DB backups with PII

### F-014 — CI gate visibility
- Added `if: failure()` steps in `.github/workflows/security.yml` for both
  npm audit and Bun audit jobs
- Failure summary posted to `$GITHUB_STEP_SUMMARY` explains what failed
  and exact remediation steps; warns against bypassing with `continue-on-error`

### F-013 — Dependency CVEs (the big one)
Before: 11 vulnerabilities (1 low, 5 moderate, **5 HIGH**)
After:  3 vulnerabilities (1 low, 2 moderate, **0 HIGH**)

- `npm audit fix --omit=dev` (non-breaking): updated `ws` 8.20.1 → 8.21.0
  (fixes GHSA-96hv-2xvq-fx4p), `engine.io` 6.6.8 → 6.6.9, `express` → 4.22.1
- Added `overrides` + `resolutions` in package.json pinning `ws ^8.21.0`
  to ensure BOTH npm AND bun lockfiles pull a safe version (without this,
  bun picked 8.18.3 — still in vulnerable range)
- Both `package-lock.json` and `bun.lock` updated; ws parity verified

### F-001 — Socket.IO JWT handshake auth (critical fix)
Before: ANY client could connect to `/ws/socket.io` and join any class room
to receive real-time updates (records_updated, students_updated) — leaking
student PII.

After:
- New `verifySocketAuth(headers)` + `parseAuthTokenCookie(...)` helpers in
  `src/routes/middleware.ts` — same JWT + session semantics as HTTP `requireAuth`
- `server.ts` now wires `io.use((socket, next) => ...)` middleware that
  rejects handshakes without valid `auth_token` cookie (UNAUTHORIZED error)
- `join_class` handler now checks `classService.isClassTeacher(classId, teacherId)`
  (global admin bypass); emits 'error' event on denial instead of joining room
- New `src/test/security/auth.socket.security.test.ts` (16 tests)
- Added to `test:critical` npm script — now 8 files, 52 tests total

## Verification Evidence (local)

| Gate | Result |
|------|--------|
| `npm run lint` (tsc --noEmit) | ✅ exit 0 |
| `npm run lint:eslint -- --max-warnings=0` | ✅ exit 0 |
| `npm run test:critical` | ✅ 52/52 passed (was 36) |
| `npm run build` (vite + PWA) | ✅ built dist/sw.js |
| `npm audit --omit=dev --audit-level=high` | ✅ 0 HIGH CVEs (was 5) |

## Residual Risk (carried forward)

Per `SECURITY_RESIDUAL_RISK_REGISTER.md`:

| ID | Title | Notes |
|----|-------|-------|
| F-002/F-003 | bcrypt 10 rounds + admin password min 4 chars | Planned for Batch 3 |
| F-004 | 7-day JWT lifetime, no refresh | Planned for Batch 2 |
| F-005 | JWT dev fallback `'dev-secret-change-in-production'` | Planned for Batch 2 |
| F-006 | Invite redemption TOCTOU race | Planned for Batch 2 |
| F-007 | Admin SQL profiling accepts arbitrary SELECT | Planned for Batch 3 |
| F-008 | No rate limit on invite redeem | Planned for Batch 2 |
| F-009 | JSON body limit 10MB | Planned for Batch 3 |
| F-010 | CSP only enabled in production | Planned for Batch 3 |
| F-011 | Admin endpoints re-check is_admin manually | Planned for Batch 4 |
| F-012 | Admin profiling leaks raw error.message | Planned for Batch 3 |
| F-015 | `.env.backup*` not in .gitignore | Planned for Batch 6 |
| F-016/F-017 | Sync FS in request paths / error handlers | Planned for Batch 4 |
| F-018 | Socket.IO CORS not origin-tightened | Planned for Batch 4 |
| F-020 | No `__Host-` cookie prefix | Planned for Batch 2 |
| F-022 | Student router mounted twice | Planned for Batch 4 |
| F-023 | Performance logs URLs with IDs | Planned for Batch 4 |
| F-024 | `/api/health` returns DB_TYPE | Planned for Batch 3 |
| F-026 | README rate-limit numbers drifted | Planned for Batch 6 |
| F-027 | Dead `GEMINI_API_KEY` define | Planned for Batch 5 |
| F-028 | Docker `--network` mode by default | Planned for Batch 5 |
| F-029 | Docker has no HTTPS | Planned for Batch 5 |
| (residual) | exceljs/uuid chain (moderate) | Needs breaking exceljs downgrade — separate PR |
| (residual) | @babel/core low | devDep only |

**2 moderate CVEs** remaining from F-013 — both downstream of exceljs v4.x's
vulnerable uuid dependency. The only non-vulnerable option is downgrading
exceljs to v3.4.0, which is a breaking change requiring code review of
`src/utils/excel.ts`. Recommend a separate PR after this batch lands.

## Governance Status
- Requirement "develop dulu, baru promote ke main dengan approval eksplisit":
  **PENDING** — awaiting user approval
- Requirement "catatan improvement/changelog terdokumentasi di main saat
  promote": `docs/release-notes-develop-to-main-2026-06-18-audit-remediation-batch1.md`
  prepared (commit separately at promotion time)

## Recommended Next Step (AWAIT APPROVAL)

1. **User reviews this report + diff (`develop` vs `main`)**:
   ```
   git checkout develop
   git log --oneline main..develop
   git diff main develop
   ```
2. **If approved**: commit release-notes file, then merge `develop → main`
   per the project's established pattern (merge commit, no-ff)
3. **If issues found**: continue iteration on `develop` (don't promote)

## Branch Discipline Reminder
- **DO NOT** push `develop` to origin until user approval
- All Batch 1 work remains local on `develop` for review
- Audit artifacts in `C:\repo\audit\localattendance\` (untracked, gitignored)