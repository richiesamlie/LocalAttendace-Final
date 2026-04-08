-- PostgreSQL Schema for Teacher Assistant
-- Run this script to create the database schema
-- Usage: psql -U postgres -d teacher_assistant -f schema.sql

-- Create tables
CREATE TABLE IF NOT EXISTS teachers (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS classes (
    id TEXT PRIMARY KEY,
    teacher_id TEXT NOT NULL,
    name TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    class_id TEXT NOT NULL,
    name TEXT NOT NULL,
    roll_number TEXT NOT NULL,
    parent_name TEXT,
    parent_phone TEXT,
    is_flagged BOOLEAN DEFAULT false,
    is_archived BOOLEAN DEFAULT false,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS attendance_records (
    student_id TEXT NOT NULL,
    date TEXT NOT NULL,
    status TEXT NOT NULL,
    reason TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (student_id, date),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS daily_notes (
    class_id TEXT NOT NULL,
    date TEXT NOT NULL,
    note TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (class_id, date),
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    class_id TEXT NOT NULL,
    date TEXT NOT NULL,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS timetable_slots (
    id TEXT PRIMARY KEY,
    class_id TEXT NOT NULL,
    day_of_week INTEGER NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    subject TEXT NOT NULL,
    lesson TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS seating_layout (
    class_id TEXT NOT NULL,
    seat_id TEXT NOT NULL,
    student_id TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (class_id, seat_id),
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
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
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_teachers_username ON teachers(username);
CREATE INDEX IF NOT EXISTS idx_classes_teacher ON classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_class_teachers_class ON class_teachers(class_id);
CREATE INDEX IF NOT EXISTS idx_class_teachers_teacher ON class_teachers(teacher_id);
CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_class_archived ON students(class_id, is_archived);
CREATE INDEX IF NOT EXISTS idx_records_student_date ON attendance_records(student_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_notes_class ON daily_notes(class_id);
CREATE INDEX IF NOT EXISTS idx_events_class ON events(class_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
CREATE INDEX IF NOT EXISTS idx_timetable_class_day ON timetable_slots(class_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_seating_class ON seating_layout(class_id);

-- Additional tables for multi-user support (if not exists)
CREATE TABLE IF NOT EXISTS invite_codes (
    code TEXT PRIMARY KEY,
    class_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'teacher',
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    used_by TEXT,
    used_at TIMESTAMP,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES teachers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    teacher_id TEXT NOT NULL,
    device_name TEXT,
    ip_address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    is_revoked BOOLEAN DEFAULT false,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_invite_codes_class_active ON invite_codes(class_id, expires_at, used_by);
CREATE INDEX IF NOT EXISTS idx_user_sessions_teacher_active ON user_sessions(teacher_id, is_revoked, expires_at);

-- Add owner_name column to classes (for class summary)
DO $$ BEGIN
    ALTER TABLE classes ADD COLUMN owner_name TEXT;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Add last_login to teachers (for session tracking)
DO $$ BEGIN
    ALTER TABLE teachers ADD COLUMN last_login TIMESTAMP;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;
