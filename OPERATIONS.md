# OPERATIONS RUNBOOK (Bun-first)

This runbook is the fast path for daily operations after npm -> Bun migration completion.

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
bun run build
export NODE_ENV=production
bun run start
```

### Network Mode
```bash
bun install --frozen-lockfile
bun run build
export NODE_ENV=production
bun run start:network
```

### Quick Health/Quality Checks
```bash
bun run lint
bun run lint:eslint -- --max-warnings=0
bun run lint:docs
bun run test:critical
bun run build
```

### Security Checks
```bash
# Bun lane policy (blocking at high severity)
bun audit --audit-level=high

# Optional JSON artifact for diagnostics (non-blocking artifact pattern)
bun audit --json > bun-audit.json || true
```

---

## 2) Script Entry Points (Bun-first)

All operational script families are Bun-first:
- `start-app.bat`, `start-app.sh`
- `start-internal-site.bat`, `start-internal-site.sh`
- `setup-env.ps1`, `setup-env.sh`
- `clean-db.ps1`, `clean-db.sh`
- `scripts/setup-postgres.bat`, `scripts/setup-postgres.sh`

Policy:
- Avoid reintroducing `npm` / `npx` in `.bat` / `.sh` / `.ps1` scripts.
- Prefer:
  - `bun run <script>`
  - `bun install --frozen-lockfile`
  - `bun x <tool>`

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
- `CI`: blocking and must pass
- `Security Scan`: blocking and must pass
- `Automated Release`: must complete successfully
- Bun parity/security smoke jobs may be branch-scoped by workflow policy (develop-focused rollout lanes)

### Develop branch expected status
- Bun parity smoke: blocking
- Bun security smoke: blocking
- npm audit + CodeQL: pass

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

### D. Promote revert to `main` (explicit)
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

## 5) Evidence Logging Standard

For each operational incident/change, capture:
- commit SHA
- workflow run URLs
- pass/fail conclusion per workflow
- root cause summary (1-3 bullets)
- corrective action
- rollback readiness note

Suggested location:
- `docs/plans/` for dated reports and close-out notes.

---

## 6) Guardrails

- Keep `develop` as integration/hardening lane.
- Promote to `main` only after explicit approval + evidence.
- If docs or scripts are changed, run at least:
  - `bun run lint:docs`
  - CI + Security checks in GitHub Actions
- Do not claim “all green” unless both workflow-level and critical job-level statuses are verified.
