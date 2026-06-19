# Phase 2 — Dead File Removal

> **Goal:** delete the 4 files with zero importers or zero behavior.
> **Risk:** LOW — verified via `grep` that no test, route, component, or build script imports any of these.
> **Reversibility:** one commit, `git revert` returns to clean state.

## Files to delete

| Path | LOC | Verified zero importers via |
|------|-----|---------------------------|
| `verify-perf-config.ts` | 50 | `grep -r "verify-perf-config" --include="*.ts" --include="*.json" --include="*.yml" .` → only self-references in comments |
| `db.ts` (root) | 9 | `grep -rn "from ['\"]./db['\"]" --include="*.ts" --include="*.tsx" .` → 0 matches |
| `src/services/index.ts` | 31 | `grep -rn "from .*src/services/index" --include="*.ts" --include="*.tsx" .` → 0 matches |
| `.eslintrc.json` | 38 | ESLint 9 with flat config ignores legacy `.eslintrc.json` automatically |

## Verification that no test imports these

```
cd /tmp/LocalAttendace-Final
grep -rn "verify-perf-config\|from ['\"]\./db['\"]\|from ['\"]\.\./db['\"]\|src/services/index" src/test/ scripts/ .github/ 2>/dev/null | grep -v node_modules
```

Expected: no matches.

## Verification that ESLint flat config covers the legacy rules

Before deleting `.eslintrc.json`, compare rule sets:

```bash
# Extract rules from legacy config
python3 -c "import json; print(json.dumps(json.load(open('.eslintrc.json')).get('rules', {}), indent=2))"

# Extract rules from flat config
grep -A 1000 "rules:" eslint.config.js | head -100
```

Confirm flat config has all the meaningful rules (or document any that are lost).

## Steps

1. Run baseline verification commands above (must return empty)
2. Delete the 4 files via `git rm`
3. Run `npm run lint` (must pass — the deleted files had no compile-time consumers)
4. Run `npm run lint:eslint -- --max-warnings=0` (must pass — flat config is in use)
5. Run `npm run test:critical` (must pass — no test referenced the deleted files)
6. If all green: commit

## Commit

```
chore(refactor): remove dead files (verify-perf-config, root db.ts, src/services/index.ts, .eslintrc.json)

Phase 2 of the ponytail major cut. Each removed file verified to have zero
importers via repo-wide grep. Legacy .eslintrc.json is shadowed by the
active flat config (eslint.config.js) under ESLint 9.

See docs/plans/2026-06-19-ponytail-major-cut-plan.md
```

## Exit Criteria

- All 4 files deleted from working tree
- `git status` shows 4 deletions, no other changes
- `npm run lint` passes
- `npm run lint:eslint -- --max-warnings=0` passes
- `npm run test:critical` passes
- Commit created with conventional prefix