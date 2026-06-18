# Teacher Assistant App

A comprehensive, local-first web application designed to help teachers manage their classrooms efficiently. Features include multi-teacher support (Google Classroom-style), attendance tracking, student roster management, visual seating charts, class scheduling, a random student picker, and monthly reports.

**Catatan dalam Bahasa Indonesia** untuk panduan operasional cepat tersedia di bagian [Quick Indonesian Notes](#quick-indonesian-notes).

## 🔒 Security Status

**Audit completed 2026-06-18** — 15 of 15 findings closed across 6 batches. All HIGH-severity CVEs resolved, no open audit findings.

| Layer | Status |
|-------|--------|
| Auth & sessions | ✅ Refresh token rotation with reuse detection |
| Socket.IO | ✅ JWT handshake + origin allowlist |
| Rate limiting | ✅ Login 150/15min, writes 500/15min, invite 10/15min |
| Input validation | ✅ Zod schemas on all endpoints |
| Headers | ✅ Helmet CSP configured |
| Dependencies | ✅ 0 HIGH npm CVEs; bun smoke clean |
| Container security | ✅ Non-root user, capability drops, resource limits |
| CI gating | ✅ ESLint `--max-warnings=0`, 226 critical tests, bun parity smoke |

See [`docs/plans/2026-06-18-phase10-batch6-remediation-report.md`](docs/plans/2026-06-18-phase10-batch6-remediation-report.md) for the final cumulative audit summary.

## Key Features

### 🏫 Multi-Teacher Support (Google Classroom-style)
- **Homeroom teachers** create and own classes
- **Co-teachers** can be invited to shared classes via invite codes
- Each teacher has their own isolated account
- Only class owners can edit/delete classes or manage teachers

### 📊 Core Features
- **Dashboard** — Overview of today's classes and quick stats
- **Take Attendance** — Record daily attendance (single + bulk Excel import)
- **Student Roster** — Manage students, import from Excel, flag, archive, export
- **Monthly Reports** — Generate and export attendance summaries
- **Daily Timetable** — Weekly schedule with time slots, subjects, lessons
- **Calendar Events** — Manage classwork, tests, exams
- **Visual Seating** — Drag-and-drop seating chart with auto-fill
- **Random Picker** — Animated student selection tool
- **Smart Groups** — Auto-generate balanced student groups
- **Gatekeeper** — Late-tagging for students arriving after class starts
- **Admin Dashboard** — Bulk data management, teacher management, DB ops

### 📥 Excel Import/Export (powered by `exceljs`)
- **Bulk Student Import** — Import entire class rosters
- **Bulk Attendance Import** — Import by roll number or name
- **Full Class Export** — Multi-sheet Excel workbook
- **Monthly Reports** — Customizable column exports

### 🔒 Security & Performance
- **Access + Refresh tokens** — Short-lived access tokens (1h) + rotating refresh tokens (7d, family-revoked on reuse)
- **HttpOnly cookies** — `__Host-` prefix in production
- **Rate limiting** — login 150/15min, writes 500/15min, invite redeem 10/15min
- **bcrypt** at cost 12 (async-only; no sync hash paths)
- **Helmet CSP** — Content Security Policy headers
- **Input validation** — Zod schemas on all endpoints
- **Generic error messages** — No info leak (e.g., invite redeem returns "Unable to redeem invite" regardless of cause)
- **Performance monitor** — URL/PII sanitized, constant-time health endpoint
- **Async I/O** — All fs operations use `fs.promises.*` (no sync on request paths)
- **JSON body limit** — Capped at 100kb (override via `JSON_BODY_LIMIT`)
- **WAL mode** SQLite with auto-checkpointing
- **Pre-compiled SQL statements** (~40% faster queries)
- **Gzip compression** (60-80% smaller responses)

## 📖 User Guide

For a complete beginner's guide, see **[User Guide](docs/user-guide.md)**.

It covers installation (Docker & local methods), first login, adding students, taking attendance, inviting teachers, and backup/restore.

Additional docs:
- [Documentation Map](docs/documentation-map.md) — Active documentation index
- [Architecture](docs/architecture.md) — System design
- [API Reference](docs/api-reference.md) — Endpoint contracts
- [Operations Runbook](docs/operations.md) — Daily ops + CI triage
- [Troubleshooting](docs/troubleshooting.md) — Common issues

## Quick Indonesian Notes

- Login awal: gunakan akun `admin` dengan password dari `DEFAULT_ADMIN_PASSWORD` di file `.env`.
- Untuk pemakaian sekolah harian: fokus ke Dashboard, Student Roster, Take Attendance, dan Monthly Reports.
- Import Excel memakai `exceljs` dengan guardrails aktif (batas ukuran file/sheet).
- Untuk masalah umum, cek `docs/troubleshooting.md` dulu sebelum eskalasi.

## Prerequisites

- **Bun** (≥ 1.1) — Frontend dependency install + Vite build.
- **Node.js** (≥ 18) — Backend runtime (required for `better-sqlite3` native bindings on Windows).

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/richiesamlie/LocalAttendace-Final.git
cd LocalAttendace-Final
```

### 2. Install Dependencies

```bash
bun install
```

### 3. Configure Environment

Run the setup script to generate `.env` with secure random secrets:

**Windows (PowerShell):**
```powershell
.\setup-env.ps1
```

**Linux / macOS:**
```bash
bash setup-env.sh
```

The script copies `.env.example` → `.env`, generates `JWT_SECRET` (64 chars) and `DEFAULT_ADMIN_PASSWORD` (16 chars), and displays the admin password.

Or create `.env` manually:
```env
JWT_SECRET=your_64_char_hex_secret        # openssl rand -hex 32
DEFAULT_ADMIN_PASSWORD=your_admin_password
# Optional:
# NODE_ENV=production
# DATABASE_URL=postgresql://user:***@localhost:5432/teacher_assistant
# ALLOWED_ORIGINS=http://localhost:3000
# JSON_BODY_LIMIT=100kb
```

### 4. Start the Server

> [!NOTE]
> `better-sqlite3` has native C++ bindings that don't load in Bun on Windows (`ERR_DLOPEN_FAILED`). Node.js is required to run the backend.

Double-click **`start-app.bat`** (Windows) or run **`bash start-app.sh`** (Linux/macOS).

Or manually:

```bash
# Production (local only)
bun run build
NODE_ENV=production npx tsx server.ts

# Production (network — accessible from other devices)
bun run build
NODE_ENV=production npx tsx server.ts --network

# Development (hot reload)
npx tsx server.ts
```

Open `http://127.0.0.1:3000` (or the displayed network IP for network mode).

### 5. First Login

- **Username:** `admin`
- **Password:** The value of `DEFAULT_ADMIN_PASSWORD` in your `.env`

> [!IMPORTANT]
> The app refuses to start if `DEFAULT_ADMIN_PASSWORD` is unset. Change the password after first login via **Admin Dashboard → Settings**.

## Multi-Teacher Setup

### Adding Teachers
1. Log in as admin → Admin Dashboard (shield icon) → **Teachers** tab
2. **Bulk Add** with format `username,Full Name` per line
3. All new teachers get the default password

### Inviting to Classes
1. In a class, click the ⚙️ settings icon → **Invite Teacher to Class**
2. Share the generated code with the teacher
3. They redeem it via **Dashboard → Enter Invite Code** (rate-limited to 10/15min)

### Role Hierarchy

| Role | Scope | Permissions |
|------|-------|-------------|
| **Administrator** | Global | Access any class, register teachers |
| **Owner (Homeroom)** | Class | Full control of their class |
| **Subject Teacher** | Class | Read/write attendance, students, events, invites |
| **Assistant** | Class | Limited helper access |

## Windows Scripts

- **`setup-env.ps1`** — Generate `.env` secrets (run once before first run)
- **`start-app.bat`** — Start server + open browser
- **`setup-windows-startup.bat`** — Auto-start on Windows login

## Building for Production

```bash
bun run build
```

Generates optimized static files in `dist/`.

## Docker Deployment

```bash
# Step 1: Generate .env (one time)
bash setup-env.sh   # or .\setup-env.ps1 on Windows

# Step 2: Build + start
docker-compose up -d
```

Available at `http://localhost:3000`. Container runs as non-root user (UID 1001), drops all Linux capabilities, and is bounded by 512MB RAM / 1 CPU / 100 processes.

> [!NOTE]
> `docker-compose.yml` reads secrets from `.env` via `env_file`. Never hardcode `JWT_SECRET` or `DEFAULT_ADMIN_PASSWORD` in compose files.

### Docker Compose Commands
```bash
bun run docker:up      # Start containers
bun run docker:down    # Stop containers
bun run docker:logs    # View logs
bun run docker:build   # Rebuild image
```

## Database Options

### SQLite (Default)
Local file `database.sqlite`. Override via `DB_FILE=/path/to/database.sqlite`. Docker sets `DB_FILE=/app/data/database.sqlite` for the named volume.

### PostgreSQL (Optional)
```bash
bun run db:setup:postgres   # Create DB, run schema, offer SQLite migration
```

Auto-detected when `DATABASE_URL` is set in `.env`.

## Development Tools

```bash
bun run db:seed       # Sample teachers/students/classes
bun run db:backup     # Create timestamped backup
bun run db:restore    # Restore from backup (creates pre-restore backup)
bun run db:fresh      # Wipe + reinitialize
```

In-app: **Settings → Manual Database Backup** for download, or upload a `.sqlite` file to restore.

## Tech Stack

| Category | Technology |
|----------|-----------|
| **Frontend** | React 19, TypeScript, Vite 6 |
| **Styling** | Tailwind CSS 4 |
| **State** | Zustand 5, React Query 5 |
| **Backend** | Express 4.21, better-sqlite3 12 |
| **Auth** | JWT (access 1h + refresh 7d rotation), bcrypt cost 12 |
| **Validation** | Zod 4 |
| **Security** | Helmet CSP, express-rate-limit, prepared statements |
| **Excel** | exceljs |
| **Realtime** | Socket.IO 4 |
| **Database** | SQLite (default) or PostgreSQL (optional) |
| **Container** | Docker (multi-stage, alpine, non-root) |
| **CI** | GitHub Actions (npm + bun dual-runtime) |

## CI/CD

GitHub Actions runs three workflows on every push to `develop` and `main`:

### `CI` workflow

| Job | develop | main |
|-----|:-------:|:----:|
| TypeScript Check | ✓ | ✓ |
| ESLint (`--max-warnings=0`) | ✓ | ✓ |
| Docs Link Check | ✓ | ✓ |
| Build Verification | ✓ | ✓ |
| **Bun Parity Smoke** (blocking) | ✓ | — |
| **Critical Tests** (develop fast gate) | ✓ | — |
| **Full Test Suite** (main/PR gate) | — | ✓ |
| Test Coverage (main baseline) | — | ✓ |

### `Security Scan` workflow

| Job | develop | main |
|-----|:-------:|:----:|
| npm audit (`--omit=dev --audit-level=high`) | ✓ | ✓ |
| CodeQL Security Analysis | ✓ | ✓ |
| Bun Security Smoke (blocking at high) | ✓ | — |

### `Automated Release` workflow
Runs only on `main` after CI + Security pass. Generates GitHub release artifacts.

`develop` is the blocking/hardening lane; `main` is the stable/production lane. Promotion requires explicit approval and uses `git merge --no-ff` to preserve audit history.

### Local CI Parity

```bash
npm run lint                              # TypeScript check
npm run lint:eslint -- --max-warnings=0   # ESLint blocking gate
npm run test:critical                     # 226 critical tests (fast)
npm test                                  # Full test suite (505 tests)
bun install --frozen-lockfile && bun run lint && bun run lint:eslint -- --max-warnings=0
bun audit --audit-level=high             # Bun security gate
```

## Performance Optimizations

| Optimization | Impact |
|-------------|--------|
| Pre-compiled SQL statements | ~40% faster queries |
| WAL auto-checkpoint | Prevents WAL file bloat |
| 64MB SQLite cache | Faster reads |
| 256MB memory-mapped I/O | Faster disk access |
| Gzip compression | 60-80% smaller responses |
| React Query caching (5min stale, 30min cache) | 70% fewer API calls |
| Debounced search (300ms) | Reduced re-renders |
| Pagination for records/events | Handles 10k+ records |
| Async fs (no sync on request paths) | Event loop never blocked |

## Screenshots

| Dashboard | Student Roster |
|:---------:|:--------------:|
| ![Dashboard](screenshots/dashboard.png) | ![Roster](screenshots/roster.png) |

| Monthly Reports | Visual Seating Chart |
|:---------------:|:--------------------:|
| ![Reports](screenshots/reports.png) | ![Seating](screenshots/seating.png) |

| Smart Group Generator | Random Student Picker |
|:---------------------:|:---------------------:|
| ![Groups](screenshots/groups.png) | ![Random](screenshots/random_picker.png) |

## License

For educational and personal use.
