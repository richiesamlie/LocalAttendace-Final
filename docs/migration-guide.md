# SQLite → PostgreSQL Migration Guide

**Last Updated:** 2026-08-04

---

## Overview

The app uses **SQLite** by default. You can switch to **PostgreSQL** anytime without losing data. The migration is automatic — just set one environment variable and start the app.

| Feature | SQLite | PostgreSQL |
|---------|--------|------------|
| Setup | None needed | Requires installation |
| Multi-user | Single user | Multiple users |
| Performance | Good for small teams | Better for large datasets |
| Production | Works | Recommended |

---

## Prerequisites

- **PostgreSQL** installed and running
- **Existing app** with SQLite data (or starting fresh)

### Install PostgreSQL

**Windows:**
1. Download from: https://www.postgresql.org/download/windows/
2. Run installer
3. Remember the password you set for user `postgres`

**macOS:**
```bash
brew install postgresql
brew services start postgresql
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
```

---

## Migration Methods

### Method 1: Auto-Migrate on Startup (Recommended)

This is the easiest method. The app handles everything automatically.

**Step 1: Create the database**

Open a terminal and run:
```bash
createdb teacher_assistant
```

If `createdb` is not found, use the full path:
```bash
# Windows (default install)
"C:\Program Files\PostgreSQL\17\bin\createdb.exe" -U postgres teacher_assistant

# macOS/Linux
/usr/local/bin/createdb -U postgres teacher_assistant
```

**Step 2: Add DATABASE_URL to `.env`**

Open your `.env` file and add this line:
```env
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/teacher_assistant
```

Replace `your_password` with the password you set during PostgreSQL installation.

**Step 3: Start the app normally**

```bash
bun run dev
```

**Done!** The app will:
1. Detect PostgreSQL connection
2. Check if PostgreSQL is empty
3. Find your existing SQLite data
4. Auto-migrate everything
5. Continue running on PostgreSQL

You'll see output like this:
```
[db] PostgreSQL connected successfully - using PostgreSQL

╔══════════════════════════════════════════════════════════╗
║  Auto-Migrating SQLite → PostgreSQL                    ║
║  Found existing data, migrating automatically...       ║
╚══════════════════════════════════════════════════════════╝

Creating PostgreSQL schema...
Reading SQLite data...
Migrating data...
  ✓ teachers: 1/1 rows
  ✓ classes: 3/3 rows
  ✓ class_teachers: 3/3 rows
  ✓ students: 45/45 rows
  ✓ attendance_records: 520/520 rows
  ✓ daily_notes: 12/12 rows
  ✓ events: 8/8 rows
  ✓ timetable_slots: 25/25 rows
  ✓ seating_layout: 30/30 rows
  ✓ admin_settings: 5/5 rows
  ✓ invite_codes: 2/2 rows
  ✓ user_sessions: 1/1 rows
  ✓ refresh_tokens: 1/1 rows

Validating:
  ✅ teachers: SQLite=1, PostgreSQL=1
  ✅ classes: SQLite=3, PostgreSQL=3
  ✅ students: SQLite=45, PostgreSQL=45
  ...

✅ Auto-migration complete! PostgreSQL is ready.
   (SQLite database preserved at database.sqlite)
```

---

### Method 2: Explicit Migration Script

If you prefer to migrate before starting the app:

**Step 1: Create the database**
```bash
createdb teacher_assistant
```

**Step 2: Set DATABASE_URL in `.env`**
```env
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/teacher_assistant
```

**Step 3: Run the migration script**
```bash
bun run db:migrate:to-postgres
```

**Step 4: Start the app**
```bash
bun run dev
```

---

### Method 3: Fresh Install (No Existing Data)

If you're starting fresh with no SQLite data:

**Step 1: Install PostgreSQL and create database**
```bash
createdb teacher_assistant
```

**Step 2: Set DATABASE_URL in `.env`**
```env
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/teacher_assistant
```

**Step 3: Start the app**
```bash
bun run dev
```

The app creates the schema automatically on first startup.

---

## Migration Script Options

```bash
# Full migration
bun run db:migrate:to-postgres

# Preview what would be migrated (no changes)
bun run db:migrate:to-postgres -- --dry-run

# Validate an existing migration (check row counts)
bun run db:migrate:to-postgres -- --validate-only

# Migrate even if PostgreSQL already has tables
bun run db:migrate:to-postgres -- --force

# Use a different SQLite file
bun run db:migrate:to-postgres -- --sqlite-path ./backup.sqlite

# Show help
bun run db:migrate:to-postgres -- --help
```

---

## Switching Back to SQLite

Your SQLite data is preserved after migration. To switch back:

**Step 1: Edit `.env`**

Remove or comment out the DATABASE_URL line:
```env
# DATABASE_URL=postgresql://postgres:your_password@localhost:5432/teacher_assistant
```

**Step 2: Restart the app**
```bash
bun run dev
```

The app uses SQLite again with your original data.

---

## Troubleshooting

### "DATABASE_URL not set"
**Problem:** Migration script can't find the database URL.
**Fix:** Add `DATABASE_URL=postgresql://...` to your `.env` file.

### "PostgreSQL connection failed"
**Problem:** Can't connect to PostgreSQL.
**Fix:**
1. Check PostgreSQL is running: `pg_isready`
2. Verify credentials in DATABASE_URL
3. Check if the database exists: `psql -U postgres -l`

### "database teacher_assistant does not exist"
**Problem:** The database hasn't been created yet.
**Fix:** Run `createdb teacher_assistant` first.

### "permission denied for database"
**Problem:** The user doesn't have permission to create tables.
**Fix:** Grant permissions: `psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE teacher_assistant TO your_user;"`

### "PostgreSQL is not empty"
**Problem:** PostgreSQL already has tables (from a previous migration).
**Fix:** Use `--force` flag: `bun run db:migrate:to-postgres -- --force`

### Migration shows count mismatches
**Problem:** Some rows didn't migrate.
**Fix:**
1. Run validation: `bun run db:migrate:to-postgres -- --validate-only`
2. Check PostgreSQL logs for errors
3. Try with `--force` to re-migrate

### App starts but shows old data
**Problem:** App is still using SQLite.
**Fix:** Check that DATABASE_URL is set correctly in `.env` and restart the app.

---

## What Gets Migrated

All 13 tables are migrated in the correct order:

| Table | Description |
|-------|-------------|
| `teachers` | Teacher accounts and passwords |
| `classes` | Class metadata |
| `class_teachers` | Teacher-class relationships |
| `students` | Student records |
| `attendance_records` | Daily attendance |
| `daily_notes` | Daily notes per class |
| `events` | Calendar events |
| `timetable_slots` | Weekly schedule |
| `seating_layout` | Seating charts |
| `admin_settings` | App settings |
| `invite_codes` | Invite codes |
| `user_sessions` | Active sessions |
| `refresh_tokens` | Auth tokens |

All indexes (20+) and data relationships are preserved.

---

## Safety Features

| Feature | Description |
|---------|-------------|
| **Atomic migration** | All-or-nothing transaction — no partial state |
| **Row count validation** | Compares SQLite vs PostgreSQL after migration |
| **SQLite preserved** | Original database file is never deleted |
| **Auto-detection** | Skips migration if PostgreSQL already has data |
| **Dry run** | Preview without making changes |
| **Rollback** | Just remove DATABASE_URL to switch back |

---

## Quick Reference

```bash
# Check PostgreSQL status
pg_isready

# List databases
psql -U postgres -l

# Connect to database
psql -U postgres -d teacher_assistant

# Check table row counts
psql -U postgres -d teacher_assistant -c "SELECT COUNT(*) FROM teachers;"
psql -U postgres -d teacher_assistant -c "SELECT COUNT(*) FROM students;"
```

---

## See Also

- [User Guide](user-guide.md) — App usage instructions
- [Troubleshooting](troubleshooting.md) — Common issues and fixes
- [Operations Runbook](operations.md) — CI/CD and operations
