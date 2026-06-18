# Phase 10 — Batch 1 Remediation Plan

> **Branch:** `develop`
> **Mode:** Fix (audit-only completed in `C:\repo\audit\localattendance\`)
> **Source artifacts:** `C:\repo\audit\localattendance\SECURITY_AUDIT_REPORT.md` (master), `SECURITY_RESIDUAL_RISK_REGISTER.md` (evidence)

## Scope (Batch 1 only — Critical/High)

This phase covers the 5 Critical/High items from the audit's "Batch 1" remediation list. Subsequent batches (auth/session hardening, input/output hardening, architectural cleanups, docker, hygiene) will be separate phases.

| Finding | Title | Severity |
|---------|-------|----------|
| F-001 | Socket.IO handshake has NO JWT authentication | 🟠 High |
| F-013 | 5 HIGH npm-audit CVEs in runtime deps | 🟠 High |
| F-014 | CI gate effect on audit findings unverified | 🟠 High |
| F-019 | Release zip missing `.env*`/logs/backups exclusions | 🟡 Medium |
| F-021 | JWT verify doesn't pin algorithm | 🟡 Medium (defense-in-depth) |

## Execution Order (small commits, verified after each)

1. **Setup:** add `audit/` to `.gitignore` so audit artifacts stay out of repo (hygiene)
2. **F-021** — Pin `algorithms: ['HS256']` at 3 `jwt.verify` callsites (defense-in-depth, smallest risk)
3. **F-019** — Add `.env*`, logs, backups, coverage, test-results, spikes, `.github` to release zip exclusions
4. **F-014** — Make CI gate failure visible (add explicit failure artifact / surface in summary)
5. **F-013** — `npm audit fix` non-breaking + pin Socket.IO chain updates
6. **F-001** — Socket.IO JWT handshake middleware + per-room access check + new security test

## Branch Discipline
- **All work on `develop`**
- **DO NOT** promote `develop → main` — wait for explicit user approval
- Use Conventional Commits (`fix(scope): ...`) matching project convention
- Update `CHANGELOG.md` (or `docs/plans/` closeout note) before any promotion

## Verification Per Phase-Part
After each commit:
- `npm run lint` (tsc --noEmit)
- `npm run lint:eslint -- --max-warnings=0`
- `npm run test:critical` (the 7 explicit security/auth/contract tests)
- For F-001: add new test to `src/test/security/auth.socket.security.test.ts`

## Pre-Phase Git Status Check
- main HEAD `dfd113f` == develop HEAD `a02ff11` (trees identical, all develop work is merged into main)
- `origin/develop` in sync with local `develop`
- Working tree clean except `audit/` (untracked — will be ignored after step 1)

## Safe Resume From
Read this file + run `git log --oneline -10 develop` + `git status` to see current state.