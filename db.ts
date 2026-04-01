import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import path from 'path';
import fs from 'fs';

const DB_FILE = path.join(process.cwd(), 'database.sqlite');

// Backup database before migrations
function createBackup(): void {
  try {
    if (!fs.existsSync(DB_FILE)) return;

    const backupDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupPath = path.join(backupDir, `database-backup-${timestamp}.sqlite`);
    fs.copyFileSync(DB_FILE, backupPath);

    // Keep only last 10 backups
    const backups = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('database-backup-'))
      .map(f => ({ name: f, path: path.join(backupDir, f) }))
      .sort((a, b) => fs.statSync(b.path).mtime.getTime() - fs.statSync(a.path).mtime.getTime());

    for (let i = 10; i < backups.length; i++) {
      fs.unlinkSync(backups[i].path);
    }

    console.log(`[db] Backup created: ${backupPath}`);
  } catch (err) {
    console.warn('[db] Failed to create backup:', (err as Error).message);
  }
}

let _db = new Database(DB_FILE, { timeout: 5000 });

// Enable foreign keys
_db.pragma('foreign_keys = ON');

// Enable WAL mode for better concurrent performance
_db.pragma('journal_mode = WAL');

// Auto-checkpoint WAL every 1000 frames to prevent WAL file growth
_db.pragma('wal_autocheckpoint = 1000');

// Optimize SQLite settings
_db.pragma('synchronous = NORMAL');
_db.pragma('cache_size = -64000'); // 64MB cache
_db.pragma('temp_store = MEMORY');
_db.pragma('mmap_size = 268435456'); // 256MB memory-mapped I/O

const initSchema = () => {
  // Create backup before any migrations
  createBackup();

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

    CREATE TABLE IF NOT EXISTS class_teachers (
      class_id TEXT NOT NULL,
      teacher_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'teacher',
      PRIMARY KEY (class_id, teacher_id),
      FOREIGN KEY (class_id) REFERENCES classes (id) ON DELETE CASCADE,
      FOREIGN KEY (teacher_id) REFERENCES teachers (id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_teachers_username ON teachers(username);
    CREATE INDEX IF NOT EXISTS idx_classes_teacher ON classes(teacher_id);
    CREATE INDEX IF NOT EXISTS idx_class_teachers_class ON class_teachers(class_id);
    CREATE INDEX IF NOT EXISTS idx_class_teachers_teacher ON class_teachers(teacher_id);
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

  // Migration: Add class_teachers table if not exists
  const tables = _db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='class_teachers'").all();
  if (tables.length === 0) {
    _db.exec(`
      CREATE TABLE class_teachers (
        class_id TEXT NOT NULL,
        teacher_id TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'teacher',
        PRIMARY KEY (class_id, teacher_id),
        FOREIGN KEY (class_id) REFERENCES classes (id) ON DELETE CASCADE,
        FOREIGN KEY (teacher_id) REFERENCES teachers (id) ON DELETE CASCADE
      );
      CREATE INDEX idx_class_teachers_class ON class_teachers(class_id);
      CREATE INDEX idx_class_teachers_teacher ON class_teachers(teacher_id);
    `);
    
    // Auto-add all existing class owners as 'owner' in class_teachers
    _db.exec(`INSERT OR IGNORE INTO class_teachers (class_id, teacher_id, role) SELECT id, teacher_id, 'owner' FROM classes`);
  }

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
    const existingTeachers = _db.prepare('SELECT COUNT(*) as count FROM teachers').get() as { count: number };
    let defaultTeacherId = 'teacher_default';
    if (existingTeachers.count === 0) {
      const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || process.env.JWT_SECRET?.slice(0, 16) || crypto.randomUUID().slice(0, 16);
      const hash = bcrypt.hashSync(defaultPassword, 10);
      _db.prepare('INSERT INTO teachers (id, username, password_hash, name) VALUES (?, ?, ?, ?)').run(
        defaultTeacherId, 'admin', hash, 'Administrator'
      );
      console.log(`[db] Default admin created. Password: ${defaultPassword} (change immediately!)`);
    } else {
      const teacher = _db.prepare('SELECT id FROM teachers LIMIT 1').get() as { id: string };
      defaultTeacherId = teacher?.id || defaultTeacherId;
    }
    _db.exec('ALTER TABLE classes ADD COLUMN teacher_id TEXT');
    _db.prepare('UPDATE classes SET teacher_id = ?').run(defaultTeacherId);
    _db.exec('CREATE INDEX IF NOT EXISTS idx_classes_teacher ON classes(teacher_id)');
  }

  // Ensure default admin teacher always exists
  const teacherCount = _db.prepare('SELECT COUNT(*) as count FROM teachers').get() as { count: number };
  if (teacherCount.count === 0) {
    const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || process.env.JWT_SECRET?.slice(0, 16) || crypto.randomUUID().slice(0, 16);
    const hash = bcrypt.hashSync(defaultPassword, 10);
    _db.prepare('INSERT INTO teachers (id, username, password_hash, name) VALUES (?, ?, ?, ?)').run(
      'teacher_default', 'admin', hash, 'Administrator'
    );
    console.log(`[db] Default admin created. Password: ${defaultPassword} (change immediately!)`);
    
    _db.exec("UPDATE classes SET teacher_id = 'teacher_default' WHERE teacher_id IS NULL");
    _db.exec("INSERT OR IGNORE INTO class_teachers (class_id, teacher_id, role) SELECT id, teacher_id, 'owner' FROM classes");
  }
};
initSchema();

// Pre-compile frequently used queries for performance (after schema is created)
const preparedStatements = {
  getTeacherByUsername: _db.prepare('SELECT id, username, password_hash, name FROM teachers WHERE username = ?'),
  getTeacherById: _db.prepare('SELECT id, username, name FROM teachers WHERE id = ?'),
  getClassesByTeacher: _db.prepare('SELECT c.id, c.teacher_id, c.name, t.name as owner_name FROM classes c JOIN teachers t ON c.teacher_id = t.id WHERE c.id IN (SELECT class_id FROM class_teachers WHERE teacher_id = ?)'),
  getStudentsByClass: _db.prepare('SELECT id, class_id, name, roll_number, parent_name, parent_phone, is_flagged, is_archived FROM students WHERE class_id = ? AND is_archived = 0'),
  getStudentsByClassWithArchived: _db.prepare('SELECT id, class_id, name, roll_number, parent_name, parent_phone, is_flagged, is_archived FROM students WHERE class_id = ?'),
  getRecordsByClass: _db.prepare('SELECT student_id, class_id, date, status, reason FROM attendance_records WHERE class_id = ?'),
  getRecordsByDate: _db.prepare('SELECT student_id, class_id, date, status, reason FROM attendance_records WHERE date = ?'),
  getRecordsByClassAndDate: _db.prepare('SELECT student_id, class_id, date, status, reason FROM attendance_records WHERE class_id = ? AND date = ?'),
  getEventsByClass: _db.prepare('SELECT id, class_id, date, title, type, description FROM events WHERE class_id = ?'),
  getDailyNotesByClass: _db.prepare('SELECT date, note FROM daily_notes WHERE class_id = ?'),
  getTimetableByClass: _db.prepare('SELECT id, class_id, day_of_week, start_time, end_time, subject, lesson FROM timetable_slots WHERE class_id = ?'),
  getSeatingByClass: _db.prepare('SELECT seat_id, student_id FROM seating_layout WHERE class_id = ?'),
  insertTeacher: _db.prepare('INSERT INTO teachers (id, username, password_hash, name) VALUES (?, ?, ?, ?)'),
  insertClass: _db.prepare('INSERT INTO classes (id, teacher_id, name) VALUES (?, ?, ?)'),
  insertStudent: _db.prepare('INSERT INTO students (id, class_id, name, roll_number, parent_name, parent_phone, is_flagged) VALUES (?, ?, ?, ?, ?, ?, ?)'),
  insertAttendance: _db.prepare('INSERT OR REPLACE INTO attendance_records (student_id, class_id, date, status, reason) VALUES (?, ?, ?, ?, ?)'),
  insertEvent: _db.prepare('INSERT INTO events (id, class_id, date, title, type, description) VALUES (?, ?, ?, ?, ?, ?)'),
  insertDailyNote: _db.prepare('INSERT OR REPLACE INTO daily_notes (class_id, date, note) VALUES (?, ?, ?)'),
  insertTimetableSlot: _db.prepare('INSERT INTO timetable_slots (id, class_id, day_of_week, start_time, end_time, subject, lesson) VALUES (?, ?, ?, ?, ?, ?, ?)'),
  insertSeating: _db.prepare('INSERT INTO seating_layout (class_id, seat_id, student_id) VALUES (?, ?, ?)'),
  updateStudent: _db.prepare('UPDATE students SET name = ?, roll_number = ?, parent_name = ?, parent_phone = ?, is_flagged = ?, is_archived = ? WHERE id = ?'),
  updateClass: _db.prepare('UPDATE classes SET name = ? WHERE id = ? AND teacher_id = ?'),
  updateEvent: _db.prepare('UPDATE events SET date = ?, title = ?, type = ?, description = ? WHERE id = ?'),
  updateTimetableSlot: _db.prepare('UPDATE timetable_slots SET day_of_week = ?, start_time = ?, end_time = ?, subject = ?, lesson = ? WHERE id = ?'),
  deleteClass: _db.prepare('DELETE FROM classes WHERE id = ? AND teacher_id = ?'),
  deleteEvent: _db.prepare('DELETE FROM events WHERE id = ?'),
  deleteTimetableSlot: _db.prepare('DELETE FROM timetable_slots WHERE id = ?'),
  archiveStudent: _db.prepare('UPDATE students SET is_archived = 1 WHERE id = ?'),
  getStudentById: _db.prepare('SELECT s.id FROM students s JOIN classes c ON s.class_id = c.id WHERE s.id = ? AND c.teacher_id = ?'),
  getEventById: _db.prepare('SELECT e.id FROM events e JOIN classes c ON e.class_id = c.id WHERE e.id = ? AND c.teacher_id = ?'),
  getTimetableSlotById: _db.prepare('SELECT t.id FROM timetable_slots t JOIN classes c ON t.class_id = c.id WHERE t.id = ? AND c.teacher_id = ?'),
  getClassById: _db.prepare('SELECT c.id, c.teacher_id, c.name, t.name as owner_name FROM classes c JOIN teachers t ON c.teacher_id = t.id WHERE c.id = ? AND c.id IN (SELECT class_id FROM class_teachers WHERE teacher_id = ?)'),
  clearSeatingByClass: _db.prepare('DELETE FROM seating_layout WHERE class_id = ?'),
  getStudentByClassAndId: _db.prepare('SELECT id FROM students WHERE class_id = ? AND id = ?'),
  deleteSeatingBySeat: _db.prepare('DELETE FROM seating_layout WHERE class_id = ? AND seat_id = ?'),
  deleteSeatingByStudent: _db.prepare('DELETE FROM seating_layout WHERE class_id = ? AND student_id = ?'),
  insertClassTeacher: _db.prepare('INSERT OR IGNORE INTO class_teachers (class_id, teacher_id, role) VALUES (?, ?, ?)'),
  removeClassTeacher: _db.prepare('DELETE FROM class_teachers WHERE class_id = ? AND teacher_id = ?'),
  getClassTeachers: _db.prepare('SELECT ct.teacher_id, ct.role, t.username, t.name FROM class_teachers ct JOIN teachers t ON ct.teacher_id = t.id WHERE ct.class_id = ?'),
  isClassTeacher: _db.prepare('SELECT class_id, role FROM class_teachers WHERE class_id = ? AND teacher_id = ?'),
  countTeachers: _db.prepare('SELECT COUNT(*) as count FROM teachers'),
  getFirstTeacher: _db.prepare('SELECT id FROM teachers LIMIT 1'),
  getStudentsCount: _db.prepare('SELECT COUNT(*) as count FROM students WHERE class_id = ?'),
  getTeacherCount: _db.prepare('SELECT COUNT(*) as count FROM teachers'),
  getAllTeachers: _db.prepare('SELECT id, username, name, created_at FROM teachers'),
  getSettings: _db.prepare('SELECT key, value FROM admin_settings'),
  upsertSetting: _db.prepare('INSERT OR REPLACE INTO admin_settings (key, value) VALUES (?, ?)'),
  getAdminPassword: _db.prepare('SELECT value FROM admin_settings WHERE key = ?'),
  getStudentsCountByTeacher: _db.prepare("SELECT COUNT(*) as count FROM students s JOIN classes c ON s.class_id = c.id WHERE c.teacher_id = ?"),
  getRecordsCountByTeacher: _db.prepare("SELECT COUNT(*) as count FROM attendance_records ar JOIN classes c ON ar.class_id = c.id WHERE c.teacher_id = ?"),
  getEventsCountByTeacher: _db.prepare("SELECT COUNT(*) as count FROM events e JOIN classes c ON e.class_id = c.id WHERE c.teacher_id = ?"),
  getAllClasses: _db.prepare("SELECT c.id, c.teacher_id, c.name, t.name as teacher_name FROM classes c JOIN teachers t ON c.teacher_id = t.id"),
};

// Periodic WAL checkpoint to prevent WAL file growth
const checkpointInterval = setInterval(() => {
  try {
    _db.pragma('wal_checkpoint(TRUNCATE)');
  } catch (e) {
    // Ignore checkpoint errors during active transactions
  }
}, 60000); // Every 60 seconds

// Clean up on process exit
process.on('beforeExit', () => {
  clearInterval(checkpointInterval);
  try {
    _db.pragma('wal_checkpoint(TRUNCATE)');
    _db.close();
  } catch (e) {}
});

const dbProxy = new Proxy({}, {
  get(target, prop) {
    if (prop === 'restore') {
      return (buffer: Buffer) => {
        clearInterval(checkpointInterval);
        try { _db.close(); } catch(e) {}
        fs.writeFileSync(DB_FILE, buffer);
        _db = new Database(DB_FILE, { timeout: 5000 });
        _db.pragma('foreign_keys = ON');
        _db.pragma('journal_mode = WAL');
        _db.pragma('wal_autocheckpoint = 1000');
        _db.pragma('synchronous = NORMAL');
        _db.pragma('cache_size = -64000');
        _db.pragma('temp_store = MEMORY');
        _db.pragma('mmap_size = 268435456');
        initSchema(); // Ensure the restored DB has the correct schema
      };
    }
    if (prop === 'stmt') {
      return preparedStatements;
    }
    const val = (_db as any)[prop];
    if (typeof val === 'function') {
      return val.bind(_db);
    }
    return val;
  }
}) as Database.Database & { restore: (buf: Buffer) => void; stmt: typeof preparedStatements };

export default dbProxy;
