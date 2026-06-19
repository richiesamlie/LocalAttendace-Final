# Phase 4 — Setup Script Consolidation (REVISED)

> **Goal:** drop truly-unused + duplicated setup scripts; preserve the Windows end-user release flow + dev/CI utilities.
> **Risk:** MEDIUM — touches top-level scripts + `scripts/` + `package.json` + `src/repositories/`.
> **Reversibility:** one commit, `git revert` returns to clean state.

## Critical context discovered during pre-verification

- **`release.yml` line 60** instructs Windows end users to run `setup-env.ps1` after extracting the release zip. **Must keep `setup-env.ps1`.**
- **`clean-db.ps1` and `kill-server.ps1`** are referenced by ZERO callers (no scripts, no docs, no release notes). Truly dead.
- **`clean-db.sh` and `kill-server.sh`** ARE used via `bun scripts/exec-by-platform.mjs clean-db` (package.json `db:clean`/`db:clean:force`/`db:clean:backup` and `kill`). But the `bun run db:clean` / `bun run kill` commands are dev-only conveniences — devs can `rm database.sqlite*` and Ctrl+C just as easily.
- **`setup-postgres.{ts,sh,bat}`** — only called by `db:setup:postgres` / `db:migrate:to-postgres` scripts. One-shot setup; server auto-detects `DATABASE_URL` at boot (`server.ts:31-61`).
- **`start-internal-site.{sh,bat}`** — duplicates `start-app.{sh,bat}` with one extra `--network` flag. The base scripts already accept that flag.
- **`setup-windows-startup.bat`** — Windows admins auto-start via the Start Menu, not a repo file. YAGNI.

## Files to delete (final list)

### Top-level — Windows admin uses `.bat`, dev uses `.sh`, `.ps1` only when no `.bat` exists

| File | Reason |
|------|--------|
| `clean-db.ps1` | No caller. `db:clean` package script will be dropped. |
| `kill-server.ps1` | No caller. `kill` package script will be dropped. |
| `clean-db.sh` | Drops with `db:clean` package script. Ponytail: `rm database.sqlite*` is one line. |
| `kill-server.sh` | Drops with `kill` package script. Ponytail: Task Manager / Ctrl+C. |
| `start-internal-site.bat` | `start-app.bat --network` does the same thing. |
| `start-internal-site.sh` | Same. |
| `setup-windows-startup.bat` | Windows admins use Start Menu, not a repo file. |

### scripts/

| File | Reason |
|------|--------|
| `scripts/setup-postgres.ts` | One-shot setup; server auto-detects `DATABASE_URL` at boot. |
| `scripts/setup-postgres.sh` | Wrapper for the above. |
| `scripts/setup-postgres.bat` | Wrapper for the above. |
| `scripts/exec-by-platform.mjs` | Only invoked by `db:clean` / `kill` package scripts (both dropped). |

### src/

| File | Reason |
|------|--------|
| `src/repositories/migrate.ts` | Only called by `scripts/setup-postgres.ts`. |

Total: 12 files deleted.

## Files KEPT

| File | Why |
|------|-----|
| `start-app.bat` | Primary Windows end-user entry (release.yml step 5, user profile = Windows double-click). |
| `start-app.sh` | Dev/CI entry. |
| `setup-env.ps1` | **release.yml step 3** — Windows admin runs this after extracting zip. |
| `setup-env.sh` | Dev/CI/Mac/Linux equivalent. |
| `scripts/fresh-start.ts` | `bun run db:fresh`. |
| `scripts/restore.ts` | `bun run db:restore`, `bun run db:restore:list`. |
| `scripts/seed.ts` | `bun run db:seed`. |
| `scripts/check-doc-links.mjs` | `bun run lint:docs`. |

## package.json changes

Remove these 6 scripts:

```json
"kill": "bun scripts/exec-by-platform.mjs kill-server",
"db:clean": "bun scripts/exec-by-platform.mjs clean-db",
"db:clean:force": "bun scripts/exec-by-platform.mjs clean-db --force",
"db:clean:backup": "bun scripts/exec-by-platform.mjs clean-db --backup",
"db:setup:postgres": "bun scripts/setup-postgres.ts",
"db:migrate:to-postgres": "bun src/repositories/migrate.ts",
```

## Gate commands (CI parity)

```bash
export DEFAULT_ADMIN_PASSWORD=*** "JWT_SECRET=*** rand -hex 16)" > .env
npm ci
npm run lint                       # tsc --noEmit
npm run lint:eslint -- --max-warnings=0
npm run test:critical              # 226 critical tests
bun install --frozen-lockfile      # bun parity
bun run lint                       # bun parity
```

## Steps

1. Run verification grep — confirm `setup-env.ps1` is referenced in release.yml (MUST keep)
2. Edit `package.json` to remove the 6 scripts above
3. Delete the 12 files via `git rm`
4. Run all gates
5. Commit

## Commit

```
chore(scripts): drop dev-only setup tools + one-shot postgres setup

Phase 4 of the ponytail major cut.

- clean-db.ps1 + kill-server.ps1: zero callers, dead.
- clean-db.sh + kill-server.sh + scripts/exec-by-platform.mjs:
  package.json `db:clean` and `kill` scripts deleted too.
  Ponytail: devs can `rm -f database.sqlite*` and Ctrl+C. No 100-line
  process-detection wrapper for that.
- start-internal-site.{sh,bat}: duplicates start-app.{sh,bat} with one
  extra --network flag that start-app already accepts.
- setup-windows-startup.bat: Windows admins use Start Menu, not a repo file.
- scripts/setup-postgres.{ts,sh,bat} + src/repositories/migrate.ts:
  one-shot setup for optional DB; server.ts already auto-detects
  DATABASE_URL at boot.

KEPT:
- start-app.{sh,bat}: primary entry points
- setup-env.{sh,ps1}: release.yml references setup-env.ps1 as the
  Windows end-user post-extract setup step
- scripts/{fresh-start,restore,seed}.ts + check-doc-links.mjs: load-bearing
  db: scripts

Verified: tsc --noEmit clean, eslint --max-warnings=0 clean,
test:critical 226/226 passing, bun install --frozen-lockfile clean,
bun run lint clean.

See docs/plans/2026-06-19-ponytail-major-cut-plan.md
```

## Exit Criteria

- 12 files deleted
- 6 package.json scripts removed
- `setup-env.ps1` retained (release.yml still references it)
- All gates pass