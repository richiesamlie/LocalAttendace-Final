# Contributing — Teacher Assistant

**Last Updated:** 2026-04-22
**Branch:** `feature/split-routes-v2`

---

## Branch Strategy

### Branch Types

| Branch | Purpose | Example |
|--------|---------|---------|
| `main` | Production-ready code | - |
| `develop` | Integration branch | - |
| `feature/*` | New features | `feature/add-export` |
| `improvement/*` | Refactoring/improvements | `improvement/phase-1` |
| `fix/*` | Bug fixes | `fix/login-redirect` |

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

### Examples

```bash
# Good
git commit -m "feat(roster): add student search filter"
git commit -m "fix(attendance): prevent double-submit on mark all"
git commit -m "docs: update API_REFERENCE.md with new endpoints"

# Bad
git commit -m "fixed stuff"
git commit -m "WIP"
git commit -m "update"
```

### Commit Guidelines

1. **Atomic commits** — One logical change per commit
2. **Descriptive body** — Explain *why*, not just *what*
3. **Reference issues** — Include issue numbers: `fix(#123): ...`

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
- [ ] `npm run lint` passes
- [ ] `npx vitest run` passes
- [ ] Build succeeds
- [ ] No console errors in browser

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
```

---

## Code Review

### What to Review

1. **Correctness** — Does it solve the problem?
2. **Design** — Is it the right approach?
3. **Tests** — Are there adequate tests?
4. **Style** — Does it follow conventions?

### Review Checklist

- [ ] Code is type-safe (no `any` without justification)
- [ ] Error handling is proper
- [ ] No security issues
- [ ] Performance is acceptable
- [ ] Tests cover edge cases
- [ ] Documentation is updated

---

## Development Workflow

### 1. Pick Up Issue

```bash
git checkout develop
git pull origin develop
git checkout -b feature/my-feature
```

### 2. Make Changes

```bash
# Write code
# Write tests
# Run checks
```

### 3. Verify

```bash
# Type check
npm run lint

# Unit tests
npx vitest run

# E2E tests (optional, can be flaky)
npx playwright test

# Build
npm run build
```

### 4. Commit

```bash
git add .
git commit -m "feat(module): description"
```

### 5. Push & PR

```bash
git push -u origin feature/my-feature
gh pr create
```

---

## Testing Guidelines

### Unit Tests

- Test individual functions/methods
- Test validation schemas
- Test store actions (mock API calls)
- Aim for 50%+ coverage

```bash
npx vitest run src/test/validation.test.ts
```

### E2E Tests

- Test user flows (login, create class, take attendance)
- Don't test implementation details
- E2E tests share a DB — run serially

```bash
npx playwright test
```

---

## Dependencies

### Adding a Dependency

```bash
npm install package-name
```

### Updating a Dependency

```bash
npm update package-name
npm install package-name@latest
```

### Removing a Dependency

```bash
npm uninstall package-name
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

Set environment variables in deployment platform or `.env` (not committed).

---

## Docker

### Build Image

```bash
npm run docker:build
```

### Run Container

```bash
npm run docker:up
docker logs -f teacher-assistant
```

### Access Container

```bash
docker exec -it teacher-assistant sh
```

---

## Scripts Reference

```bash
# Setup
npm install              # Install deps
npm run dev              # Dev server

# Build
npm run build            # Production build
npm start                # Production server
npm run lint             # TypeScript check

# Database
npm run db:backup        # Backup
npm run db:restore       # Restore
npm run db:seed          # Seed test data
npm run db:fresh         # Fresh start

# Testing
npx vitest run           # Unit tests
npx playwright test      # E2E tests

# Docker
npm run docker:build     # Build image
npm run docker:up        # Start
npm run docker:down      # Stop
```

---

## Before Committing

Run these checks:

```bash
# 1. Type check
npm run lint

# 2. Tests
npx vitest run

# 3. Build
npm run build

# 4. Commit
git add .
git commit -m "type(scope): description"
```

---

## Code Owners

Main files requiring review:
- `db.ts` / `src/db/` — Database layer
- `routes.ts` / `src/routes/` — API endpoints
- `services.ts` — Service layer
- `src/store.ts` — State management

---

## Questions?

- Check `TROUBLESHOOTING.md` for common issues
- Check `DEVELOPER_GUIDE.md` for how-tos
- Check `ARCHITECTURE.md` for system design