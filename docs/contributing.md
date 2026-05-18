     1|# Contributing — Teacher Assistant
     2|
     3|**Last Updated:** 2026-05-13
     4|**Branch:** `develop`
     5|
     6|---
     7|
     8|## Documentation Governance
     9|
    10|- Semua dokumentasi proyek harus berada di folder `docs/` (kecuali `README.md` di root).
    11|- Saat ada perubahan API, wajib update `docs/api-reference.md` di commit yang sama.
    12|- Saat ada perubahan arsitektur/security/performance, wajib update `docs/architecture.md` di commit yang sama.
    13|- Saat ada perubahan alur developer/user, wajib update `docs/developer-guide.md` atau `docs/user-guide.md` sesuai konteks.
    14|- Sebelum merge, pastikan checklist quality gate di `docs/index.md` sudah direview.
    15|
    16|---
    17|
    18|## Branch Strategy
    19|
    20|### Branch Types
    21|
    22|| Branch | Purpose | Example |
    23||--------|---------|---------|
    24|| `main` | Production-ready code | - |
    25|| `develop` | Integration branch | - |
    26|| `feature/*` | New features | `feature/add-export` |
    27|| `improvement/*` | Refactoring/improvements | `improvement/phase-1` |
    28|| `fix/*` | Bug fixes | `fix/login-redirect` |
    29|
    30|### Creating a Feature Branch
    31|
    32|```bash
    33|git checkout develop
    34|git pull origin develop
    35|git checkout -b feature/my-feature
    36|```
    37|
    38|### Keeping in Sync
    39|
    40|```bash
    41|git fetch origin
    42|git rebase origin/develop
    43|```
    44|
    45|---
    46|
    47|## Commit Messages
    48|
    49|### Format
    50|
    51|```
    52|<type>(<scope>): <description>
    53|
    54|[optional body]
    55|```
    56|
    57|### Types
    58|
    59|| Type | Use For |
    60||------|---------|
    61|| `feat` | New feature |
    62|| `fix` | Bug fix |
    63|| `docs` | Documentation |
    64|| `refactor` | Code refactoring (no behavior change) |
    65|| `test` | Adding/updating tests |
    66|| `chore` | Build, deps, CI/CD |
    67|| `perf` | Performance improvement |
    68|
    69|### Examples
    70|
    71|```bash
    72|# Good
    73|git commit -m "feat(roster): add student search filter"
    74|git commit -m "fix(attendance): prevent double-submit on mark all"
    75|git commit -m "docs: update api-reference.md with new endpoints"
    76|
    77|# Bad
    78|git commit -m "fixed stuff"
    79|git commit -m "WIP"
    80|git commit -m "update"
    81|```
    82|
    83|### Commit Guidelines
    84|
    85|1. **Atomic commits** — One logical change per commit
    86|2. **Descriptive body** — Explain *why*, not just *what*
    87|3. **Reference issues** — Include issue numbers: `fix(#123): ...`
    88|
    89|---
    90|
    91|## Pull Requests
    92|
    93|### Creating a PR
    94|
    95|```bash
    96|git push -u origin feature/my-feature
    97|gh pr create --title "feat(module): description" --body "$(cat <<'EOF'
    98|## Summary
    99|- Brief description of changes
   100|
   101|## Testing
   102|- [ ] Tests pass
   103|- [ ] Manual testing completed
   104|EOF
   105|)"
   106|```
   107|
   108|### PR Checklist
   109|
   110|- [ ] Branch is up-to-date with `develop`
   111|- [ ] Commit messages follow conventions
   112|- [ ] `bun run lint` passes
   113|- [ ] `bunx vitest run` passes
   114|- [ ] Build succeeds
   115|- [ ] No console errors in browser
   116|
   117|### PR Description Template
   118|
   119|```markdown
   120|## Summary
   121|Brief description of changes.
   122|
   123|## Changes
   124|- Change 1
   125|- Change 2
   126|
   127|## Testing
   128|How was this tested?
   129|
   130|## Checklist
   131|- [ ] Tests added/updated
   132|- [ ] Documentation updated
   133|- [ ] Build passes
   134|```
   135|
   136|---
   137|
   138|## Code Review
   139|
   140|### What to Review
   141|
   142|1. **Correctness** — Does it solve the problem?
   143|2. **Design** — Is it the right approach?
   144|3. **Tests** — Are there adequate tests?
   145|4. **Style** — Does it follow conventions?
   146|
   147|### Review Checklist
   148|
   149|- [ ] Code is type-safe (no `any` without justification)
   150|- [ ] Error handling is proper
   151|- [ ] No security issues
   152|- [ ] Performance is acceptable
   153|- [ ] Tests cover edge cases
   154|- [ ] Documentation is updated
   155|
   156|---
   157|
   158|## Development Workflow
   159|
   160|### 1. Pick Up Issue
   161|
   162|```bash
   163|git checkout develop
   164|git pull origin develop
   165|git checkout -b feature/my-feature
   166|```
   167|
   168|### 2. Make Changes
   169|
   170|```bash
   171|# Write code
   172|# Write tests
   173|# Run checks
   174|```
   175|
   176|### 3. Verify
   177|
   178|```bash
   179|# Type check
   180|bun run lint
   181|
   182|# Unit tests
   183|bunx vitest run
   184|
   185|# E2E tests (optional, can be flaky)
   186|bunx playwright test
   187|
   188|# Build
   189|bun run build
   190|```
   191|
   192|### 4. Commit
   193|
   194|```bash
   195|git add .
   196|git commit -m "feat(module): description"
   197|```
   198|
   199|### 5. Push & PR
   200|
   201|```bash
   202|git push -u origin feature/my-feature
   203|gh pr create
   204|```
   205|
   206|---
   207|
   208|## Testing Guidelines
   209|
   210|### Unit Tests
   211|
   212|- Test individual functions/methods
   213|- Test validation schemas
   214|- Test store actions (mock API calls)
   215|- Aim for 50%+ coverage
   216|
   217|```bash
   218|bunx vitest run src/test/validation.test.ts
   219|```
   220|
   221|### E2E Tests
   222|
   223|- Test user flows (login, create class, take attendance)
   224|- Don't test implementation details
   225|- E2E tests share a DB — run serially
   226|
   227|```bash
   228|bunx playwright test
   229|```
   230|
   231|---
   232|
   233|## Dependencies
   234|
   235|### Adding a Dependency
   236|
   237|```bash
   238|bun install package-name
   239|```
   240|
   241|### Updating a Dependency
   242|
   243|```bash
   244|npm update package-name
   245|bun install package-name@latest
   246|```
   247|
   248|### Removing a Dependency
   249|
   250|```bash
   251|npm uninstall package-name
   252|```
   253|
   254|---
   255|
   256|## Environment Variables
   257|
   258|### Development
   259|
   260|Create `.env` (gitignored):
   261|```env
   262|JWT_SECRET=your_dev_secret
   263|DEFAULT_ADMIN_PASSWORD=dev_password
   264|```
   265|
   266|### Production
   267|
   268|Set environment variables in deployment platform or `.env` (not committed).
   269|
   270|---
   271|
   272|## Docker
   273|
   274|### Build Image
   275|
   276|```bash
   277|bun run docker:build
   278|```
   279|
   280|### Run Container
   281|
   282|```bash
   283|bun run docker:up
   284|docker logs -f teacher-assistant
   285|```
   286|
   287|### Access Container
   288|
   289|```bash
   290|docker exec -it teacher-assistant sh
   291|```
   292|
   293|---
   294|
   295|## Scripts Reference
   296|
   297|```bash
   298|# Setup
   299|bun install              # Install deps
   300|bun run dev              # Dev server
   301|
   302|# Build
   303|bun run build            # Production build
   304|npm start                # Production server
   305|bun run lint             # TypeScript check
   306|
   307|# Database
   308|bun run db:backup        # Backup
   309|bun run db:restore       # Restore
   310|bun run db:seed          # Seed test data
   311|bun run db:fresh         # Fresh start
   312|
   313|# Testing
   314|bunx vitest run           # Unit tests
   315|bunx playwright test      # E2E tests
   316|
   317|# Docker
   318|bun run docker:build     # Build image
   319|bun run docker:up        # Start
   320|bun run docker:down      # Stop
   321|```
   322|
   323|---
   324|
   325|## Before Committing
   326|
   327|Run these checks:
   328|
   329|```bash
   330|# 1. Type check
   331|bun run lint
   332|
   333|# 2. Tests
   334|bunx vitest run
   335|
   336|# 3. Build
   337|bun run build
   338|
   339|# 4. Commit
   340|git add .
   341|git commit -m "type(scope): description"
   342|```
   343|
   344|---
   345|
   346|## Code Owners
   347|
   348|Main files requiring review:
   349|- `db.ts` / `src/db/` — Database layer
   350|- `routes.ts` / `src/routes/` — API endpoints
   351|- `services.ts` — Service layer
   352|- `src/store.ts` — State management
   353|
   354|---
   355|
   356|## Questions?
   357|
   358|- Check `troubleshooting.md` for common issues
   359|- Check `developer-guide.md` for how-tos
   360|- Check `architecture.md` for system design