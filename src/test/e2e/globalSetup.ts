import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import path from 'path';
import fs from 'fs';

const DB_FILE = path.join(process.cwd(), 'database.sqlite');

/**
 * Global setup for Playwright E2E tests.
 * Resets the database to a known clean state before the test suite runs.
 * This prevents state bleed between test files when running the full suite.
 */
export default function globalSetup() {
  // Delete existing database files to start fresh
  for (const file of [DB_FILE, `${DB_FILE}-wal`, `${DB_FILE}-shm`]) {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  }

  const db = new Database(DB_FILE);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');

  // Create schema (same as db.ts initSchema, minimal for tests)
  db.exec(`
    CREATE TABLE IF NOT EXISTS teachers (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_login TEXT
    );

    CREATE TABLE IF NOT EXISTS classes (
      id TEXT PRIMARY KEY,
      teacher_id TEXT NOT NULL,
      name TEXT NOT NULL,
      updated_at TEXT,
      FOREIGN KEY (teacher_id) REFERENCES teachers (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL,
      name TEXT NOT NULL,
      roll_number TEXT NOT NULL,
      parent_name TEXT,
      parent_phone TEXT,
      is_flagged INTEGER DEFAULT 0,
      is_archived INTEGER DEFAULT 0,
      updated_at TEXT,
      FOREIGN KEY (class_id) REFERENCES classes (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS attendance_records (
      student_id TEXT NOT NULL,
      class_id TEXT NOT NULL,
      date TEXT NOT NULL,
      status TEXT NOT NULL,
      reason TEXT,
      updated_at TEXT,
      PRIMARY KEY (student_id, date),
      FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE,
      FOREIGN KEY (class_id) REFERENCES classes (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS daily_notes (
      class_id TEXT NOT NULL,
      date TEXT NOT NULL,
      note TEXT NOT NULL,
      PRIMARY KEY (class_id, date),
      FOREIGN KEY (class_id) REFERENCES classes (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL,
      date TEXT NOT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      updated_at TEXT,
      FOREIGN KEY (class_id) REFERENCES classes (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS timetable_slots (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL,
      day_of_week INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      subject TEXT NOT NULL,
      lesson TEXT NOT NULL,
      updated_at TEXT,
      FOREIGN KEY (class_id) REFERENCES classes (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS seating_layout (
      class_id TEXT NOT NULL,
      seat_id TEXT NOT NULL,
      student_id TEXT,
      PRIMARY KEY (class_id, seat_id),
      FOREIGN KEY (class_id) REFERENCES classes (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS admin_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS class_teachers (
      class_id TEXT NOT NULL,
      teacher_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'teacher',
      PRIMARY KEY (class_id, teacher_id),
      FOREIGN KEY (class_id) REFERENCES classes (id) ON DELETE CASCADE,
      FOREIGN KEY (teacher_id) REFERENCES teachers (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS invite_codes (
      code TEXT PRIMARY KEY,
      class_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'teacher',
      created_by TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT NOT NULL,
      used_by TEXT,
      used_at TEXT,
      FOREIGN KEY (class_id) REFERENCES classes (id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES teachers (id) ON DELETE CASCADE,
      FOREIGN KEY (used_by) REFERENCES teachers (id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY,
      teacher_id TEXT NOT NULL,
      device_name TEXT,
      ip_address TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_active TEXT DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT NOT NULL,
      is_revoked INTEGER DEFAULT 0,
      FOREIGN KEY (teacher_id) REFERENCES teachers (id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_teachers_username ON teachers(username);
    CREATE INDEX IF NOT EXISTS idx_classes_teacher ON classes(teacher_id);
    CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
    CREATE INDEX IF NOT EXISTS idx_records_class_date ON attendance_records(class_id, date);
    CREATE INDEX IF NOT EXISTS idx_events_class_date ON events(class_id, date);
    CREATE INDEX IF NOT EXISTS idx_timetable_class ON timetable_slots(class_id);
    CREATE INDEX IF NOT EXISTS idx_seating_class ON seating_layout(class_id);
    CREATE INDEX IF NOT EXISTS idx_students_class_archived ON students(class_id, is_archived);
    CREATE INDEX IF NOT EXISTS idx_records_class_date_status ON attendance_records(class_id, date, status);
    CREATE INDEX IF NOT EXISTS idx_events_class_date_type ON events(class_id, date, type);
    CREATE INDEX IF NOT EXISTS idx_timetable_class_day ON timetable_slots(class_id, day_of_week);
    CREATE INDEX IF NOT EXISTS idx_invite_codes_class_active ON invite_codes(class_id, expires_at, used_by);
    CREATE INDEX IF NOT EXISTS idx_user_sessions_teacher_active ON user_sessions(teacher_id, is_revoked, expires_at);
  `);

  // Create default admin teacher (password: teacher123) - also global admin
  const hash = bcrypt.hashSync('teacher123', 10);
  db.prepare('INSERT INTO teachers (id, username, password_hash, name, is_admin) VALUES (?, ?, ?, ?, 1)').run(
    'teacher_default', 'admin', hash, 'Administrator'
  );

  // Create a default class for tests
  db.prepare('INSERT INTO classes (id, teacher_id, name) VALUES (?, ?, ?)').run(
    'class_1', 'teacher_default', 'Grade 5A'
  );

  db.prepare('INSERT INTO class_teachers (class_id, teacher_id, role) VALUES (?, ?, ?)').run(
    'class_1', 'teacher_default', 'owner'
  );

  // Seed students for roster/attendance/etc tests
  const students = [
    { id: 's1', name: 'Alice Johnson', roll: '1' },
    { id: 's2', name: 'Bob Smith', roll: '2' },
    { id: 's3', name: 'Charlie Davis', roll: '3' },
    { id: 's4', name: 'Diana Lee', roll: '4' },
    { id: 's5', name: 'Edward Kim', roll: '5' },
  ];
  for (const s of students) {
    db.prepare('INSERT INTO students (id, class_id, name, roll_number) VALUES (?, ?, ?, ?)').run(
      s.id, 'class_1', s.name, s.roll
    );
  }

  // Seed timetable slots for timetable page
  const todayDay = new Date().getDay(); // 0=Sun, 1=Mon, ...
  const weekday = todayDay === 0 || todayDay === 6 ? 1 : todayDay; // fallback to Monday on weekend
  db.prepare('INSERT INTO timetable_slots (id, class_id, day_of_week, start_time, end_time, subject, lesson) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    'tt1', 'class_1', weekday, '09:00', '10:00', 'Math', 'Algebra'
  );
  db.prepare('INSERT INTO timetable_slots (id, class_id, day_of_week, start_time, end_time, subject, lesson) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    'tt2', 'class_1', weekday, '10:00', '11:00', 'English', 'Reading'
  );

  // Seed today's attendance (status=absent) so attendance page has data
  const today = new Date().toISOString().slice(0, 10);
  for (const s of students) {
    db.prepare('INSERT INTO attendance_records (student_id, class_id, date, status) VALUES (?, ?, ?, ?)').run(
      s.id, 'class_1', today, 'absent'
    );
  }

  db.close();
}
