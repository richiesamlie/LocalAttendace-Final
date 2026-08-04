/**
 * Auto-Migrate: SQLite → PostgreSQL
 *
 * Called once on startup when PostgreSQL is detected.
 * If PostgreSQL is empty and SQLite has data, auto-migrates everything.
 *
 * Usage:
 *   - Automatic: Just set DATABASE_URL and start the app
 *   - Manual: bun run db:migrate:to-postgres
 */

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { getPool } from '../lib/postgres';

const DB_FILE = process.env.DB_FILE || path.join(process.cwd(), 'database.sqlite');

// Tables in FK-respecting order
const TABLES = [
  'teachers',
  'classes',
  'class_teachers',
  'students',
  'attendance_records',
  'daily_notes',
  'events',
  'timetable_slots',
  'seating_layout',
  'admin_settings',
  'invite_codes',
  'user_sessions',
  'refresh_tokens',
];

/**
 * Check if PostgreSQL has any tables
 */
async function isPostgresEmpty(): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
  );
  return parseInt(result.rows[0].count) === 0;
}

/**
 * Read all data from SQLite
 */
function readSQLiteData(sqlitePath: string): Record<string, unknown[]> {
  const db = new Database(sqlitePath, { readonly: true });
  const data: Record<string, unknown[]> = {};

  for (const table of TABLES) {
    try {
      data[table] = db.prepare(`SELECT * FROM ${table}`).all();
    } catch {
      // Table might not exist in older databases
      data[table] = [];
    }
  }

  db.close();
  return data;
}

/**
 * Create PostgreSQL schema (mirrors src/db/schema.ts)
 */
async function createPostgresSchema(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS teachers (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0,
      created_at TEXT DEFAULT NOW()::TEXT,
      last_login TEXT
    );

    CREATE TABLE IF NOT EXISTS classes (
      id TEXT PRIMARY KEY,
      teacher_id TEXT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS class_teachers (
      class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      teacher_id TEXT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'teacher',
      PRIMARY KEY (class_id, teacher_id)
    );

    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      roll_number TEXT NOT NULL,
      parent_name TEXT,
      parent_phone TEXT,
      is_flagged INTEGER DEFAULT 0,
      is_archived INTEGER DEFAULT 0,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS attendance_records (
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      status TEXT NOT NULL,
      reason TEXT,
      updated_at TEXT,
      PRIMARY KEY (student_id, date)
    );

    CREATE TABLE IF NOT EXISTS daily_notes (
      class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      note TEXT NOT NULL,
      updated_at TEXT,
      PRIMARY KEY (class_id, date)
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS timetable_slots (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      day_of_week INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      subject TEXT NOT NULL,
      lesson TEXT NOT NULL,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS seating_layout (
      class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      seat_id TEXT NOT NULL,
      student_id TEXT,
      updated_at TEXT,
      PRIMARY KEY (class_id, seat_id)
    );

    CREATE TABLE IF NOT EXISTS admin_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invite_codes (
      code TEXT PRIMARY KEY,
      class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'teacher',
      created_by TEXT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
      created_at TEXT DEFAULT NOW()::TEXT,
      expires_at TEXT NOT NULL,
      used_by TEXT REFERENCES teachers(id) ON DELETE SET NULL,
      used_at TEXT
    );

    CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY,
      teacher_id TEXT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
      device_name TEXT,
      ip_address TEXT,
      created_at TEXT DEFAULT NOW()::TEXT,
      last_active TEXT DEFAULT NOW()::TEXT,
      expires_at TEXT NOT NULL,
      is_revoked INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      teacher_id TEXT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
      session_id TEXT NOT NULL REFERENCES user_sessions(id) ON DELETE CASCADE,
      created_at TEXT DEFAULT NOW()::TEXT,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      rotated_to TEXT
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_teachers_username ON teachers(username);
    CREATE INDEX IF NOT EXISTS idx_classes_teacher ON classes(teacher_id);
    CREATE INDEX IF NOT EXISTS idx_class_teachers_class ON class_teachers(class_id);
    CREATE INDEX IF NOT EXISTS idx_class_teachers_teacher ON class_teachers(teacher_id);
    CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
    CREATE INDEX IF NOT EXISTS idx_students_class_archived ON students(class_id, is_archived);
    CREATE INDEX IF NOT EXISTS idx_records_class ON attendance_records(class_id);
    CREATE INDEX IF NOT EXISTS idx_records_date ON attendance_records(date);
    CREATE INDEX IF NOT EXISTS idx_records_class_date ON attendance_records(class_id, date);
    CREATE INDEX IF NOT EXISTS idx_records_class_date_status ON attendance_records(class_id, date, status);
    CREATE INDEX IF NOT EXISTS idx_daily_notes_class ON daily_notes(class_id);
    CREATE INDEX IF NOT EXISTS idx_daily_notes_date ON daily_notes(date);
    CREATE INDEX IF NOT EXISTS idx_events_class ON events(class_id);
    CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
    CREATE INDEX IF NOT EXISTS idx_events_class_date_type ON events(class_id, date, type);
    CREATE INDEX IF NOT EXISTS idx_timetable_class_day ON timetable_slots(class_id, day_of_week);
    CREATE INDEX IF NOT EXISTS idx_seating_class ON seating_layout(class_id);
    CREATE INDEX IF NOT EXISTS idx_invite_codes_class ON invite_codes(class_id);
    CREATE INDEX IF NOT EXISTS idx_invite_codes_class_active ON invite_codes(class_id, expires_at, used_by);
    CREATE INDEX IF NOT EXISTS idx_user_sessions_teacher ON user_sessions(teacher_id);
    CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_user_sessions_teacher_active ON user_sessions(teacher_id, is_revoked, expires_at);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family ON refresh_tokens(family_id);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_teacher ON refresh_tokens(teacher_id);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);
  `);
}

/**
 * Insert a batch of rows into a PostgreSQL table
 */
async function insertBatch(
  client: import('pg').PoolClient,
  table: string,
  rows: Record<string, unknown>[],
  batchSize = 500
): Promise<number> {
  if (rows.length === 0) return 0;

  const columns = Object.keys(rows[0]);
  let inserted = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const values: unknown[] = [];
    const placeholders: string[] = [];

    for (let j = 0; j < batch.length; j++) {
      const row = batch[j];
      const rowPlaceholders = columns.map((_, colIdx) => `$${j * columns.length + colIdx + 1}`);
      placeholders.push(`(${rowPlaceholders.join(', ')})`);
      for (const col of columns) {
        values.push(row[col] ?? null);
      }
    }

    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${placeholders.join(', ')} ON CONFLICT DO NOTHING`;
    const result = await client.query(sql, values);
    inserted += result.rowCount || 0;
  }

  return inserted;
}

/**
 * Migrate all data from SQLite to PostgreSQL
 */
async function migrateData(data: Record<string, unknown[]>): Promise<Record<string, number>> {
  const pool = getPool();
  const client = await pool.connect();
  const counts: Record<string, number> = {};

  try {
    await client.query('BEGIN');

    // Disable triggers for faster insert (re-enable after)
    for (const table of TABLES) {
      await client.query(`ALTER TABLE ${table} DISABLE TRIGGER ALL`);
    }

    for (const table of TABLES) {
      const rows = data[table] || [];
      counts[table] = await insertBatch(client, table, rows as Record<string, unknown>[]);
      console.log(`  ✓ ${table}: ${counts[table]}/${rows.length} rows`);
    }

    // Re-enable triggers
    for (const table of TABLES) {
      await client.query(`ALTER TABLE ${table} ENABLE TRIGGER ALL`);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return counts;
}

/**
 * Validate migration by comparing row counts
 */
async function validateMigration(sqlitePath: string): Promise<boolean> {
  const db = new Database(sqlitePath, { readonly: true });
  const pool = getPool();
  let allMatch = true;

  console.log('\nValidation:');

  for (const table of TABLES) {
    try {
      const sqliteCount = (db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number }).count;
      const pgResult = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
      const pgCount = parseInt(pgResult.rows[0].count);

      const match = sqliteCount === pgCount;
      console.log(`  ${match ? '✅' : '❌'} ${table}: SQLite=${sqliteCount}, PostgreSQL=${pgCount}`);

      if (!match) allMatch = false;
    } catch {
      console.log(`  ⚠️  ${table}: skipped (not in SQLite)`);
    }
  }

  db.close();
  return allMatch;
}

/**
 * Main auto-migration function
 * Called on startup when PostgreSQL is detected
 */
export async function autoMigrateIfNeeded(): Promise<boolean> {
  // 1. Check if SQLite file exists
  if (!fs.existsSync(DB_FILE)) {
    console.log('[migrate] No existing SQLite database found, starting fresh on PostgreSQL');
    return false;
  }

  // 2. Check if PostgreSQL is empty
  const empty = await isPostgresEmpty();
  if (!empty) {
    console.log('[migrate] PostgreSQL already has tables, skipping auto-migration');
    return false;
  }

  // 3. Check if SQLite has data
  const db = new Database(DB_FILE, { readonly: true });
  let totalRows = 0;
  for (const table of TABLES) {
    try {
      const count = (db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number }).count;
      totalRows += count;
    } catch {
      // Table doesn't exist
    }
  }
  db.close();

  if (totalRows === 0) {
    console.log('[migrate] SQLite database is empty, starting fresh on PostgreSQL');
    return false;
  }

  // 4. Auto-migrate!
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  Auto-Migrating SQLite → PostgreSQL                    ║');
  console.log('║  Found existing data, migrating automatically...       ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');

  console.log('Creating PostgreSQL schema...');
  await createPostgresSchema();

  console.log('Reading SQLite data...');
  const data = readSQLiteData(DB_FILE);

  console.log('Migrating data...');
  await migrateData(data);

  console.log('\nValidating...');
  const valid = await validateMigration(DB_FILE);

  if (valid) {
    console.log('\n✅ Auto-migration complete! PostgreSQL is ready.');
    console.log('   (SQLite database preserved at ' + DB_FILE + ')');
  } else {
    console.log('\n⚠️  Migration completed with count mismatches.');
    console.log('   Run `bun run db:migrate:to-postgres --validate-only` to investigate.');
  }

  return true;
}

/**
 * Standalone migration (for CLI usage)
 */
export async function migrateStandalone(options: {
  sqlitePath?: string;
  pgUrl?: string;
  dryRun?: boolean;
  validateOnly?: boolean;
  force?: boolean;
} = {}): Promise<void> {
  const sqlitePath = options.sqlitePath || DB_FILE;

  // Validate SQLite exists
  if (!fs.existsSync(sqlitePath)) {
    console.error(`❌ SQLite database not found: ${sqlitePath}`);
    process.exit(1);
  }

  // If validate-only, just validate and exit
  if (options.validateOnly) {
    const valid = await validateMigration(sqlitePath);
    process.exit(valid ? 0 : 1);
  }

  // Check if PostgreSQL is empty (unless --force)
  if (!options.force) {
    const empty = await isPostgresEmpty();
    if (!empty) {
      console.error('❌ PostgreSQL is not empty. Use --force to migrate anyway.');
      process.exit(1);
    }
  }

  // Dry run
  if (options.dryRun) {
    console.log('DRY RUN — showing what would be migrated:\n');
    const data = readSQLiteData(sqlitePath);
    for (const table of TABLES) {
      const rows = data[table] || [];
      console.log(`  ${table}: ${rows.length} rows`);
    }
    console.log('\nDry run complete. No changes made.');
    return;
  }

  // Run migration
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  SQLite → PostgreSQL Migration                         ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');

  console.log(`SQLite: ${sqlitePath}`);
  console.log(`PostgreSQL: ${process.env.DATABASE_URL || '(default)'}`);
  console.log('');

  console.log('Creating PostgreSQL schema...');
  await createPostgresSchema();

  console.log('Reading SQLite data...');
  const data = readSQLiteData(sqlitePath);

  console.log('Migrating data...');
  await migrateData(data);

  console.log('\nValidating...');
  const valid = await validateMigration(sqlitePath);

  console.log('');
  if (valid) {
    console.log('✅ Migration complete!');
    console.log('   (SQLite database preserved at ' + sqlitePath + ')');
  } else {
    console.log('⚠️  Migration completed with count mismatches.');
    console.log('   Run with --validate-only to investigate.');
    process.exit(1);
  }
}
