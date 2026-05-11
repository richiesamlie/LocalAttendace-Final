# Documentation Index

**Last Updated:** 2026-05-11  
**Purpose:** Single source index for active project documentation only.
**Bahasa / Language:** English as canonical text, with concise Indonesian guidance for key operational notes.

---

## Active Documentation Set

| Document | Purpose | Audience |
|----------|---------|----------|
| [README.md](README.md) | Main documentation: setup, features, deployment, tech stack | All users |
| [USER_GUIDE.md](USER_GUIDE.md) | Step-by-step usage guide | End users (teachers) |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Common issues and fixes | All users |
| [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) | Developer workflows, coding patterns, testing | Developers |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture, backend/frontend data flow, security model | Developers |
| [API_REFERENCE.md](API_REFERENCE.md) | API endpoint contracts and validation schemas | Developers |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Branching, commits, PR process, contribution standards | Contributors |

---

## Current Repository Status

- Documentation cleanup completed: non-core audit/handoff/progress docs removed.
- Security hardening + contract alignment phases completed.
- Excel engine migrated from `xlsx` to `exceljs`.
- Runtime blocking bcrypt sync paths migrated to async in active request paths.

---

## Quick Start Paths

1. **New user:** [README.md](README.md) → [USER_GUIDE.md](USER_GUIDE.md)
2. **Developer onboarding:** [README.md](README.md) → [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md)
3. **API work:** [ARCHITECTURE.md](ARCHITECTURE.md) → [API_REFERENCE.md](API_REFERENCE.md)
4. **Issue triage:** [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

---

## Documentation Maintenance Rules

- Keep this index limited to files that currently exist in the repository.
- When deleting docs, update this file in the same commit.
- When API contracts change, update `API_REFERENCE.md` and any affected examples immediately.
- When architecture or runtime behavior changes, update `ARCHITECTURE.md` and/or `DEVELOPER_GUIDE.md`.

---

*For documentation improvements, open a PR with docs updates + verification notes (lint/test if code paths are affected).*
