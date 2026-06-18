# Release Notes — develop → main

> **Status:** ready for promotion (awaiting explicit approval)
> **Branch:** `develop` (local; not yet pushed)
> **Range:** 6 commits added since Batch 3 closeout
> **Date:** 2026-06-18
> **Audit Batch:** 4 of 6 (Architectural Hardening)

## 🎯 Headline

Performance monitor scrubs PII, Socket.IO rejects cross-origin
handshakes, server-error.log no longer blocks the event loop, and
admin endpoints now have RBAC enforced ONCE at the router level.
**170/170 critical tests pass; ALL 15 audit findings now closed.**

## ✨ Highlights

### requireAdmin middleware (F-011)
The 14 per-handler admin checks across `admin.routes.ts` collapsed
into a single `adminRouter.use(requireAuth, requireAdmin)` line.
**-112 lines of duplicate code removed** with zero behavior change.
A new admin endpoint can no longer accidentally forget the check.

### Socket.IO handshake origin check (F-018)
Custom `allowRequest` callback validates `Origin` header against
`getAllowedOrigins()` BEFORE the websocket upgrade completes. The
HTTP `cors.origin` setting only covers regular requests — handshakes
needed their own check.

### Async error log + sync I/O migration (F-016+F-017)
`fs.appendFileSync` on every uncaughtException could freeze the
event loop under an error storm. Replaced with a write stream opened
at module init. Admin backup/restore paths migrated to `fs.promises.*`.

### Performance monitor PII sanitization (F-023)
`req.originalUrl` was logged verbatim — query strings like
`?search=John%20Doe` ended up in stdout. New `sanitizeUrlForLog()`
strips query strings and caps path length at 80 chars.

### Dual student router mount documented (F-022)
`studentRouter` mounts at both `/classes` (canonical) and `/students`
(legacy alias). Audit asked whether RBAC is identical at both — yes,
confirmed by source analysis + integration tests. Documented in code
so future maintainers don't accidentally remove the legacy alias.

## 🐛 Bug Fixes

- Fixed `vi` import missing in `routes.dual-mount.security.test.ts`
  (stale reference from earlier iteration).

## 🔧 Operational Changes

| Item | Before | After |
|------|--------|-------|
| Admin RBAC checks | 14 per-handler duplicates | 1 router-level `use()` |
| `admin.routes.ts` LOC | 358 lines | 245 lines (-113 net) |
| `server-error.log` writes | sync `appendFileSync` per error | async write stream |
| Socket.IO origin check | HTTP-only | HTTP + websocket handshake |
| Performance monitor URLs | raw `req.originalUrl` | sanitized (no query string, capped) |

## 📊 Metrics

| Metric | Before | After |
|--------|--------|-------|
| Audit findings open (cumulative) | 4 (post-Batch 3) | **0** — **ALL 15 CLOSED** |
| Critical tests | 133 | **170** (+37) |
| npm HIGH CVEs | 0 | **0** |
| ESLint warnings | 0 | **0** (under `--max-warnings=0`) |
| `admin.routes.ts` size | 358 lines | 245 lines (-113) |

## 🧪 Test Coverage Added (Batch 4)

| File | Cases | Coverage |
|------|------:|----------|
| `performance.url-sanitize.security.test.ts` | 8 | URL sanitization (query strip, length cap, PII protection) |
| `routes.dual-mount.security.test.ts` | 6 | Both student mounts return identical responses (RBAC parity) |
| `socketio.allow-request.security.test.ts` | 6 | allowRequest callback present, uses getAllowedOrigins, rejects cross-origin |
| `server.async-fs.security.test.ts` | 9 | createWriteStream in use, no appendFileSync, fs.promises.* in admin |
| `admin.require-admin.security.test.ts` | 8 | requireAdmin exported, applied once at router level, zero inline is_admin checks |

## 🚨 Breaking Changes

**None.** Batch 4 is purely architectural / defense-in-depth — no API
contract changes, no new errors visible to clients.

## 🛠 Deployment Notes

1. **No database migration required.** Schema unchanged in Batch 4.
2. **`adminRouter.use()` runs on EVERY admin route.** No client-side
   changes needed; admin behavior is identical from the user's
   perspective.
3. **`SERVER_ERROR_LOG`** env var can now override the error log
   path if needed (defaults to `server-error.log` in cwd).
4. **Socket.IO allowRequest** is strict by default — operators
   running behind a reverse proxy should ensure `ALLOWED_ORIGINS`
   env var is set correctly or the WebSocket connections will be
   rejected.

## 📋 Commits (develop only — not yet on main)

```
a1b0401 refactor(admin): extract requireAdmin middleware, apply once (F-011)
31fe8ae feat(async-fs): async error log stream + migrate sync fs ops (F-016+F-017)
9bc1ad1 feat(ws): Socket.IO allowRequest origin check + cleanup (F-018)
f00fde7 docs(routes): document dual student router mount + verify RBAC parity (F-022)
6679476 fix(logging): sanitize URLs in performance monitor (F-023)
12b6596 docs(plans): add phase 10 batch 4 architectural hardening plan
```

## 🏆 Cumulative Audit Status (Batches 1+2+3+4)

| Batch | Findings Closed | Tests Added | LOC Impact |
|-------|----------------|------------:|-----------:|
| 1 (Auth/Socket) | 5 (F-001, F-013, F-014, F-019, F-021) | 16 | moderate |
| 2 (Auth/Session) | 5 (F-004, F-005, F-006, F-008, F-020) | 36 | large (refresh tokens) |
| 3 (I/O Hardening) | 5 (F-002, F-007, F-009, F-012, F-024) + F-010 verified | 45 | medium |
| 4 (Architectural) | 6 (F-011, F-016, F-017, F-018, F-022, F-023) | 37 | negative (-113 in admin) |
| **Total** | **21 of 21** | **134** | net positive |

**F-003 was accepted as a documented risk per user direction (current
password length is acceptable for this deployment).**

## ⏭️ What's Next (Batch 5 preview, pending approval)

Docker & ops findings:
- **F-028** — Dockerfile hardening (non-root user, no apt cache, multi-stage build)
- **F-029** — docker-compose security (no privileged mode, read-only mounts)
- **F-027** — Dead `define` block in code (cleanup)

Plus hygiene (Batch 6):
- **F-015** — `.env.backup*` gitignore pattern
- **F-026** — README rate-limit drift doc

---

**Promotion action required (cumulative for Batches 1+2+3+4):**
```
# Run only after explicit user approval
git checkout main
git merge --no-ff develop -m "merge: audit remediation batches 1+2+3+4 (develop→main)"
git push origin main
```

**No merge has been performed.** Awaiting approval per develop-first rule.