import { _db, DEFAULTS, getDefaultPassword, createBackup } from './connection';
import bcrypt from 'bcrypt';

export function initSchema(): void {
  createBackup();

  _db.exec(`
    CREATE TABLE IF NOT EXISTS teachers (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0,
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
    _db.exec(`INSERT OR IGNORE INTO class_teachers (class_id, teacher_id, role) SELECT id, teacher_id, 'owner' FROM classes`);
  }

  const studentsInfo = _db.pragma('table_info(students)') as Array<{ name: string }>;
  const hasFlaggedColumn = studentsInfo.some(col => col.name === 'is_flagged');
  if (!hasFlaggedColumn) {
    _db.exec('ALTER TABLE students ADD COLUMN is_flagged INTEGER DEFAULT 0');
  }

  const hasArchivedColumn = studentsInfo.some(col => col.name === 'is_archived');
  if (!hasArchivedColumn) {
    _db.exec('ALTER TABLE students ADD COLUMN is_archived INTEGER DEFAULT 0');
  }

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
      console.log('[db] Default admin created. Change password immediately.');
    } else {
      const teacher = _db.prepare('SELECT id FROM teachers LIMIT 1').get() as { id: string };
      defaultTeacherId = teacher?.id || defaultTeacherId;
    }
    _db.exec('ALTER TABLE classes ADD COLUMN teacher_id TEXT');
    _db.prepare('UPDATE classes SET teacher_id = ?').run(defaultTeacherId);
    _db.exec('CREATE INDEX IF NOT EXISTS idx_classes_teacher ON classes(teacher_id)');
  }

  const tablesToAddUpdatedAt = ['students', 'attendance_records', 'events', 'timetable_slots', 'daily_notes', 'seating_layout', 'classes'];
  for (const table of tablesToAddUpdatedAt) {
    const tableInfo = _db.pragma(`table_info(${table})`) as Array<{ name: string }>;
    const hasUpdatedAt = tableInfo.some(col => col.name === 'updated_at');
    if (!hasUpdatedAt) {
      _db.exec(`ALTER TABLE ${table} ADD COLUMN updated_at TEXT`);
    }
  }

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

  const compoundIndexes = [
    ['idx_students_class_archived', 'students', '(class_id, is_archived)'],
    ['idx_records_class_date_status', 'attendance_records', '(class_id, date, status)'],
    ['idx_events_class_date_type', 'events', '(class_id, date, type)'],
    ['idx_timetable_class_day', 'timetable_slots', '(class_id, day_of_week)'],
  ];
  for (const [idxName, table, columns] of compoundIndexes) {
    _db.exec(`CREATE INDEX IF NOT EXISTS ${idxName} ON ${table} ${columns}`);
  }

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

  const teachersInfo = _db.pragma('table_info(teachers)') as Array<{ name: string }>;
  const hasLastLogin = teachersInfo.some(col => col.name === 'last_login');
  if (!hasLastLogin) {
    _db.exec('ALTER TABLE teachers ADD COLUMN last_login TEXT');
  }

  const hasIsAdmin = teachersInfo.some(col => col.name === 'is_admin');
  if (!hasIsAdmin) {
    _db.exec('ALTER TABLE teachers ADD COLUMN is_admin INTEGER DEFAULT 0');
  }

  _db.exec(`CREATE INDEX IF NOT EXISTS idx_invite_codes_class_active ON invite_codes (class_id, expires_at, used_by)`);
  _db.exec(`CREATE INDEX IF NOT EXISTS idx_user_sessions_teacher_active ON user_sessions (teacher_id, is_revoked, expires_at)`);

  const teacherCount = _db.prepare('SELECT COUNT(*) as count FROM teachers').get() as { count: number };
  if (teacherCount.count === 0) {
    const defaultPassword = getDefaultPassword();
    const hash = bcrypt.hashSync(defaultPassword, 10);
    _db.prepare('INSERT INTO teachers (id, username, password_hash, name, is_admin) VALUES (?, ?, ?, ?, ?)').run(
      DEFAULTS.TEACHER_ID, DEFAULTS.TEACHER_USERNAME, hash, DEFAULTS.TEACHER_NAME, 1
    );
    console.log(`[db] Default administrator created. Password: ${defaultPassword} (change immediately!)`);

    _db.exec(`UPDATE classes SET teacher_id = '${DEFAULTS.TEACHER_ID}' WHERE teacher_id IS NULL`);
    _db.exec("INSERT OR IGNORE INTO class_teachers (class_id, teacher_id, role) SELECT id, teacher_id, 'owner' FROM classes");
  } else {
    _db.prepare('UPDATE teachers SET is_admin = 1 WHERE username = ?').run(DEFAULTS.TEACHER_USERNAME);
  }

  _db.exec(`
    INSERT OR IGNORE INTO class_teachers (class_id, teacher_id, role)
    SELECT id, teacher_id, 'owner' FROM classes
    WHERE id NOT IN (SELECT DISTINCT class_id FROM class_teachers WHERE role = 'owner')
  `);
}