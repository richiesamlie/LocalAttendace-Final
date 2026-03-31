import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import path from 'path';

const DB_FILE = path.join(process.cwd(), 'database.sqlite');

let _db = new Database(DB_FILE);

// Enable foreign keys
_db.pragma('foreign_keys = ON');

// Enable WAL mode for better concurrent performance
_db.pragma('journal_mode = WAL');

const initSchema = () => {
  _db.exec(`
    CREATE TABLE IF NOT EXISTS teachers (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS classes (
      id TEXT PRIMARY KEY,
      teacher_id TEXT NOT NULL,
      name TEXT NOT NULL,
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
      FOREIGN KEY (class_id) REFERENCES classes (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS attendance_records (
      student_id TEXT NOT NULL,
      class_id TEXT NOT NULL,
      date TEXT NOT NULL,
      status TEXT NOT NULL,
      reason TEXT,
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

    CREATE INDEX IF NOT EXISTS idx_teachers_username ON teachers(username);
    CREATE INDEX IF NOT EXISTS idx_classes_teacher ON classes(teacher_id);
    CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
    CREATE INDEX IF NOT EXISTS idx_records_class ON attendance_records(class_id);
    CREATE INDEX IF NOT EXISTS idx_records_date ON attendance_records(date);
    CREATE INDEX IF NOT EXISTS idx_records_class_date ON attendance_records(class_id, date);
    CREATE INDEX IF NOT EXISTS idx_daily_notes_class ON daily_notes(class_id);
    CREATE INDEX IF NOT EXISTS idx_daily_notes_date ON daily_notes(date);
    CREATE INDEX IF NOT EXISTS idx_events_class ON events(class_id);
    CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
    CREATE INDEX IF NOT EXISTS idx_seating_class ON seating_layout(class_id);
  `);

  // Migration: Add is_archived to students if not exists
  const studentsInfo = _db.pragma('table_info(students)') as Array<{ name: string }>;
  const hasArchivedColumn = studentsInfo.some(col => col.name === 'is_archived');
  if (!hasArchivedColumn) {
    _db.exec('ALTER TABLE students ADD COLUMN is_archived INTEGER DEFAULT 0');
  }

  // Migration: Add teacher_id to classes if not exists (legacy support)
  const classesInfo = _db.pragma('table_info(classes)') as Array<{ name: string }>;
  const hasTeacherId = classesInfo.some(col => col.name === 'teacher_id');
  if (!hasTeacherId) {
    // Create default teacher for existing data
    const existingTeachers = _db.prepare('SELECT COUNT(*) as count FROM teachers').get() as { count: number };
    let defaultTeacherId = 'teacher_default';
    if (existingTeachers.count === 0) {
      const hash = bcrypt.hashSync('teacher123', 10);
      _db.prepare('INSERT INTO teachers (id, username, password_hash, name) VALUES (?, ?, ?, ?)').run(
        defaultTeacherId, 'admin', hash, 'Administrator'
      );
    } else {
      const teacher = _db.prepare('SELECT id FROM teachers LIMIT 1').get() as { id: string };
      defaultTeacherId = teacher?.id || defaultTeacherId;
    }
    // Add teacher_id column
    _db.exec('ALTER TABLE classes ADD COLUMN teacher_id TEXT');
    _db.exec(`UPDATE classes SET teacher_id = '${defaultTeacherId}'`);
    _db.exec('CREATE INDEX IF NOT EXISTS idx_classes_teacher ON classes(teacher_id)');
  }

  // Ensure default admin teacher always exists
  const teacherCount = _db.prepare('SELECT COUNT(*) as count FROM teachers').get() as { count: number };
  if (teacherCount.count === 0) {
    const hash = bcrypt.hashSync('teacher123', 10);
    _db.prepare('INSERT INTO teachers (id, username, password_hash, name) VALUES (?, ?, ?, ?)').run(
      'teacher_default', 'admin', hash, 'Administrator'
    );
    
    // Update classes to use this teacher
    _db.exec("UPDATE classes SET teacher_id = 'teacher_default' WHERE teacher_id IS NULL");
  }
};
initSchema();

import fs from 'fs';

const dbProxy = new Proxy({}, {
  get(target, prop) {
    if (prop === 'restore') {
      return (buffer: Buffer) => {
        try { _db.close(); } catch(e) {}
        fs.writeFileSync(DB_FILE, buffer);
        _db = new Database(DB_FILE);
        _db.pragma('foreign_keys = ON');
        _db.pragma('journal_mode = WAL');
        initSchema(); // Ensure the restored DB has the correct schema
      };
    }
    const val = (_db as any)[prop];
    if (typeof val === 'function') {
      return val.bind(_db);
    }
    return val;
  }
}) as Database.Database & { restore: (buf: Buffer) => void };

export default dbProxy;
