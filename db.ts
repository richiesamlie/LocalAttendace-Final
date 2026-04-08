import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import path from 'path';
import fs from 'fs';

const DB_FILE = path.join(process.cwd(), 'database.sqlite');

// Centralized defaults — single source of truth
export const DEFAULTS = {
  TEACHER_ID: 'teacher_default',
  TEACHER_USERNAME: 'admin',
  TEACHER_NAME: 'Administrator',
  CLASS_ID: 'class_default',
  CLASS_NAME: 'My First Class',
} as const;

function getDefaultPassword(): string {
  return process.env.DEFAULT_ADMIN_PASSWORD || 'teacher123';
}

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
    let defaultTeacherId: string = DEFAULTS.TEACHER_ID;
    if (existingTeachers.count === 0) {
      const defaultPassword = getDefaultPassword();
      const hash = bcrypt.hashSync(defaultPassword, 10);
      _db.prepare('INSERT INTO teachers (id, username, password_hash, name) VALUES (?, ?, ?, ?)').run(
        DEFAULTS.TEACHER_ID, DEFAULTS.TEACHER_USERNAME, hash, DEFAULTS.TEACHER_NAME
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

  // Migration: Add updated_at columns for optimistic locking (Phase 1.4)
  const tablesToAddUpdatedAt = ['students', 'attendance_records', 'events', 'timetable_slots', 'daily_notes', 'seating_layout', 'classes'];
  for (const table of tablesToAddUpdatedAt) {
    const tableInfo = _db.pragma(`table_info(${table})`) as Array<{ name: string }>;
    const hasUpdatedAt = tableInfo.some(col => col.name === 'updated_at');
    if (!hasUpdatedAt) {
      _db.exec(`ALTER TABLE ${table} ADD COLUMN updated_at TEXT`);
    }
  }

  // Migration: Add triggers to auto-populate updated_at on INSERT and UPDATE
  const triggerTables = [
    { table: 'students', pk: 'id' },
    { table: 'attendance_records', pk: 'student_id' },
    { table: 'events', pk: 'id' },
    { table: 'timetable_slots', pk: 'id' },
    { table: 'daily_notes', pk: 'class_id' },
    { table: 'seating_layout', pk: 'class_id' },
    { table: 'classes', pk: 'id' },
  ];
  for (const { table, pk } of triggerTables) {
    const triggerName = `trg_${table}_updated_at`;
    const existing = _db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name=?").get(triggerName);
    if (!existing) {
      _db.exec(`
        CREATE TRIGGER ${triggerName}
        AFTER UPDATE ON ${table}
        FOR EACH ROW
        BEGIN
          UPDATE ${table} SET updated_at = CURRENT_TIMESTAMP WHERE ${pk} = NEW.${pk};
        END;
      `);
    }
  }

  // Migration: Phase 4.1 - Additional compound indexes for common query patterns
  const compoundIndexes = [
    ['idx_students_class_archived', 'students', '(class_id, is_archived)'],
    ['idx_records_class_date_status', 'attendance_records', '(class_id, date, status)'],
    ['idx_events_class_date_type', 'events', '(class_id, date, type)'],
    ['idx_timetable_class_day', 'timetable_slots', '(class_id, day_of_week)'],
  ];
  for (const [idxName, table, columns] of compoundIndexes) {
    _db.exec(`CREATE INDEX IF NOT EXISTS ${idxName} ON ${table} ${columns}`);
  }

  // Migration: Add invite_codes table (Phase 2.2)
  const inviteTables = _db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='invite_codes'").all();
  if (inviteTables.length === 0) {
    _db.exec(`
      CREATE TABLE invite_codes (
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
      CREATE INDEX idx_invite_codes_class ON invite_codes(class_id);
      CREATE INDEX idx_invite_codes_code ON invite_codes(code);
    `);
  }

  // Migration: Add user_sessions table (Phase 2.3)
  const sessionTables = _db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user_sessions'").all();
  if (sessionTables.length === 0) {
    _db.exec(`
      CREATE TABLE user_sessions (
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
      CREATE INDEX idx_user_sessions_teacher ON user_sessions(teacher_id);
      CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);
    `);
  }

  // Migration: Add last_login to teachers (Phase 2.3)
  const teachersInfo = _db.pragma('table_info(teachers)') as Array<{ name: string }>;
  const hasLastLogin = teachersInfo.some(col => col.name === 'last_login');
  if (!hasLastLogin) {
    _db.exec('ALTER TABLE teachers ADD COLUMN last_login TEXT');
  }

  // Create compound indexes for invite_codes and user_sessions tables (after tables exist)
  _db.exec(`CREATE INDEX IF NOT EXISTS idx_invite_codes_class_active ON invite_codes (class_id, expires_at, used_by)`);
  _db.exec(`CREATE INDEX IF NOT EXISTS idx_user_sessions_teacher_active ON user_sessions (teacher_id, is_revoked, expires_at)`);

  // Ensure default admin teacher always exists
  const teacherCount = _db.prepare('SELECT COUNT(*) as count FROM teachers').get() as { count: number };
  if (teacherCount.count === 0) {
    const defaultPassword = getDefaultPassword();
    const hash = bcrypt.hashSync(defaultPassword, 10);
    _db.prepare('INSERT INTO teachers (id, username, password_hash, name) VALUES (?, ?, ?, ?)').run(
      DEFAULTS.TEACHER_ID, DEFAULTS.TEACHER_USERNAME, hash, DEFAULTS.TEACHER_NAME
    );
    console.log(`[db] Default admin created. Password: ${defaultPassword} (change immediately!)`);

    _db.exec(`UPDATE classes SET teacher_id = '${DEFAULTS.TEACHER_ID}' WHERE teacher_id IS NULL`);
    _db.exec("INSERT OR IGNORE INTO class_teachers (class_id, teacher_id, role) SELECT id, teacher_id, 'owner' FROM classes");
  }
  // Migration: Heal any classes that are missing a class_teachers owner entry.
  // This was caused by class creation not inserting into class_teachers (pre-fix bug).
  // Safe to run every startup — INSERT OR IGNORE is idempotent.
  _db.exec(`
    INSERT OR IGNORE INTO class_teachers (class_id, teacher_id, role)
    SELECT id, teacher_id, 'owner' FROM classes
    WHERE id NOT IN (SELECT DISTINCT class_id FROM class_teachers WHERE role = 'owner')
  `);
};
initSchema();

// Pre-compile frequently used queries for performance (after schema is created)
const preparedStatements = {
  getTeacherByUsername: _db.prepare('SELECT id, username, password_hash, name FROM teachers WHERE username = ?'),
  getTeacherById: _db.prepare('SELECT id, username, name FROM teachers WHERE id = ?'),
  getClassesByTeacher: _db.prepare('SELECT c.id, c.teacher_id, c.name, t.name as owner_name FROM classes c JOIN teachers t ON c.teacher_id = t.id WHERE c.id IN (SELECT class_id FROM class_teachers WHERE teacher_id = ?)'),
  getStudentsByClass: _db.prepare('SELECT id, class_id, name, roll_number, parent_name, parent_phone, is_flagged, is_archived FROM students WHERE class_id = ? AND is_archived = 0 ORDER BY name'),
  getStudentsByClassWithArchived: _db.prepare('SELECT id, class_id, name, roll_number, parent_name, parent_phone, is_flagged, is_archived FROM students WHERE class_id = ? ORDER BY name'),
  getRecordsByClass: _db.prepare('SELECT student_id, class_id, date, status, reason FROM attendance_records WHERE class_id = ?'),
  getRecordsByDate: _db.prepare('SELECT student_id, class_id, date, status, reason FROM attendance_records WHERE date = ?'),
  getRecordsByClassAndDate: _db.prepare('SELECT student_id, class_id, date, status, reason FROM attendance_records WHERE class_id = ? AND date = ?'),
  getEventsByClass: _db.prepare('SELECT id, class_id, date, title, type, description FROM events WHERE class_id = ? ORDER BY date DESC'),
  getDailyNotesByClass: _db.prepare('SELECT date, note FROM daily_notes WHERE class_id = ?'),
  getTimetableByClass: _db.prepare('SELECT id, class_id, day_of_week, start_time, end_time, subject, lesson FROM timetable_slots WHERE class_id = ? ORDER BY day_of_week, start_time'),
  getSeatingByClass: _db.prepare('SELECT seat_id, student_id FROM seating_layout WHERE class_id = ?'),
  insertTeacher: _db.prepare('INSERT INTO teachers (id, username, password_hash, name) VALUES (?, ?, ?, ?)'),
  insertClass: _db.prepare('INSERT INTO classes (id, teacher_id, name) VALUES (?, ?, ?)'),
  insertStudent: _db.prepare('INSERT INTO students (id, class_id, name, roll_number, parent_name, parent_phone, is_flagged) VALUES (?, ?, ?, ?, ?, ?, ?)'),
  insertAttendance: _db.prepare('INSERT OR REPLACE INTO attendance_records (student_id, class_id, date, status, reason) VALUES (?, ?, ?, ?, ?)'),
  insertEvent: _db.prepare('INSERT INTO events (id, class_id, date, title, type, description) VALUES (?, ?, ?, ?, ?, ?)'),
  insertDailyNote: _db.prepare('INSERT OR REPLACE INTO daily_notes (class_id, date, note) VALUES (?, ?, ?)'),
  insertTimetableSlot: _db.prepare('INSERT INTO timetable_slots (id, class_id, day_of_week, start_time, end_time, subject, lesson) VALUES (?, ?, ?, ?, ?, ?, ?)'),
  insertSeating: _db.prepare('INSERT INTO seating_layout (class_id, seat_id, student_id) VALUES (?, ?, ?)'),
  updateStudent: _db.prepare('UPDATE students SET name = ?, roll_number = ?, parent_name = ?, parent_phone = ?, is_flagged = ?, is_archived = ? WHERE id = ? AND class_id IN (SELECT class_id FROM class_teachers WHERE teacher_id = ?)'),
  updateClass: _db.prepare('UPDATE classes SET name = ? WHERE id = ? AND id IN (SELECT class_id FROM class_teachers WHERE teacher_id = ?)'),
  updateEvent: _db.prepare('UPDATE events SET date = ?, title = ?, type = ?, description = ? WHERE id = ? AND class_id IN (SELECT class_id FROM class_teachers WHERE teacher_id = ?)'),
  updateTimetableSlot: _db.prepare('UPDATE timetable_slots SET day_of_week = ?, start_time = ?, end_time = ?, subject = ?, lesson = ? WHERE id = ? AND class_id IN (SELECT class_id FROM class_teachers WHERE teacher_id = ?)'),
  deleteClass: _db.prepare('DELETE FROM classes WHERE id = ? AND id IN (SELECT class_id FROM class_teachers WHERE teacher_id = ? AND role = \'owner\')'),
  deleteEvent: _db.prepare('DELETE FROM events WHERE id = ? AND class_id IN (SELECT class_id FROM class_teachers WHERE teacher_id = ?)'),
  deleteTimetableSlot: _db.prepare('DELETE FROM timetable_slots WHERE id = ? AND class_id IN (SELECT class_id FROM class_teachers WHERE teacher_id = ?)'),
  archiveStudent: _db.prepare('UPDATE students SET is_archived = 1 WHERE id = ? AND class_id IN (SELECT class_id FROM class_teachers WHERE teacher_id = ?)'),
  getStudentById: _db.prepare('SELECT s.id, s.name, s.roll_number, s.parent_name, s.parent_phone, s.is_flagged, s.is_archived FROM students s JOIN class_teachers ct ON s.class_id = ct.class_id WHERE s.id = ? AND ct.teacher_id = ?'),
  getEventById: _db.prepare('SELECT e.id, e.date, e.title, e.type, e.description FROM events e JOIN class_teachers ct ON e.class_id = ct.class_id WHERE e.id = ? AND ct.teacher_id = ?'),
  getTimetableSlotById: _db.prepare('SELECT t.id, t.day_of_week, t.start_time, t.end_time, t.subject, t.lesson FROM timetable_slots t JOIN class_teachers ct ON t.class_id = ct.class_id WHERE t.id = ? AND ct.teacher_id = ?'),
  getClassById: _db.prepare('SELECT c.id, c.teacher_id, c.name, t.name as owner_name FROM classes c JOIN teachers t ON c.teacher_id = t.id WHERE c.id = ? AND c.id IN (SELECT class_id FROM class_teachers WHERE teacher_id = ?)'),
  clearSeatingByClass: _db.prepare('DELETE FROM seating_layout WHERE class_id = ?'),
  getStudentByClassAndId: _db.prepare('SELECT id FROM students WHERE class_id = ? AND id = ?'),
  deleteSeatingBySeat: _db.prepare('DELETE FROM seating_layout WHERE class_id = ? AND seat_id = ?'),
  deleteSeatingByStudent: _db.prepare('DELETE FROM seating_layout WHERE class_id = ? AND student_id = ?'),
  insertClassTeacher: _db.prepare('INSERT OR IGNORE INTO class_teachers (class_id, teacher_id, role) VALUES (?, ?, ?)'),
  removeClassTeacher: _db.prepare('DELETE FROM class_teachers WHERE class_id = ? AND teacher_id = ?'),
  updateClassTeacherRole: _db.prepare('UPDATE class_teachers SET role = ? WHERE class_id = ? AND teacher_id = ?'),
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
  insertInviteCode: _db.prepare('INSERT INTO invite_codes (code, class_id, role, created_by, expires_at) VALUES (?, ?, ?, ?, ?)'),
  getInviteCode: _db.prepare('SELECT code, class_id, role, created_by, created_at, expires_at, used_by, used_at FROM invite_codes WHERE code = ?'),
  useInviteCode: _db.prepare('UPDATE invite_codes SET used_by = ?, used_at = CURRENT_TIMESTAMP WHERE code = ?'),
  deleteInviteCode: _db.prepare('DELETE FROM invite_codes WHERE code = ?'),
  getClassInviteCodes: _db.prepare('SELECT code, role, created_by, created_at, expires_at, used_by, used_at FROM invite_codes WHERE class_id = ? ORDER BY created_at DESC'),
  deleteExpiredInviteCodes: _db.prepare("DELETE FROM invite_codes WHERE expires_at < datetime('now')"),
  insertSession: _db.prepare('INSERT INTO user_sessions (id, teacher_id, device_name, ip_address, expires_at) VALUES (?, ?, ?, ?, ?)'),
  getSession: _db.prepare('SELECT id, teacher_id, device_name, ip_address, created_at, last_active, expires_at, is_revoked FROM user_sessions WHERE id = ?'),
  getSessionsByTeacher: _db.prepare('SELECT id, device_name, ip_address, created_at, last_active, expires_at, is_revoked FROM user_sessions WHERE teacher_id = ? ORDER BY last_active DESC'),
  updateSessionActivity: _db.prepare("UPDATE user_sessions SET last_active = datetime('now') WHERE id = ?"),
  revokeSession: _db.prepare('UPDATE user_sessions SET is_revoked = 1 WHERE id = ?'),
  revokeAllSessions: _db.prepare('UPDATE user_sessions SET is_revoked = 1 WHERE teacher_id = ?'),
  deleteExpiredSessions: _db.prepare("DELETE FROM user_sessions WHERE expires_at < datetime('now')"),
  updateTeacherLastLogin: _db.prepare("UPDATE teachers SET last_login = datetime('now') WHERE id = ?"),
  // N6: Check if a teacher owns at least one class (qualifies as admin for teacher registration)
  isAdminTeacher: _db.prepare("SELECT COUNT(*) as count FROM class_teachers WHERE teacher_id = ? AND role = 'owner'"),
  // N12: Update teacher password hash directly (used when admin password is changed via settings)
  updateTeacherPassword: _db.prepare('UPDATE teachers SET password_hash = ? WHERE id = ?'),
};

// Write queue for serializing write operations (Phase 1.2 + 1.3)
// better-sqlite3 is synchronous, so we queue writes to prevent "database is locked" errors
// while allowing concurrent reads to proceed directly
interface WriteTask {
  fn: () => void;
  resolve: () => void;
  reject: (error: Error) => void;
}

const writeQueue: WriteTask[] = [];
let isProcessingWriteQueue = false;

async function processWriteQueue(): Promise<void> {
  if (isProcessingWriteQueue || writeQueue.length === 0) return;
  isProcessingWriteQueue = true;

  while (writeQueue.length > 0) {
    const task = writeQueue.shift()!;
    try {
      task.fn();
      task.resolve();
    } catch (error) {
      task.reject(error as Error);
    }
  }

  isProcessingWriteQueue = false;
}

// In-memory cache for frequently accessed read-heavy data (Phase 4.2)
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<any>>();

const DEFAULT_TTL = 5000; // 5 seconds for most cached reads
const LONG_TTL = 60000; // 1 minute for static data (settings, teacher list)

export function cacheGet<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

export function cacheSet<T>(key: string, value: T, ttl: number = DEFAULT_TTL): void {
  cache.set(key, { value, expiresAt: Date.now() + ttl });
}

export function cacheInvalidate(pattern?: string): void {
  if (!pattern) {
    cache.clear();
    return;
  }
  const prefix = pattern.endsWith(':') ? pattern : `${pattern}:`;
  for (const key of cache.keys()) {
    if (key === prefix || key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}

// Cache wrapper: executes fn if not cached, returns cached value otherwise
export function cached<T>(key: string, fn: () => T, ttl: number = DEFAULT_TTL): T {
  const cached = cacheGet<T>(key);
  if (cached !== null) return cached;
  const value = fn();
  cacheSet(key, value, ttl);
  return value;
}

export function enqueueWrite(fn: () => void): Promise<void> {
  return new Promise((resolve, reject) => {
    writeQueue.push({ fn, resolve, reject });
    processWriteQueue();
  });
}

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
        // N10: Recompile all prepared statements against the new DB connection.
        // better-sqlite3 Statement.source returns the original SQL, so we can recompile
        // each statement against _db without touching the rest of the codebase.
        for (const key of Object.keys(preparedStatements)) {
          (preparedStatements as any)[key] = _db.prepare((preparedStatements as any)[key].source);
        }
      };
    }
    if (prop === 'stmt') {
      return preparedStatements;
    }
    if (prop === 'enqueueWrite') {
      return enqueueWrite;
    }
    if (prop === 'cache') {
      return { get: cacheGet, set: cacheSet, invalidate: cacheInvalidate, cached };
    }
    const val = (_db as any)[prop];
    if (typeof val === 'function') {
      return val.bind(_db);
    }
    return val;
  }
}) as Database.Database & { restore: (buf: Buffer) => void; stmt: typeof preparedStatements; enqueueWrite: typeof enqueueWrite; cache: { get: typeof cacheGet; set: typeof cacheSet; invalidate: typeof cacheInvalidate; cached: typeof cached } };

export default dbProxy;
