# Changelog

All notable changes to this project documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed (in `feature/v2-ponytail-major-cut` branch)
- Ponytail refactor — see [docs/plans/2026-06-19-ponytail-major-cut-plan.md](docs/plans/2026-06-19-ponytail-major-cut-plan.md) for full plan.
- See [docs/plans/2026-06-19-ponytail-audit.md](docs/plans/2026-06-19-ponytail-audit.md) for audit findings.
- Will be released as 2.0.0 once merged to `main`.

## [1.0.0] — 2026-06-18

### Security (Phase 10 remediation, all 15 findings closed)
- Socket.IO JWT handshake auth + per-room class access check
- JWT algorithm pinned to HS256 (3 verify callsites)
- Refresh token rotation with reuse detection
- Helmet CSP (production)
- Rate limiting: 150 login / 500 writes / 10 invite redeem per 15min
- bcrypt cost 12, async-only
- express.json 100kb body limit
- Docker non-root (UID 1001), all caps dropped, 512MB RAM / 1 CPU / 100 procs
- CI gates: ESLint `--max-warnings=0`, 226 critical tests, bun smoke, CodeQL

### Added
- Multi-teacher roles (Administrator / Owner / Subject Teacher / Assistant)
- Invites system (rotating codes, role-bound)
- Session management UI (revoke any device)
- Excel import/export with guardrails
- PII log redaction
- Socket.IO real-time class updates
- Docker multi-stage alpine build

[Unreleased]: https://github.com/richiesamlie/LocalAttendace-Final/compare/v1.0.0...HEAD