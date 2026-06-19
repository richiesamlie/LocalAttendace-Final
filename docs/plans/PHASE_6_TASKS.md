# Phase 6 — useData.ts Trim (REVISED from hook consolidation)

> **Goal:** delete dead hooks from `src/hooks/useData.ts` (394 → ~100 LOC). Keep `useAuth`, `useLogin`, `useLogout`, `useClassSync`, and `queryKeys` constants (the only externally-used exports).
> **Risk:** MEDIUM — touches a shared module; many components transitively rely on the kept hooks.
> **Reversibility:** one commit, `git revert` returns to clean state.

## Discovery during planning (audit was right shape, wrong specifics)

Pre-verification: `grep -rln "from.*hooks/useData" src/` returned exactly ONE file: `src/App.tsx`. The four hooks it imports are:

- `useAuth` — used in `App.tsx`
- `useLogin` — used in `App.tsx` (via `LoginScreen`)
- `useLogout` — used in `App.tsx`
- `useClassSync` — used in `App.tsx`

Everything else in `useData.ts` (30+ hooks: `useClasses`, `useStudents`, `useRecords`, `useEvents`, `useTimetable`, `useSeating`, `useDailyNotes`, `useSettings`, all 20+ mutations) has ZERO importers.

Separately, `queryKeys` constants are imported by `src/hooks/useSocket.ts` for invalidating queries on websocket events. Keep `queryKeys`.

## What gets CUT vs KEPT

| Section | LOC | Action |
|---------|-----|--------|
| `useAuth` (lines ~22-45) | 23 | KEEP — used by App.tsx |
| `useLogin` (lines ~47-60) | 13 | KEEP — used by App.tsx |
| `useLogout` (lines ~62-74) | 13 | KEEP — used by App.tsx |
| `queryKeys` constants (lines 6-20) | 15 | KEEP — used by useSocket.ts |
| `useClasses` | 7 | DELETE — zero importers |
| `useStudents` | 8 | DELETE — zero importers |
| `useRecords` | 8 | DELETE — zero importers |
| `useEvents` | 8 | DELETE — zero importers |
| `useTimetable` | 8 | DELETE — zero importers |
| `useSeating` | 8 | DELETE — zero importers |
| `useDailyNotes` | 8 | DELETE — zero importers |
| `useSettings` | 7 | DELETE — zero importers |
| All 20+ mutation hooks (create/update/delete/sync/save) | ~190 | DELETE — zero importers |
| `useClassSync` (lines ~353-394) | 42 | KEEP — used by App.tsx |

Net target: 394 → ~115 LOC (-279).

## Hook consolidation skipped

Original audit said: collapse `useStopwatch` (51 LOC) + `useTimer` (79 LOC) into `useChrono`. Decision: **skip**. The two hooks serve genuinely different purposes (count-up stopwatch vs count-down timer with duration editing). Collapsing requires a complex API (`{ countdown?: boolean, autostart?: boolean, onTick?, ... }`) that obscures callsites more than it saves. They're also only used in one component each (ExamTimer.tsx). The 130 LOC cost is for genuinely-different abstractions.

If future evidence shows ExamTimer is the only place either is used, the inlinethem refactor becomes attractive. For now, leave them.

## Files to PATCH (1)

### `src/hooks/useData.ts` (394 → ~115 LOC)

Rewrite to keep only:
- `queryKeys` constant (lines 6-20 of current)
- `useAuth`, `useLogin`, `useLogout`, `useClassSync` (the 4 used hooks)
- Remove unused imports if any remain

## Gate commands (CI parity)

```bash
export DEFAULT_ADMIN_PASSWORD=*** "JWT_SECRET=*** rand -hex 16)" > .env
npm ci
npm run lint                       # tsc --noEmit
npm run lint:eslint -- --max-warnings=0
npm run test:critical              # 211 critical tests
npm run test                       # full suite (475 tests after Phase 5)
```

## Steps

1. Run pre-verification: `grep -rn "from.*hooks/useData" src/` → expect only `src/App.tsx`
2. Confirm `useSocket.ts` is the only `queryKeys` consumer: `grep -rn "queryKeys\." src/` → expect only useData.ts + useSocket.ts
3. Write the slim `useData.ts` (replace via `write_file` since the rewrite is large)
4. Run gates
5. Commit

## Commit

```
refactor(hooks): trim useData.ts to its 4 used exports (394 -> 115 LOC)

Phase 6 of the ponytail major cut. Discovered during planning: of the
30+ hooks in useData.ts, exactly 4 have any importers (all via App.tsx):
useAuth, useLogin, useLogout, useClassSync. Plus the queryKeys constant
is used by useSocket.ts for websocket-driven invalidation. Everything
else (useClasses, useStudents, all 20+ mutations, etc.) is dead code.

Original audit suggested collapsing useStopwatch + useTimer into useChrono.
Skipped: the two hooks have genuinely different semantics (count-up
stopwatch vs count-down timer with duration editing) and inlining them
would require a complex flag-driven API. They're also only used in
ExamTimer.tsx. Cost (130 LOC) is for genuinely-different abstractions.

Verified: tsc --noEmit clean, eslint --max-warnings=0 clean,
test:critical 27/27 211/211 passing, test (full) 39/39 475/475 passing.

See docs/plans/2026-06-19-ponytail-major-cut-plan.md
```

## Exit Criteria

- `src/hooks/useData.ts` reduced to ~115 LOC
- All 4 used hooks preserved with identical behavior
- `queryKeys` preserved
- All gates pass
- Commit created