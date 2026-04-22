# Agent Handoff — Teacher Assistant

**Last Updated:** 2026-04-22 (split into focused docs)
**Branch:** `feature/split-routes-v2`
**Repo:** https://github.com/richiesamlie/LocalAttendace-Final

---

## Quick Start

```bash
npm install
.\setup-env.ps1  # Windows
npm run dev
```

Login: `admin` / `DEFAULT_ADMIN_PASSWORD` from `.env`

---

## Documentation

| Doc | Purpose |
|-----|---------|
| `ARCHITECTURE.md` | System design, data flow, security |
| `DEVELOPER_GUIDE.md` | How to add features, coding conventions |
| `API_REFERENCE.md` | All API endpoints with types |
| `TROUBLESHOOTING.md` | Common issues and fixes |
| `CONTRIBUTING.md` | Git workflow, commit conventions |
| `STATE_MANAGEMENT.md` | Zustand + React Query hybrid approach |
| `IMPROVEMENT_PLAN.md` | Technical debt and refactoring roadmap |

---

## What's Here

- **15+ page React app** — Dashboard, Roster, Attendance, Reports, Seating, Timetable, etc.
- **Multi-teacher support** — RBAC with invite system
- **Local-first** — SQLite (default) or PostgreSQL (optional)
- **Well-tested** — 40+ unit tests, 7 E2E test files

---

## Key Files

| File | Purpose |
|------|---------|
| `routes.ts` (278L) | Routes → delegates to `src/routes/*.routes.ts` |
| `src/routes/` | 13 route modules |
| `services.ts` (715L) | Service layer (11 service objects) |
| `src/db/` | Database: schema, statements, cache, queue |
| `src/store.ts` (759L) | Zustand state management |
| `src/lib/api.ts` | Frontend fetch wrapper |
| `src/hooks/useData.ts` | React Query hooks + sync |

---

## Current State (2026-04-22)

### Improvement Plan Progress: ~75% Complete

| Phase | Status | Items |
|-------|--------|-------|
| Phase 1-2 | ✅ Done | Dead repo removed, type safety fixed |
| Phase 3 | ✅ Done | routes.ts split, db.ts split |
| Phase 4 | ✅ Partial | Types extracted, full slice deferred |
| Phase 5 | 🔄 ~60% | M1 done, M2 partial (tests + coverage) |
| Phase 6 | 🔄 Done | AGENT_HANDOFF split into focused docs |

### All 37 Audit Items Fixed
- 3 Critical (JWT session revocation, updated_at triggers, poll sync)
- 8 Medium (cache invalidation, DB restore, request deduplication)
- 12 Low (interval cleanup, date format, click-outside handlers)

### Recent Work (feature/split-routes-v2)
- Phase 3: Split routes.ts into 13 modules, db.ts into 6 modules
- Phase 4: Extracted types to src/types/store.ts
- Phase 5: Refactored updateCurrentClass, added 37 validation tests

---

## Important Notes

1. **Path:** `c:/repo`
2. **Auth:** Cookie-only (no Authorization header bypass)
3. **Write queue:** All writes serialized via `db.enqueueWrite()`
4. **Validation:** All input via Zod schemas with `safeString()`
5. **No alert/confirm:** Use `react-hot-toast` only
6. **Sort roll numbers:** Use `localeCompare(..., { numeric: true })`

---

## Before Committing

```bash
npm run lint    # tsc --noEmit
npx vitest run  # Tests pass
npm run build   # Builds successfully
```

---

## Commit Format

```
fix(module): description
feat(module): description
docs(module): description
```

Small, descriptive commits. Push to `origin/develop` after.

---

*See individual docs for details.*