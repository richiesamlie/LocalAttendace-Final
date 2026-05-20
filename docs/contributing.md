# Contributing — Teacher Assistant

**Last Updated:** 2026-05-13
**Branch:** `develop`

---

## Documentation Governance

- Semua dokumentasi proyek harus berada di folder `docs/` (kecuali `README.md` di root).
- Saat ada perubahan API, wajib update `docs/api-reference.md` di commit yang sama.
- Saat ada perubahan arsitektur/security/performance, wajib update `docs/architecture.md` di commit yang sama.
- Saat ada perubahan alur developer/user, wajib update `docs/developer-guide.md` atau `docs/user-guide.md` sesuai konteks.
- Sebelum merge, pastikan checklist quality gate di `docs/index.md` sudah direview.

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
git commit -m "docs: update api-reference.md with new endpoints"

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
- [ ] `bun run lint` passes
- [ ] `bunx vitest run` passes
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
bun run lint

# Unit tests
bunx vitest run

# E2E tests (optional, can be flaky)
bunx playwright test

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
bunx vitest run src/test/validation.test.ts
```

### E2E Tests

- Test user flows (login, create class, take attendance)
- Don't test implementation details
- E2E tests share a DB — run serially

```bash
bunx playwright test
```

---

## Dependencies

### Adding a Dependency

```bash
bun install package-name
```

### Updating a Dependency

```bash
bun install package-name@latest
```

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

Set environment variables in deployment platform or `.env` (not committed).

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

---

## Scripts Reference

```bash
# Setup
bun install              # Install deps
bun run dev              # Dev server

# Build
bun run build            # Production build
bun run start            # Production server
bun run lint             # TypeScript check

# Database
bun run db:backup        # Backup
bun run db:restore       # Restore
bun run db:seed          # Seed test data
bun run db:fresh         # Fresh start

# Testing
bunx vitest run           # Unit tests
bunx playwright test      # E2E tests

# Docker
bun run docker:build     # Build image
bun run docker:up        # Start
bun run docker:down      # Stop
```

---

## Before Committing

Run these checks:

```bash
# 1. Type check
bun run lint

# 2. Tests
bunx vitest run

# 3. Build
bun run build

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

- Check `troubleshooting.md` for common issues
- Check `developer-guide.md` for how-tos
- Check `architecture.md` for system design