import Database from 'better-sqlite3';
import { pool, query } from './postgres';
import path from 'path';
import fs from 'fs';

const DB_FILE = path.join(process.cwd(), 'data', 'database.sqlite');

async function migrate() {
  console.log('[migrate] Starting SQLite to PostgreSQL migration...\n');

  if (!fs.existsSync(DB_FILE)) {
    console.error(`[migrate] SQLite database not found at ${DB_FILE}`);
    process.exit(1);
  }

  const sqlite = new Database(DB_FILE, { readonly: true });

  console.log('[migrate] Reading SQLite data...\n');

  try {
    await query('BEGIN');

    console.log('[migrate] Migrating teachers...');
    const teachers = sqlite.prepare('SELECT * FROM teachers').all() as {
      id: string;
      username: string;
      password_hash: string;
      name: string;
      created_at: string;
      last_login?: string;
    }[];
    for (const t of teachers) {
      await query(
        `INSERT INTO teachers (id, username, password_hash, name, created_at, last_login)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING`,
        [t.id, t.username, t.password_hash, t.name, t.created_at, t.last_login || null]
      );
    }
    console.log(`  → ${teachers.length} teachers`);

    console.log('[migrate] Migrating classes...');
    const classes = sqlite.prepare('SELECT * FROM classes').all() as {
      id: string;
      teacher_id: string;
      name: string;
      updated_at?: string;
    }[];
    for (const c of classes) {
      const owner = sqlite.prepare('SELECT name FROM teachers WHERE id = ?').get(c.teacher_id) as { name: string } | undefined;
      await query(
        `INSERT INTO classes (id, teacher_id, name, updated_at, owner_name)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO NOTHING`,
        [c.id, c.teacher_id, c.name, c.updated_at || null, owner?.name || 'Administrator']
      );
    }
    console.log(`  → ${classes.length} classes`);

    console.log('[migrate] Migrating class_teachers...');
    const classTeachers = sqlite.prepare('SELECT * FROM class_teachers').all() as {
      class_id: string;
      teacher_id: string;
      role: string;
    }[];
    for (const ct of classTeachers) {
      await query(
        `INSERT INTO class_teachers (class_id, teacher_id, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (class_id, teacher_id) DO NOTHING`,
        [ct.class_id, ct.teacher_id, ct.role || 'teacher']
      );
    }
    console.log(`  → ${classTeachers.length} class_teachers`);

    console.log('[migrate] Migrating students...');
    const students = sqlite.prepare('SELECT * FROM students').all() as {
      id: string;
      class_id: string;
      name: string;
      roll_number: string;
      parent_name?: string;
      parent_phone?: string;
      is_flagged?: number;
      is_archived?: number;
      updated_at?: string;
    }[];
    for (const s of students) {
      await query(
        `INSERT INTO students (id, class_id, name, roll_number, parent_name, parent_phone, is_flagged, is_archived, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO NOTHING`,
        [s.id, s.class_id, s.name, s.roll_number, s.parent_name || null, s.parent_phone || null, !!s.is_flagged, !!s.is_archived, s.updated_at || null]
      );
    }
    console.log(`  → ${students.length} students`);

    console.log('[migrate] Migrating attendance_records...');
    const records = sqlite.prepare('SELECT * FROM attendance_records').all() as {
      student_id: string;
      date: string;
      status: string;
      reason?: string;
      updated_at?: string;
    }[];
    for (const r of records) {
      await query(
        `INSERT INTO attendance_records (student_id, date, status, reason, updated_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (student_id, date) DO NOTHING`,
        [r.student_id, r.date, r.status, r.reason || null, r.updated_at || null]
      );
    }
    console.log(`  → ${records.length} records`);

    console.log('[migrate] Migrating daily_notes...');
    const notes = sqlite.prepare('SELECT * FROM daily_notes').all() as {
      class_id: string;
      date: string;
      note: string;
      updated_at?: string;
    }[];
    for (const n of notes) {
      await query(
        `INSERT INTO daily_notes (class_id, date, note, updated_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (class_id, date) DO NOTHING`,
        [n.class_id, n.date, n.note, n.updated_at || null]
      );
    }
    console.log(`  → ${notes.length} daily_notes`);

    console.log('[migrate] Migrating events...');
    const events = sqlite.prepare('SELECT * FROM events').all() as {
      id: string;
      class_id: string;
      date: string;
      title: string;
      type: string;
      description?: string;
      updated_at?: string;
    }[];
    for (const e of events) {
      await query(
        `INSERT INTO events (id, class_id, date, title, type, description, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [e.id, e.class_id, e.date, e.title, e.type, e.description || null, e.updated_at || null]
      );
    }
    console.log(`  → ${events.length} events`);

    console.log('[migrate] Migrating timetable_slots...');
    const slots = sqlite.prepare('SELECT * FROM timetable_slots').all() as {
      id: string;
      class_id: string;
      day_of_week: number;
      start_time: string;
      end_time: string;
      subject: string;
      lesson: string;
      updated_at?: string;
    }[];
    for (const s of slots) {
      await query(
        `INSERT INTO timetable_slots (id, class_id, day_of_week, start_time, end_time, subject, lesson, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING`,
        [s.id, s.class_id, s.day_of_week, s.start_time, s.end_time, s.subject, s.lesson, s.updated_at || null]
      );
    }
    console.log(`  → ${slots.length} timetable_slots`);

    console.log('[migrate] Migrating seating_layout...');
    const seating = sqlite.prepare('SELECT * FROM seating_layout').all() as {
      class_id: string;
      seat_id: string;
      student_id: string | null;
      updated_at?: string;
    }[];
    for (const s of seating) {
      await query(
        `INSERT INTO seating_layout (class_id, seat_id, student_id, updated_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (class_id, seat_id) DO NOTHING`,
        [s.class_id, s.seat_id, s.student_id, s.updated_at || null]
      );
    }
    console.log(`  → ${seating.length} seating_layout`);

    console.log('[migrate] Migrating admin_settings...');
    const settings = sqlite.prepare('SELECT * FROM admin_settings').all() as {
      key: string;
      value: string;
    }[];
    for (const s of settings) {
      await query(
        `INSERT INTO admin_settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [s.key, s.value]
      );
    }
    console.log(`  → ${settings.length} admin_settings`);

    console.log('[migrate] Migrating invite_codes...');
    const invites = sqlite.prepare('SELECT * FROM invite_codes').all() as {
      code: string;
      class_id: string;
      role: string;
      created_by: string;
      created_at: string;
      expires_at: string | null;
      used_by: string | null;
      used_at: string | null;
    }[];
    for (const i of invites) {
      await query(
        `INSERT INTO invite_codes (code, class_id, role, created_by, created_at, expires_at, used_by, used_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (code) DO NOTHING`,
        [i.code, i.class_id, i.role || 'teacher', i.created_by, i.created_at, i.expires_at, i.used_by, i.used_at]
      );
    }
    console.log(`  → ${invites.length} invite_codes`);

    console.log('[migrate] Migrating user_sessions...');
    const sessions = sqlite.prepare('SELECT * FROM user_sessions').all() as {
      id: string;
      teacher_id: string;
      device_name: string | null;
      ip_address: string | null;
      created_at: string;
      last_active: string;
      expires_at: string;
      is_revoked: number;
    }[];
    for (const s of sessions) {
      await query(
        `INSERT INTO user_sessions (id, teacher_id, device_name, ip_address, created_at, last_active, expires_at, is_revoked)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING`,
        [s.id, s.teacher_id, s.device_name, s.ip_address, s.created_at, s.last_active, s.expires_at, !!s.is_revoked]
      );
    }
    console.log(`  → ${sessions.length} user_sessions`);

    await query('COMMIT');
    console.log('\n[migrate] ✅ Migration completed successfully!');

    const pgTeachers = await query<{ count: number }>('SELECT COUNT(*) as count FROM teachers');
    const pgClasses = await query<{ count: number }>('SELECT COUNT(*) as count FROM classes');
    const pgStudents = await query<{ count: number }>('SELECT COUNT(*) as count FROM students');
    console.log(`\n[migrate] Verification:`);
    console.log(`  - Teachers: ${pgTeachers[0].count}`);
    console.log(`  - Classes: ${pgClasses[0].count}`);
    console.log(`  - Students: ${pgStudents[0].count}`);

  } catch (err) {
    await query('ROLLBACK');
    console.error('[migrate] ❌ Migration failed:', (err as Error).message);
    process.exit(1);
  } finally {
    sqlite.close();
    await pool.end();
  }
}

migrate();