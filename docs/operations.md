# OPERATIONS RUNBOOK (Bun-first + npm-first dual runtime)

This runbook is the fast path for daily operations after the 2026-06-18 audit closeout.

**Last Updated:** 2026-06-18

## 1) Daily Commands (Operator Quick Start)

### Prerequisites
- Bun installed and available in PATH
- `.env` exists and includes at least:
  - `JWT_SECRET`
  - `DEFAULT_ADMIN_PASSWORD`

### Local Development
```bash
bun install --frozen-lockfile
bun run dev
```

### Local Production-style Start
```bash
bun install --frozen-lockfile
npm install --omit=dev    # also keep package-lock.json current
bun run build
export NODE_ENV=production
npm run start              # uses Node.js + tsx (better-sqlite3 native)
```

### Network Mode
```bash
bun install --frozen-lockfile
bun run build
export NODE_ENV=production
npm run start:network
```

### Quick Health/Quality Checks (local CI parity)

```bash
npm run lint                              # TypeScript check (blocking)
npm run lint:eslint -- --max-warnings=0   # ESLint blocking gate
npm run test:critical                     # 226 fast tests
npm test                                  # 505 full suite
bun install --frozen-lockfile             # Bun parity check
bun run lint                              # Bun lint parity
bun audit --audit-level=high              # Bun security audit
npm audit --omit=dev --audit-level=high   # npm security audit
bun run build                             # Frontend build
```

### Security Checks
```bash
# Bun lane policy (blocking at high severity, develop only)
bun audit --audit-level=high

# npm lane policy (blocking at high severity, main + develop)
npm audit --omit=dev --audit-level=high

# Optional JSON artifact for diagnostics (non-blocking artifact pattern)
bun audit --json > bun-audit.json || true
npm audit --json > npm-audit.json || true
```

---

## 2) Script Entry Points (Bun-first)

Operational script families:
- `start-app.bat`, `start-app.sh` (Windows admin double-click + dev/CI)
- `setup-env.ps1`, `setup-env.sh` (release.yml step 3 for Windows admin post-extract setup)

Policy:
- Avoid reintroducing `npm` / `npx` in `.bat` / `.sh` / `.ps1` scripts (Bun is the standard).
- Prefer:
  - `bun run <script>`
  - `bun install --frozen-lockfile`
  - `bun x <tool>`

Exceptions:
- CI runs `npm install` to keep `package-lock.json` current for the
  Full Test Suite CI lane and `npm audit` gate
- Backend server uses `npx tsx server.ts` because `better-sqlite3`
  native bindings don't load in Bun on Windows

---

## 3) CI/Security Quick Triage

### List latest runs
```bash
gh run list --limit 10 --json databaseId,workflowName,headBranch,status,conclusion,url,headSha
```

### Watch active run
```bash
gh run watch <RUN_ID> --exit-status
```

### Show failed logs quickly
```bash
gh run view <RUN_ID> --log-failed
```

### Main branch expected status

| Workflow | Job | Status |
|----------|-----|--------|
| CI | TypeScript Check | ✓ pass |
| CI | ESLint (`--max-warnings=0`) | ✓ pass (blocking) |
| CI | Docs Link Check | ✓ pass |
| CI | Build Verification | ✓ pass |
| CI | **Full Test Suite** (main/PR gate, 505 tests) | ✓ pass (blocking) |
| CI | Test Coverage (main baseline) | ✓ pass |
| Security Scan | npm audit (`--omit=dev --audit-level=high`) | ✓ pass (blocking) |
| Security Scan | CodeQL Security Analysis | ✓ pass |
| Automated Release | (artifact packaging) | ✓ pass |

### Develop branch expected status

Adds (on top of main's set):

| Workflow | Job | Status |
|----------|-----|--------|
| CI | **Bun Parity Smoke** (develop, blocking) | ✓ pass |
| CI | **Critical Tests** (develop fast gate, 226 tests) | ✓ pass |
| Security Scan | **Bun Security Smoke** (develop, blocking at high) | ✓ pass |

If any of these fail on develop, do NOT merge to main — fix on develop first.

### Triage Decision Tree

```
CI on develop failing?
├─ TypeScript Check → check tsc errors; fix in commit
├─ ESLint → npm run lint:eslint --fix; commit
├─ Docs Link Check → check docs/* links
├─ Build Verification → check vite build output
├─ Critical Tests → check vitest output; add fix
└─ Bun Parity Smoke → check bun.lock vs package-lock.json drift

Security Scan on develop failing?
├─ npm audit → npm audit fix (or add override)
├─ CodeQL → review codeql findings; fix in commit
└─ Bun Security Smoke → check bun audit output; add override

CI on main failing?
└─ Same as develop CI, plus:
   └─ Full Test Suite (505 tests) → check vitest output
```

---

## 4) Rollback Quick Playbook

Use this when a critical regression appears post-merge.

### A. Identify bad commit
```bash
git log --oneline -n 20
```

### B. Revert on `develop` first
```bash
git checkout develop
git pull --ff-only origin develop
git revert <BAD_COMMIT_SHA>
git push origin develop
```

### C. Verify develop gates
- CI success
- Security success
- Bun blocking lanes success

### D. Promote revert to `main` (explicit, requires user approval)
```bash
git checkout main
git pull --ff-only origin main
git merge --no-ff origin/develop -m "merge: promote rollback from develop to main"
git push origin main
```

### E. Verify main full cycle
- CI success
- Security success
- Automated Release success

---

## 5) Audit Lifecycle Playbook

The repo has been audited twice (May 2026 Bun migration, June 2026 security audit). The established workflow for future audits:

### Phase 1: Audit
1. Clone repo to external workdir (e.g., `C:\repo\audit\`)
2. Read source, run tools (npm audit, CodeQL, manual review)
3. Produce `SECURITY_AUDIT_REPORT.md` + `SECURITY_RESIDUAL_RISK_REGISTER.md`
4. Present plan with prioritized batches; user picks mode (audit-only vs fix)

### Phase 2: Remediation (on develop)
For each finding (F-XXX):
1. Write plan: `docs/plans/YYYY-MM-DD-finding-FXXX-plan.md`
2. Fix in commit: source change + security test in `src/test/security/`
3. Add test file to `test:critical` in `package.json`
4. Write batch report: `docs/plans/YYYY-MM-DD-phaseNN-batchN-remediation-report.md`
5. Write release notes: `docs/release-notes-develop-to-main-YYYY-MM-DD-...md`

### Phase 3: Promotion
1. Verify all CI gates green on develop
2. **Wait for explicit user approval** (develop-first rule)
3. `git merge --no-ff develop` to main
4. Verify CI on main passes
5. Tag release if applicable

---

## 6) Evidence Logging Standard

For each operational incident/change, capture:
- commit SHA
- workflow run URLs (`gh run view <ID>` output)
- pass/fail conclusion per workflow
- root cause summary (1-3 bullets)
- corrective action
- rollback readiness note

Suggested locations:
- `docs/plans/` — dated reports and close-out notes
- Commit body — short summary with workflow run IDs

---

## 7) Guardrails

- Keep `develop` as integration/hardening lane.
- Promote to `main` only after explicit user approval + evidence.
- If docs or scripts are changed, run at least:
  - `npm run test:critical` (fast gate)
  - CI + Security checks in GitHub Actions
- Do not claim "all green" unless both workflow-level and critical job-level statuses are verified.
- Bun security smoke is develop-blocking; don't disable it.
- ESLint runs with `--max-warnings=0` (any warning = failure).
- When bumping deps, regenerate BOTH `bun.lock` AND `package-lock.json`.
