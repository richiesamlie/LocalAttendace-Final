# Phase 2 — Dead File Removal

> **Goal:** delete files with zero importers or zero behavior.
> **Risk:** LOW — verified via `grep` that no test, route, component, or build script imports any of these.
> **Reversibility:** one commit, `git revert` returns to clean state.
> **CORRECTION (2026-06-19):** `db.ts` (root) was initially flagged as dead but has 8 importers (`src/routes/admin.routes.ts`, `src/routes/middleware.ts`, `src/services/utils.ts`, plus 5 test files). It is a path-shortcut re-export from `src/db/`. Keeping it.

## Files to delete (final list)

| Path | LOC | Verified zero importers via |
|------|-----|---------------------------|
| `verify-perf-config.ts` | 50 | `grep -r "verify-perf-config" --include="*.ts" --include="*.json" --include="*.yml" .` → only self-references in comments |
| `src/services/index.ts` | 31 | `grep -rn "src/services/index" --include="*.ts" --include="*.tsx" .` → 0 matches |
| `.eslintrc.json` | 38 | ESLint 9 with flat config (`eslint.config.js`) ignores legacy `.eslintrc.json` automatically |

Also clean up: `eslint.config.js` `files:` override array referenced the now-deleted `verify-perf-config.ts`. Remove that line.

## Verification that no test imports these

```bash
cd /tmp/LocalAttendace-Final
grep -rn "verify-perf-config\|from .*src/services/index" src/test/ scripts/ .github/ 2>/dev/null | grep -v node_modules
```

Expected: no matches.

## Verification that ESLint flat config covers the legacy rules

The flat config (`eslint.config.js`) imports `tsPlugin.configs.recommended`, `reactPlugin.configs.recommended`, `reactHooksPlugin.configs.recommended` — these cover everything legacy `.eslintrc.json` extends. Specific rule overrides in flat config include all meaningful legacy rules (`@typescript-eslint/no-explicit-any: warn`, `@typescript-eslint/no-unused-vars: warn`, `react-hooks/rules-of-hooks: error`, etc.).

## Gate commands (CI parity)

```bash
export DEFAULT_ADMIN_PASSWORD=ci_tes...echo "JWT_SECRET=*** rand -hex 16)" > .env
npm ci
npm run lint                       # tsc --noEmit
npm run lint:eslint -- --max-warnings=0
npm run test:critical              # 226 critical tests
```

`DEFAULT_ADMIN_PASSWORD` env var is required even for tests (the test app boots the schema in setup).

## Steps

1. Run baseline verification commands above (must return empty)
2. Delete the 3 files via `git rm`
3. Clean `eslint.config.js` override array (drop `verify-perf-config.ts`)
4. Run gates — all must pass
5. Commit

## Commit

```
chore(refactor): remove dead files (verify-perf-config, src/services/index.ts, .eslintrc.json)

Phase 2 of the ponytail major cut. Each removed file verified to have zero
importers via repo-wide grep. Legacy .eslintrc.json is shadowed by the
active flat config (eslint.config.js) under ESLint 9. eslint.config.js
override array updated to drop verify-perf-config reference.

db.ts (root) was initially flagged for deletion but has 8 importers
(path-shortcut re-export); kept.

See docs/plans/2026-06-19-ponytail-major-cut-plan.md
```

## Exit Criteria

- All 3 files deleted from working tree
- `git status` shows 3 deletions + 1 modification (eslint.config.js)
- `npm run lint` passes
- `npm run lint:eslint -- --max-warnings=0` passes
- `npm run test:critical` shows 30 files / 226 tests pass
- Commit created with conventional prefix