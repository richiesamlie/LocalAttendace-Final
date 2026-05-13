# Documentation Index

**Last Updated:** 2026-05-11  
**Purpose:** Single source index for active project documentation only.
**Bahasa / Language:** English as canonical text, with concise Indonesian guidance for key operational notes.

---

## Active Documentation Set

| Document | Purpose | Audience |
|----------|---------|----------|
| [README.md](../README.md) | Main documentation: setup, features, deployment, tech stack | All users |
| [user-guide.md](user-guide.md) | Step-by-step usage guide | End users (teachers) |
| [troubleshooting.md](troubleshooting.md) | Common issues and fixes | All users |
| [developer-guide.md](developer-guide.md) | Developer workflows, coding patterns, testing | Developers |
| [architecture.md](architecture.md) | System architecture, backend/frontend data flow, security model | Developers |
| [api-reference.md](api-reference.md) | API endpoint contracts and validation schemas | Developers |
| [contributing.md](contributing.md) | Branching, commits, PR process, contribution standards | Contributors |

---

## Current Repository Status

- Documentation cleanup completed: non-core audit/handoff/progress docs removed.
- Security hardening + contract alignment phases completed.
- Excel engine migrated from `xlsx` to `exceljs`.
- Runtime blocking bcrypt sync paths migrated to async in active request paths.

---

## Quick Start Paths

1. **New user:** [README.md](../README.md) → [user-guide.md](user-guide.md)
2. **Developer onboarding:** [README.md](../README.md) → [developer-guide.md](developer-guide.md)
3. **API work:** [architecture.md](architecture.md) → [api-reference.md](api-reference.md)
4. **Issue triage:** [troubleshooting.md](troubleshooting.md)

---

## Documentation Maintenance Rules

- Keep this index limited to files that currently exist in the repository.
- When deleting docs, update this file in the same commit.
- When API contracts change, update `api-reference.md` and any affected examples immediately.
- When architecture or runtime behavior changes, update `architecture.md` and/or `developer-guide.md`.

---

*For documentation improvements, open a PR with docs updates + verification notes (lint/test if code paths are affected).*
