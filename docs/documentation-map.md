# Documentation Index

**Last Updated:** 2026-06-18
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
| [dependency-governance.md](dependency-governance.md) | Dependency update cadence, validation, and rollback strategy | Maintainers |
| [release-notes-template.md](release-notes-template.md) | Standard release note template for promote `develop` -> `main` | Maintainers |
| [repository-artifact-policy.md](repository-artifact-policy.md) | Source vs runtime artifact boundaries for clean commits | Contributors |

---

## Current Repository Status

- **Security audit completed 2026-06-18** — 15 of 15 findings closed (Phase 10, Batches 1-6)
- Audit closeout docs in `docs/plans/2026-06-18-phase10-batch{1..6}-remediation-report.md`
- Cumulative release notes in `docs/release-notes-develop-to-main-2026-06-18-audit-remediation-batch{1..6}.md`
- Excel engine: `exceljs` (with import/export guardrails)
- Runtime: bcrypt cost 12, async-only paths
- CI: GitHub Actions dual-runtime (Bun + npm); `develop` is blocking/hardening lane, `main` is stable

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
