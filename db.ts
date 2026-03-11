import Database from 'better-sqlite3';
import path from 'path';

const DB_FILE = path.join(process.cwd(), 'database.sqlite');

const db = new Database(DB_FILE);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS classes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
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

  -- Performance Optimization: Create Indexes for frequently queried foreign keys
  CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
  CREATE INDEX IF NOT EXISTS idx_records_class ON attendance_records(class_id);
  CREATE INDEX IF NOT EXISTS idx_daily_notes_class ON daily_notes(class_id);
  CREATE INDEX IF NOT EXISTS idx_events_class ON events(class_id);
  CREATE INDEX IF NOT EXISTS idx_timetable_class ON timetable_slots(class_id);
  CREATE INDEX IF NOT EXISTS idx_seating_class ON seating_layout(class_id);
`);

export default db;
