# Contributing — Teacher Assistant

# Contributing — Teacher Assistant

**Last Updated:** 2026-06-18
**Branch:** `develop`

---

## Documentation Governance

- All project documentation lives in `docs/` (except `README.md` at repo root).
- When changing an API, update `docs/api-reference.md` in the same commit.
- When changing architecture/security/performance, update `docs/architecture.md` in the same commit.
- When changing developer/user workflows, update `docs/developer-guide.md` or `docs/user-guide.md` as appropriate.
- Before merge, verify the quality gate checklist in `docs/documentation-map.md`.

## Branch Strategy

### Branch Types

| Branch | Purpose | Example |
|--------|---------|---------|
| `main` | Production-ready code | — |
| `develop` | Integration / hardening lane | — |
| `feature/*` | New features | `feature/add-export` |
| `improvement/*` | Refactoring/improvements | `improvement/phase-1` |
| `fix/*` | Bug fixes | `fix/login-redirect` |

### Develop-First Flow (post-audit convention)

All work happens on `develop` first. Promotion to `main` requires **explicit user approval** and uses `git merge --no-ff` to preserve history as a single merge commit.

```bash
# 1. Work on develop
git checkout develop
git pull --ff-only origin develop
git checkout -b feature/my-change

# ... make changes, commit per logical unit ...

# 2. Push to develop
git push origin feature/my-change   # optional: review via PR
git checkout develop && git merge --no-ff feature/my-change -m "merge: ..."
git push origin develop

# 3. Wait for develop CI to pass (TypeScript, ESLint, Critical Tests,
#    Bun Parity Smoke, Bun Security Smoke)

# 4. After explicit user approval, promote to main
git checkout main
git merge --no-ff develop -m "merge: ..."
git push origin main
```

`main` runs the full suite + Automated Release workflow. `develop` is the blocking/hardening lane with bun-first gates.

### Creating a Feature Branch

```bash
git checkout develop
git pull origin develop
git checkout -b feature/my-feature
```

### Keeping in Sync

```bash
git fetch origin
git rebase origin/develop
```

---

## Commit Messages

### Format

```
<type>(<scope>): <description>

[optional body]
```

### Types

| Type | Use For |
|------|---------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation |
| `refactor` | Code refactoring (no behavior change) |
| `test` | Adding/updating tests |
| `chore` | Build, deps, CI/CD |
| `perf` | Performance improvement |
| `security` | Security hardening |

### Examples

```bash
# Good
git commit -m "feat(roster): add student search filter"
git commit -m "fix(attendance): prevent double-submit on mark all"
git commit -m "security(auth): add JWT handshake verification (F-001)"
git commit -m "docs(api-reference): document /auth/refresh endpoint"

# Bad
git commit -m "fixed stuff"
git commit -m "WIP"
git commit -m "update"
```

### Commit Guidelines

1. **Atomic commits** — One logical change per commit
2. **Descriptive body** — Explain *why*, not just *what*
3. **Reference findings** — Include audit finding IDs when relevant: `fix(F-018): ...`
4. **Tests in same commit** — Source change + test in the same commit when possible

---

## Pull Requests

### Creating a PR

```bash
git push -u origin feature/my-feature
gh pr create --title "feat(module): description" --body "$(cat <<'EOF'
## Summary
- Brief description of changes

## Testing
- [ ] Tests pass
- [ ] Manual testing completed
EOF
)"
```

### PR Checklist

- [ ] Branch is up-to-date with `develop`
- [ ] Commit messages follow conventions
- [ ] `npm run lint` passes (TypeScript check)
- [ ] `npm run lint:eslint -- --max-warnings=0` passes (blocking gate)
- [ ] `npm run test:critical` passes (226 tests, fast gate)
- [ ] New test file added to `test:critical` in `package.json`
- [ ] Build succeeds (`bun run build` for frontend)
- [ ] No console errors in browser
- [ ] No new HIGH CVEs (`npm audit --omit=dev --audit-level=high`)
- [ ] Documentation updated if behavior changed

### PR Description Template

```markdown
## Summary
Brief description of changes.

## Changes
- Change 1
- Change 2

## Testing
How was this tested?

## Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] Build passes
- [ ] CI gates green
```

---

## Code Review

### What to Review

1. **Correctness** — Does it solve the problem?
2. **Design** — Is it the right approach?
3. **Tests** — Are there adequate tests?
4. **Style** — Does it follow conventions?
5. **Security** — Any new attack surface?
6. **Audit findings** — If related to an audit finding, verify closure

### Review Checklist

- [ ] Code is type-safe (no `any` without justification)
- [ ] Error handling is proper (no leaking stack traces)
- [ ] No security issues (no sync fs on request paths, no sync bcrypt)
- [ ] Performance is acceptable (no N+1 queries, no blocking I/O)
- [ ] Tests cover edge cases
- [ ] Documentation is updated
- [ ] PII is redacted in logs (`safeLog()` from `src/lib/log-redact.ts`)
- [ ] Rate limits considered on new endpoints

---

## Development Workflow

### 1. Pick Up Issue

```bash
git checkout develop
git pull origin develop
git checkout -b feature/my-change
```

### 2. Make Changes

Write code and tests together.

### 3. Verify (must all pass before commit)

```bash
# TypeScript check (blocking)
npm run lint

# ESLint blocking gate (--max-warnings=0)
npm run lint:eslint -- --max-warnings=0

# Critical tests (226 fast tests, must all pass)
npm run test:critical

# Bun parity smoke (must match npm behavior)
bun install --frozen-lockfile
bun run lint
bun run lint:eslint -- --max-warnings=0
bun audit --audit-level=high

# Build
bun run build
```

### 4. Commit

```bash
git add .
git commit -m "feat(module): description"
```

### 5. Push & PR

```bash
git push -u origin feature/my-change
gh pr create
```

---

## Testing Guidelines

### Unit / Security Tests

- Test individual functions/methods
- Test validation schemas
- Test security middleware (rate limits, auth, RBAC)
- Security tests live in `src/test/security/*.security.test.ts`
- Add to `npm run test:critical` script so they run on every CI build

```bash
npm run test:critical    # 226 tests, runs on every commit
npm test                 # 505 tests, full suite (CI on main)
```

### Integration Tests

- Test full request flows
- Use supertest against `createTestApp()` from `src/test/helpers/app.ts`
- Mock external dependencies (e.g., Socket.IO)

### E2E Tests (Optional)

```bash
bunx playwright test
```

---

## Dependencies

### Adding/Updating a Dependency

```bash
# Regular install
bun add package-name
bun add -d package-name          # devDependency

# Then update bun.lock AND package-lock.json (CI uses both)
bun install
npm install
```

### Dual Lockfile Workflow

The repo maintains both `bun.lock` and `package-lock.json`:

- **bun.lock** — primary lockfile, used by Bun runtime
- **package-lock.json** — secondary lockfile, used by npm audit and
  certain CI lanes (Full Test Suite on main)

When changing `package.json`, regenerate BOTH:

```bash
bun install           # updates bun.lock
npm install           # updates package-lock.json
```

### Overrides (security)

`package.json` has `overrides` and `resolutions` blocks for security-sensitive transitive deps:

```json
{
  "overrides": {
    "ws": "^8.21.0",
    "form-data": "^4.0.6",
    "tmp": "^0.2.7",
    "vite": "^6.4.3"
  }
}
```

When adding a new override, document the reason in the commit message.

### Removing a Dependency

```bash
bun remove package-name
```

---

## Environment Variables

### Development

Create `.env` (gitignored):

```env
JWT_SECRET=your_dev_secret
DEFAULT_ADMIN_PASSWORD=dev_password
```

### Production

Set via deployment platform or `.env` (never committed).

### Variable Reference

See `.env.example` for all supported variables and their defaults.

---

## Docker

### Build Image

```bash
bun run docker:build
```

### Run Container

```bash
bun run docker:up
docker logs -f teacher-assistant
```

### Access Container

```bash
docker exec -it teacher-assistant sh
```

### Migration Note (Batch 5)

The bind-mount `./data:/app/data` was replaced by a named volume `teacher-assistant-data`. For existing deployments, see `docs/plans/2026-06-18-phase10-batch5-remediation-report.md` for the one-time migration command.

---

## Scripts Reference

```bash
# Setup
bun install              # Install deps (uses bun.lock)
npm install              # Also update package-lock.json (for CI audit lanes)
bun run dev              # Dev server (Bun)

# Build
bun run build            # Production build (frontend)
npm run start            # Production server (Node.js + tsx)

# Lint
npm run lint             # TypeScript check
npm run lint:eslint -- --max-warnings=0   # ESLint blocking gate

# Test
npm run test:critical    # Fast gate (226 tests, CI on develop)
npm test                 # Full suite (505 tests, CI on main)

# Security
npm audit --omit=dev --audit-level=high   # npm audit (CI)
bun audit --audit-level=high              # bun audit (develop only)

# Database
bun run db:seed          # Seed sample data
bun run db:backup        # Create backup
bun run db:restore       # Restore from backup

# Docker
bun run docker:build     # Build image
bun run docker:up        # Start
bun run docker:down      # Stop
```

---

## Before Committing

Run these checks locally (mimic CI gates):

```bash
# 1. TypeScript check (blocking)
npm run lint

# 2. ESLint (blocking, --max-warnings=0)
npm run lint:eslint -- --max-warnings=0

# 3. Critical tests (226 tests, fast gate)
npm run test:critical

# 4. Build
bun run build

# 5. Commit
git add .
git commit -m "type(scope): description"
```

---

## Code Owners

Main files requiring careful review:

- `db.ts` / `src/db/` — Database layer
- `routes.ts` / `src/routes/` — API endpoints
- `services.ts` — Service layer
- `server.ts` — Express setup + Socket.IO
- `src/routes/middleware.ts` — Auth + RBAC + rate limits (security-critical)
- `src/lib/bcrypt.ts` — Password hashing (security-critical)
- `Dockerfile`, `docker-compose.yml` — Container hardening

---

## Security Audit Workflow (Cumulative Pattern)

After the 2026-06-18 audit (15 of 15 findings closed), the workflow for security-sensitive changes is:

1. **Identify the finding** — Use the audit register (`C:\repo\audit\localattendance\SECURITY_RESIDUAL_RISK_REGISTER.md`)
2. **Write a remediation plan** — `docs/plans/YYYY-MM-DD-finding-FXXX-plan.md`
3. **Implement + test in same commit** — Source change + security test
4. **Add to `test:critical`** — So it runs on every CI build
5. **Write a remediation report** — `docs/plans/YYYY-MM-DD-phaseNN-batchN-remediation-report.md`
6. **Write release notes** — `docs/release-notes-develop-to-main-YYYY-MM-DD-audit-remediation-batchN.md`

This pattern ensures every security fix has:
- Traceable plan
- Regression test (in `test:critical`)
- Public-facing release note
- Decision log for future maintainers

---

## Questions?

- Check `troubleshooting.md` for common issues
- Check `developer-guide.md` for how-tos
- Check `architecture.md` for system design
- Check `operations.md` for CI triage

---

**Audit-era additions (2026-06-18):**
- `security` commit type added
- Develop-first flow (was: feature branches then merge to main)
- New PR checklist items: critical tests, ESLint blocking, audit findings
- Code Owners section expanded with security-critical files
- Security audit workflow documented
- Dual lockfile workflow (bun.lock + package-lock.json)
- Check `architecture.md` for system design