# Ponytail Major Cut — Implementation Plan

> **Branch:** `feature/v2-ponytail-major-cut` (off `main`, NOT merged until user approves)
> **Date:** 2026-06-19
> **Mode:** Major refactor (YAGNI / stdlib-first / native-first / one-liner discipline)
> **Source audit:** [2026-06-19-ponytail-audit.md](2026-06-19-ponytail-audit.md) in this directory
> **Target version:** `2.0.0` (breaking — admin debug endpoints removed, four runtime deps dropped)

## Goal

Slim the codebase to what is actually used and load-bearing. Single-school, single-tenant, local-first attendance app for teachers — production has zero users of admin debug tooling, zero usages of four runtime deps, zero importers of three dead files, and three duplicated config/lock files fighting each other. Cut them. Keep JWT + bcrypt + CSP + rate-limit + Zod + Docker hardening + Socket.IO handshake auth.

## Scope

**In scope:** code removal, dead-dep removal, dual-config consolidation, setup-script deduplication, dead-test removal, hook consolidation, docs sync, version bump to 2.0.0.
**Out of scope:** any new feature, any DB schema change, any UX change, any auth/authz logic change, any performance tuning beyond what naturally falls out of dead-code removal.

## Architecture / Approach

Ponytail ladder, applied strictly:

1. **YAGNI:** admin debug tools (Performance/Resource/Query profiler UI + backend), four unused runtime deps, three unreferenced files, one each of every dual config.
2. **Stdlib first:** React Query already provides caching + dedup; SQLite WAL already serializes writes. Drop `src/db/cache.ts` and `src/db/writeQueue.ts`.
3. **Native first:** ESLint flat config (`eslint.config.js`) supersedes legacy `.eslintrc.json` under ESLint 9 — keep only the one that runs.
4. **Installed-dep last:** keep only deps with active import sites.

**Phase discipline:** small, reversible commits. After each phase: `npm run lint` + `npm run lint:eslint -- --max-warnings=0` + `npm run test:critical`. Bun parity smoke verified at end of Phase 9.

**Reversibility:** every phase is a separate commit on a single feature branch. `git revert <hash>` returns to clean state.

## Phased Roadmap

| # | Phase | Outcome | LOC Δ (est.) | Dep Δ | Risk | Checkpoint |
|---|-------|---------|--------------|-------|------|------------|
| 0 | Branch setup | `feature/v2-ponytail-major-cut` created and pushed | 0 | 0 | none | — |
| 1 | Plan + audit + CHANGELOG baseline | This file + audit artifact + CHANGELOG.md scaffolded | +200 | 0 | none | yes |
| 2 | Dead file removal | `verify-perf-config.ts`, `db.ts` root, `src/services/index.ts`, `.eslintrc.json` deleted | -90 | 0 | low | yes |
| 3 | Dead dep removal | `recharts`, `motion`, `react-window`, `react-virtualized-auto-sizer` removed | ~0 | -4 | med | yes |
| 4 | Setup script consolidation | `.ps1` wrappers, `exec-by-platform.mjs`, `setup-postgres.*`, `setup-windows-startup.bat`, `start-internal-site.*` deleted | -800 | 0 | med | yes |
| 5 | Admin debug tools removed | PerformanceMonitor/QueryProfiler/ResourceMonitor UI + middleware + routes gone; admin routes kept for settings/password only | -1,400 | 0 | high | yes |
| 6 | Hook consolidation | `useChrono` replaces `useStopwatch`+`useTimer`; `useData.ts` parameterized | -350 | 0 | med | yes |
| 7 | Dead-feature cleanup | Gatekeeper component (if duplicate of RandomPicker), `src/db/cache.ts`, `src/db/writeQueue.ts` removed | -200 | 0 | med | yes |
| 8 | Test cleanup | Trim test:critical list + remove orphaned security tests for deleted features | -1,000 | 0 | low | yes |
| 9 | Docs + version bump | README/architecture/api-reference updated; version 2.0.0 | +100/-200 | 0 | low | yes |
| 10 | Final verification | Full lint, full test, build, smoke test, closeout report | 0 | 0 | low | yes |

**Net target:** ~-4,000 lines, -4 runtime deps, ~30% smaller `src/`, no behavior change for end users.

## Verification Gates (run after EVERY phase)

1. `npm run lint` — TypeScript check
2. `npm run lint:eslint -- --max-warnings=0` — ESLint blocking gate
3. `npm run test:critical` — fast critical tests
4. After Phase 5: `npm run test` (full suite) — because admin tests get removed
5. After Phase 9: `bun install --frozen-lockfile && bun run lint && bun run test:critical && bun run build` — Bun parity gate (develop-lane)

## Branch Discipline

- **Working branch:** `feature/v2-ponytail-major-cut` (created off `main`)
- **DO NOT merge to `main`** — user instruction
- **DO NOT merge to `develop`** — also out of scope per user instruction (don't touch main)
- Conventional Commits: `refactor(scope):`, `chore(deps):`, `docs:`, `test:`, `feat:`
- One commit per phase unless the phase naturally splits

## Per-Phase Detail Docs

Each phase gets its own `PHASE_N_TASKS.md` just before execution with exact file paths, complete code, and copy-pasteable commands. (Following the `writing-plans` + `phased-app-build` patterns.)

## Risks / Rollback

| Risk | Mitigation | Rollback |
|------|------------|----------|
| Admin debug endpoints depended on by external scripts | Confirmed: 0 external callers (api.ts is the only client, admin-only) | `git revert <phase-5-commit>` |
| Lockfile desync after dep removal | Both `bun.lock` + `package-lock.json` regenerated by `bun install` then `npm install` | Revert the dep-removal commit, run `bun install` + `npm install` |
| Bun parity smoke fails after hook consolidation | Bun parity only runs on `develop` branch, so this branch won't trigger it; verify locally with `bun install --frozen-lockfile && bun run lint` at Phase 9 | Revert phase 6 commit |
| Tests fail because some test imports `db.ts` or `services/index.ts` | Confirmed via `grep`: 0 test importers of either | Revert phase 2 commit |
| ESLint flat config doesn't cover all `.eslintrc.json` rules | Compare rule sets before deletion; document any rules lost | Restore `.eslintrc.json` |

## Open Questions

None blocking. Implementation proceeds.

## Safe Resume From

After any session break: `git checkout feature/v2-ponytail-major-cut && git log --oneline -10` shows phase progress.