# Teacher Assistant App

A local-first web application for teachers to manage classrooms: attendance, student rosters, seating charts, timetables, calendar events, reports, and Excel import/export.

**Bahasa Indonesia:** see [Quick Indonesian Notes](#quick-indonesian-notes).

## 🔒 Security

Audit completed **2026-06-18** — **15 of 15 findings closed** across 6 batches. All HIGH-severity CVEs resolved.

| Layer | Status |
|-------|--------|
| Auth & sessions | ✅ Access token (1h) + rotating refresh token (7d, reuse-detected) |
| Rate limiting | ✅ 150 login / 500 writes / 10 invite redeem, per 15min |
| Input validation | ✅ Zod schemas on all endpoints |
| Headers | ✅ Helmet CSP |
| Password hashing | ✅ bcrypt cost 12, async-only |
| Dependencies | ✅ 0 HIGH npm CVEs; bun smoke clean |
| Container | ✅ Non-root, capability drops, resource limits |
| CI gates | ✅ ESLint `--max-warnings=0`, 226 critical tests, bun smoke |

Full audit closeout: [`docs/plans/2026-06-18-phase10-batch6-remediation-report.md`](docs/plans/2026-06-18-phase10-batch6-remediation-report.md)

## Quick Start

### Prerequisites
- **Bun** ≥ 1.1 (frontend + Vite build)
- **Node.js** ≥ 18 (backend — `better-sqlite3` native bindings don't load in Bun on Windows)

### Setup
```bash
git clone https://github.com/richiesamlie/LocalAttendace-Final.git
cd LocalAttendace-Final
bun install
bash setup-env.sh        # Linux/macOS — generates .env with secure random secrets
# or .\setup-env.ps1     # Windows PowerShell
```

### Run

| Mode | Command |
|------|---------|
| Production (local) | `bun run build && NODE_ENV=production npx tsx server.ts` |
| Production (network) | `bun run build && NODE_ENV=production npx tsx server.ts --network` |
| Development (hot reload) | `npx tsx server.ts` |
| One-click | Double-click `start-app.bat` (Windows) or `bash start-app.sh` (Linux/macOS) |

Open `http://127.0.0.1:3000` (or the displayed network IP).

### First Login

- **Username:** `admin`
- **Password:** Value of `DEFAULT_ADMIN_PASSWORD` from your `.env`

The app refuses to start if `DEFAULT_ADMIN_PASSWORD` is unset. Change the password after first login via **Admin Dashboard → Settings**.

## Docker

```bash
# Generate .env (one time)
bash setup-env.sh

# Build + run
docker-compose up -d
```

Available at `http://localhost:3000`. Container runs as non-root (UID 1001), drops all Linux capabilities, capped at 512MB RAM / 1 CPU / 100 processes. Database persists via named volume `teacher-assistant-data`.

## Quick Indonesian Notes

- Login awal: gunakan akun `admin` dengan password dari `DEFAULT_ADMIN_PASSWORD` di file `.env`.
- Untuk pemakaian sekolah harian: fokus ke Dashboard, Student Roster, Take Attendance, dan Monthly Reports.
- Import Excel memakai `exceljs` dengan guardrails aktif (batas ukuran file/sheet).
- Untuk masalah umum, cek [`docs/troubleshooting.md`](docs/troubleshooting.md) dulu sebelum eskalasi.

## Multi-Teacher Roles

| Role | Scope | Permissions |
|------|-------|-------------|
| **Administrator** | Global | Access any class, register teachers |
| **Owner (Homeroom)** | Class | Full control of their class |
| **Subject Teacher** | Class | Read/write attendance, students, events, invites |
| **Assistant** | Class | Limited helper access |

Full multi-teacher guide: [User Guide](docs/user-guide.md)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite 6, Tailwind CSS 4 |
| State | Zustand 5, React Query 5 |
| Backend | Express 4.21, better-sqlite3 12 |
| Auth | JWT (access 1h + refresh 7d), bcrypt cost 12, HttpOnly `__Host-` cookies |
| Realtime | Socket.IO 4 (JWT handshake + origin allowlist) |
| Validation | Zod 4 |
| Security | Helmet CSP, express-rate-limit, prepared statements, PII log redaction |
| Database | SQLite (default) or PostgreSQL (optional) |
| Excel | exceljs |
| Container | Docker multi-stage alpine, non-root, capability drops |
| CI | GitHub Actions dual-runtime (Bun + npm) |

## CI/CD

GitHub Actions runs three workflows on every push to `develop` and `main`:

| Workflow | develop | main |
|----------|:-------:|:----:|
| **CI**: TypeScript Check | ✓ | ✓ |
| **CI**: ESLint (`--max-warnings=0`) | ✓ | ✓ |
| **CI**: Build Verification | ✓ | ✓ |
| **CI**: Docs Link Check | ✓ | ✓ |
| **CI**: Bun Parity Smoke (blocking) | ✓ | — |
| **CI**: Critical Tests (226, fast gate) | ✓ | — |
| **CI**: Full Test Suite (505, main/PR gate) | — | ✓ |
| **CI**: Test Coverage (main baseline) | — | ✓ |
| **Security**: npm audit (`--omit=dev --audit-level=high`) | ✓ | ✓ |
| **Security**: CodeQL Analysis | ✓ | ✓ |
| **Security**: Bun Security Smoke (blocking at high) | ✓ | — |
| **Automated Release** | — | ✓ |

**`develop` = blocking/hardening lane. `main` = stable/production lane.** Promotion to `main` requires explicit user approval and uses `git merge --no-ff`.

### Local CI parity

```bash
npm run lint                              # TypeScript check
npm run lint:eslint -- --max-warnings=0   # ESLint blocking gate
npm run test:critical                     # 226 tests (fast)
npm test                                  # 505 tests (full suite)
bun install --frozen-lockfile && bun run lint
bun audit --audit-level=high              # Bun security gate
```

## Documentation

| Audience | Document |
|----------|----------|
| End users (teachers) | [User Guide](docs/user-guide.md) |
| Troubleshooting | [Troubleshooting](docs/troubleshooting.md) |
| Developers | [Developer Guide](docs/developer-guide.md), [Contributing](docs/contributing.md) |
| Architecture | [Architecture](docs/architecture.md) |
| API contracts | [API Reference](docs/api-reference.md) |
| Operations / CI | [Operations Runbook](docs/operations.md) |
| Dependencies | [Dependency Governance](docs/dependency-governance.md) |
| All docs | [Documentation Map](docs/documentation-map.md) |

## Performance Highlights

- Pre-compiled SQL statements (~40% faster queries)
- WAL-mode SQLite with auto-checkpointing
- Gzip compression (60-80% smaller responses)
- React Query caching (5min stale, 30min cache)
- Pagination for records/events (handles 10k+ records)
- All fs operations async (no event-loop blocking)

## License

For educational and personal use.
