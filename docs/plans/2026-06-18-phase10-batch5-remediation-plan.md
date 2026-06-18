# Phase 10 Batch 5 — Docker & Ops Hardening Plan

> Branch: `develop`
> Mode: incremental; commits ordered least → most risky
> 3 findings remaining (F-028, F-029, F-027)

## Scope

| ID | Title | Severity | Effort | Risk |
|----|-------|----------|--------|------|
| F-027 | Dead `GEMINI_API_KEY` define in vite.config.ts | Low | XS | None |
| F-028 | Dockerfile hardening | Low | S | Low |
| F-029 | docker-compose security hardening | Low | S | Low |

## Execution Order (least → most risky)

### Step 1: F-027 — Remove dead `GEMINI_API_KEY` define
**Risk:** None. Audit verified 0 references in src/. The define was
dead code from an earlier Gemini integration attempt.

**Change:** Delete lines 49-50 from `vite.config.ts`:
```typescript
'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
```
Also remove the `loadEnv` import if no longer needed.

### Step 2: F-028 — Dockerfile hardening
**Risk:** Low. Defense-in-depth; no behavior change.

**Current state:**
- Multi-stage build ✓
- Non-root user (nodejs:1001) ✓
- Health check ✓
- Production-only deps ✓
- npm version pinned ✓

**Improvements:**
- Use `npm ci --omit=dev --ignore-scripts` to skip postinstall scripts
  in production image (extra defense against malicious package scripts)
- Add explicit `--no-audit --no-fund` to npm ci for faster, quieter builds
- Add `LABEL` metadata for image scanning tools
- Make HEALTHCHECK CMD more robust (use `wget` or `node` directly)
- Expand `.dockerignore` to include `*.md`, `.env*`, `backups/`, `*.log`,
  `coverage/`, `test-results/`, `.github/`

### Step 3: F-029 — docker-compose security hardening
**Risk:** Low. Adds defense-in-depth container restrictions; no behavior
change at the application level.

**Current state:**
- restart: unless-stopped ✓
- healthcheck ✓
- env_file ✓
- port mapping ✓
- volume mount ✓

**Improvements:**
- Add `security_opt: no-new-privileges:true` (prevent privilege escalation)
- Add `read_only: true` filesystem where possible (tmpfs for /tmp, /var/tmp)
- Add `cap_drop: [ALL]` + minimal `cap_add` (drop all Linux capabilities)
- Add `mem_limit: 512m` and `cpus: 1.0` (DoS protection via resource limits)
- Add `pids_limit: 100` (fork bomb protection)
- Use named volume for `./data` instead of bind mount (cleaner semantics,
  survives host filesystem changes)
- Add `user: "1001:1001"` to make the UID explicit (matches Dockerfile nodejs user)
- Improve healthcheck to use `node` (already in image) instead of `wget`
- Add `stop_grace_period: 30s` for clean shutdown

## Commit Strategy

Each finding → 1 commit (impl + test combined for small ones, separate
for larger ones).

## Verification (end of batch)

- `npm run lint` clean
- `npm run lint:eslint --max-warnings=0` clean
- `npm run test:critical` passing (target: 170 + 5-10 new = ~175)
- `npm run build` succeeds
- `npm audit --omit=dev --audit-level=high` still 0 HIGH

## Out of Scope (deferred)

- **RES-1:** Verify `user_sessions.deleteExpiredSessions` has same
  ISO 8601 issue (3-line fix, can be done as carry-forward)
- **Batch 6:** Hygiene (F-015 `.env.backup*` gitignore, F-026 README rate-limit drift)

## Reference

- Audit source: `C:\repo\audit\localattendance\SECURITY_RESIDUAL_RISK_REGISTER.md`
- Batches 1-4 closeouts: `docs/plans/2026-06-18-phase10-batch{1,2,3,4}-remediation-report.md`