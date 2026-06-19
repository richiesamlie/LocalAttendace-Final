# Phase 3 — Dead Dependency Removal

> **Goal:** remove 4 runtime deps with zero importers across `src/`.
> **Risk:** MEDIUM — touches both `package.json` AND both lockfiles (`package-lock.json` + `bun.lock`); CI installs from both.
> **Reversibility:** one commit, `git revert` returns to clean state.

## Deps to remove

| Dep | Verified zero importers via |
|-----|----------------------------|
| `recharts` | `grep -rn "from ['\"]recharts['\"]" src/` → 0 matches. Only `BarChart3` icon name comes from `lucide-react`. |
| `motion` | `grep -rn "from ['\"]motion['\"]" src/` → 0 matches. |
| `react-window` | `grep -rn "from ['\"]react-window['\"]" src/` → 0 matches. |
| `react-virtualized-auto-sizer` | `grep -rn "from ['\"]react-virtualized-auto-sizer['\"]" src/` → 0 matches. |

## Steps

1. Edit `package.json` to remove the 4 deps from `dependencies`
2. Delete `node_modules` and `package-lock.json` to force a clean regen (avoids stale transitive deps)
3. Run `npm install` to regenerate `package-lock.json`
4. Run `bun install` to regenerate `bun.lock` (requires bun on PATH)
5. Verify both lockfiles are in sync (CI uses `npm ci` for typecheck/eslint/build/test, `bun install --frozen-lockfile` for parity-smoke/release)
6. Run gates

## Gate commands (CI parity)

```bash
export DEFAULT_ADMIN_PASSWORD=*** "JWT_SECRET=*** rand -hex 16)" > .env
npm ci
npm run lint                       # tsc --noEmit
npm run lint:eslint -- --max-warnings=0
npm run test:critical              # 226 critical tests
```

## Commit

```
chore(deps): remove unused runtime deps (recharts, motion, react-window, react-virtualized-auto-sizer)

Phase 3 of the ponytail major cut. Zero importers across src/ for any of
the four. Both package-lock.json (npm) and bun.lock (Bun) regenerated.
Both lockfiles must stay in sync — CI uses npm ci for typecheck/eslint/
build/test-critical/test-full and bun install --frozen-lockfile for
bun-parity-smoke/release.

Verified: npm ci clean, tsc --noEmit clean, eslint --max-warnings=0 clean,
test:critical 226/226 passing, bun install --frozen-lockfile clean,
bun run lint clean.

See docs/plans/2026-06-19-ponytail-major-cut-plan.md
```

## Exit Criteria

- `package.json` lists the 4 deps removed
- `package-lock.json` no longer contains the 4 packages (after regen)
- `bun.lock` no longer contains the 4 packages (after regen)
- `npm ci` succeeds with the new package-lock.json
- `bun install --frozen-lockfile` succeeds with the new bun.lock
- `npm run lint` passes
- `npm run lint:eslint -- --max-warnings=0` passes
- `npm run test:critical` 226/226 passing
- `bun run lint` passes