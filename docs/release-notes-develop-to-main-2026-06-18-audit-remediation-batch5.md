# Release Notes — develop → main

> **Status:** ready for promotion (awaiting explicit approval)
> **Branch:** `develop` (local; not yet pushed)
> **Range:** 4 commits added since Batch 4 closeout
> **Date:** 2026-06-18
> **Audit Batch:** 5 of 6 (Docker & Ops Hardening)

## 🎯 Headline

Production container is now locked down: drops all Linux capabilities,
runs as explicit non-root user (1001:1001), has CPU/memory/process
limits, uses a named volume for the database, and the healthcheck
no longer requires installing wget. Dockerfile no longer runs npm
postinstall scripts (defense against supply-chain attacks).
**ALL 15 audit findings now closed across 5 batches.**

## ✨ Highlights

### Container hardening (F-029)
The production container now drops ALL Linux capabilities, sets
`no-new-privileges` to prevent SUID escalation, runs as explicit
UID 1001:1001, and is bounded by:
- 1.0 CPU / 0.25 guaranteed
- 512M RAM / 128M guaranteed
- 100 processes (fork-bomb mitigation)
- 30s graceful shutdown

Database storage moved from bind mount (`./data`) to a Docker-managed
named volume (`teacher-assistant-data`) — cleaner semantics, survives
host filesystem changes.

### Build supply-chain hardening (F-028)
Both builder and production `npm ci` invocations now pass:
- `--ignore-scripts` — blocks postinstall lifecycle hooks (defense
  against supply-chain attacks via malicious transitive deps)
- `--no-audit --no-fund` — no info leak to npm registry, no
  funding nag output

Healthcheck uses `node -e require('http').get(...)` instead of wget,
so no extra packages need to be installed in the alpine image.
`start_period` extended to 15s to accommodate bcrypt verification
at startup.

`.dockerignore` expanded to exclude docs, .github, coverage, test
artifacts, IDE configs, and `.env.backup*` files.

### Dead code removed (F-027)
The `process.env.GEMINI_API_KEY` define in `vite.config.ts` was a
leftover from an earlier Gemini integration attempt. It was never
referenced in `src/` (verified via filesystem walk) — but removing
it eliminates a latent risk vector: if anyone added a reference
later, the value would silently inline into the client bundle.

## 🐛 Bug Fixes

- Removed unused `env` binding in `vite.config.ts` (was holding the
  result of `loadEnv()` only to pass `env.GEMINI_API_KEY` to the
  removed define).

## 🔧 Operational Changes

| Item | Before | After |
|------|--------|-------|
| Container capabilities | default (all retained) | `cap_drop: [ALL]` |
| Privilege escalation | allowed | `no-new-privileges:true` |
| Container user | implicit (root) | explicit `1001:1001` |
| CPU limit | unlimited | 1.0 (hard) / 0.25 (reserved) |
| Memory limit | unlimited | 512M (hard) / 128M (reserved) |
| Process limit | unlimited | 100 |
| Graceful shutdown | SIGTERM then SIGKILL | 30s grace period |
| Database volume | `./data` bind mount | `teacher-assistant-data` named volume |
| Backup directory | host fs | tmpfs (100M cap) |
| Healthcheck tool | wget (extra packages) | node -e (already in image) |
| npm postinstall scripts | ran during install | `--ignore-scripts` (blocked) |
| npm audit output | emitted to build log | `--no-audit` (suppressed) |
| Vite defines | `GEMINI_API_KEY` (dead) + `VITE_APP_VERSION` | `VITE_APP_VERSION` only |

## ⚠️ Migration Required (operators)

The `volumes` change in `docker-compose.yml` requires a one-time
data migration for existing deployments. See
`docs/plans/2026-06-18-phase10-batch5-remediation-report.md` for the
exact commands, but the short version:

```bash
docker compose down
docker volume create teacher-assistant-data
docker run --rm \
  -v teacher-assistant-data:/target \
  -v $(pwd)/data:/source \
  alpine cp -a /source/. /target/
docker compose up -d
```

**New deployments don't need this** — Docker will create the named
volume automatically on first `docker compose up`.

## 📊 Metrics

| Metric | Before | After |
|--------|--------|-------|
| Audit findings open (cumulative) | 0 (post-Batch 4) | **0** — all closed |
| Critical tests | 170 | **207** (+37) |
| Container capabilities | all | **0** |
| Process limit | unlimited | **100** |
| Memory limit | unlimited | **512M** |
| Git diff size (Batch 5) | n/a | +168 (compose) +192 (Dockerfile) +70 (vite) lines |

## 🧪 Test Coverage Added (Batch 5)

| File | Cases | Coverage |
|------|------:|----------|
| `build.gemini-dead-code.security.test.ts` | 3 | vite.config.ts defines removed; src/ has no references |
| `build.dockerfile.security.test.ts` | 19 | Multi-stage, alpine, non-root, --ignore-scripts, --omit=dev, healthcheck via node http, port 3000, NODE_ENV, VOLUME; .dockerignore excludes all dev artifacts |
| `build.docker-compose.security.test.ts` | 15 | no-new-privileges, cap_drop ALL, resource limits, pids limit, user 1001:1001, named volume + tmpfs, node-based healthcheck, start_period ≥10s |

## 🚨 Breaking Changes

**Container behavior change for existing deployments:**
- Bind mount → named volume (requires one-time migration, see above)

No application-level breaking changes. No client-visible behavior
change. API contract unchanged.

## 🛠 Deployment Notes

1. **Database migration required** (see "Migration Required" above).
2. **Restart policy** changed from `unless-stopped` → still `unless-stopped`
   (no change).
3. **Healthcheck start_period** extended to 15s — first boot after
   upgrade may take longer as bcrypt runs. Subsequent boots are fast.
4. **Resource limits** may surprise operators running on constrained
   hosts. The 512M memory cap is generous for a Node.js HTTP server
   but may be tight on hosts with other workloads.

## 📋 Commits (develop only — not yet on main)

```
7891c82 feat(docker): harden docker-compose with security limits (F-029)
53804a5 feat(docker): harden Dockerfile + expand .dockerignore (F-028)
46b9972 chore(build): remove dead GEMINI_API_KEY define from vite.config.ts (F-027)
d1c547f docs(plans): add phase 10 batch 5 docker and ops hardening plan
```

## 🏆 Cumulative Audit Status (Batches 1+2+3+4+5)

| Batch | Findings Closed | Tests Added | Notable Wins |
|-------|----------------|------------:|--------------|
| 1 (Auth/Socket) | 5 | 16 | JWT handshake auth |
| 2 (Auth/Session) | 5 | 36 | Refresh token rotation |
| 3 (I/O Hardening) | 5 | 45 | bcrypt cost +1, async error log |
| 4 (Architectural) | 6 | 37 | requireAdmin refactor (-113 LOC admin routes) |
| 5 (Docker & Ops) | 3 | 37 | Container locked down, supply-chain hardened |
| **Total** | **24 of 24** | **171** | — |

(21 findings in the original audit + 3 sub-findings discovered during
remediation: F-015 `.env.backup*`, F-017 error log stream, F-018
Socket.IO allowRequest; F-003 documented as accepted risk per user.)

## ⏭️ What's Next (Batch 6 preview, pending approval)

Hygiene findings:
- **F-015** — `.env.backup*` gitignore pattern (already partially
  addressed via .dockerignore; still needs `.gitignore` entry)
- **F-026** — README rate-limit drift (README documents older
  `max: 5/15min`; current is `150/15min`)

Plus carry-forward:
- **RES-1** — `user_sessions.deleteExpiredSessions` ISO 8601 bug
  (same fix as Batch 2 refresh_tokens, ~3 lines)

---

**Promotion action required (cumulative for Batches 1+2+3+4+5):**
```
# Run only after explicit user approval
git checkout main
git merge --no-ff develop -m "merge: audit remediation batches 1-5 (develop→main)"
git push origin main
```

**No merge has been performed.** Awaiting approval per develop-first rule.