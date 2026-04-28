/**
 * Database Mock Utilities for Testing
 * 
 * Provides mock database instances and helper functions for tests.
 * 
 * Usage:
 *   import { createMockDb, seedMockData } from './mocks/db';
 *   
 *   beforeEach(() => {
 *     db = createMockDb();
 *     seedMockData(db);
 *   });
 */

import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import type { Teacher, Class } from '../../types/db';

/**
 * Creates an in-memory SQLite database for testing
 */
export function createMockDb(): Database.Database {
  const db = new Database(':memory:');
  
  // Enable foreign keys
  db.pragma('foreign_keys = ON');
  
  // Create minimal schema for testing
  db.exec(`
    CREATE TABLE teachers (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_login TEXT
    );

    CREATE TABLE classes (
      id TEXT PRIMARY KEY,
      teacher_id TEXT NOT NULL,
      name TEXT NOT NULL,
      updated_at TEXT,
      FOREIGN KEY (teacher_id) REFERENCES teachers (id) ON DELETE CASCADE
    );

    CREATE TABLE class_teachers (
      class_id TEXT NOT NULL,
      teacher_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'teacher',
      PRIMARY KEY (class_id, teacher_id),
      FOREIGN KEY (class_id) REFERENCES classes (id) ON DELETE CASCADE,
      FOREIGN KEY (teacher_id) REFERENCES teachers (id) ON DELETE CASCADE
    );

    CREATE TABLE students (
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

    CREATE TABLE attendance_records (
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

    CREATE TABLE daily_notes (
      class_id TEXT NOT NULL,
      date TEXT NOT NULL,
      note TEXT NOT NULL,
      updated_at TEXT,
      PRIMARY KEY (class_id, date),
      FOREIGN KEY (class_id) REFERENCES classes (id) ON DELETE CASCADE
    );

    -- Create indexes
    CREATE INDEX idx_teachers_username ON teachers(username);
    CREATE INDEX idx_classes_teacher ON classes(teacher_id);
    CREATE INDEX idx_class_teachers_class ON class_teachers(class_id);
    CREATE INDEX idx_class_teachers_teacher ON class_teachers(teacher_id);
    CREATE INDEX idx_students_class ON students(class_id);
    CREATE INDEX idx_user_sessions_teacher ON user_sessions(teacher_id);
    CREATE INDEX idx_daily_notes_class ON daily_notes(class_id);
    CREATE INDEX idx_daily_notes_date ON daily_notes(date);
  `);
  
  return db;
}

/**
 * Seeds mock database with test data
 */
export function seedMockData(db: Database.Database): void {
  // Hash password for test users (bcrypt hash of 'password123')
  const passwordHash = bcrypt.hashSync('password123', 10);
  
  // Insert mock teachers
  for (const teacher of mockTeachers) {
    db.prepare(`
      INSERT INTO teachers (id, username, password_hash, name, is_admin)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      teacher.id,
      teacher.username,
      passwordHash,
      teacher.name,
      teacher.is_admin || 0
    );
  }
  
  // Insert mock classes
  for (const cls of mockClasses) {
    db.prepare(`
      INSERT INTO classes (id, teacher_id, name)
      VALUES (?, ?, ?)
    `).run(cls.id, cls.teacher_id, cls.name);
    
    // Insert class_teachers relationship (owner)
    db.prepare(`
      INSERT INTO class_teachers (class_id, teacher_id, role)
      VALUES (?, ?, 'owner')
    `).run(cls.id, cls.teacher_id);
  }
  
  // Insert mock students
  for (const student of mockStudents) {
    db.prepare(`
      INSERT INTO students (id, class_id, name, roll_number, parent_name, parent_phone, is_flagged, is_archived)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      student.id,
      student.class_id,
      student.name,
      student.roll_number,
      student.parent_name || null,
      student.parent_phone || null,
      student.is_flagged || 0,
      student.is_archived || 0
    );
  }
}

/**
 * Mock data fixtures
 */
export const mockTeachers: Partial<Teacher>[] = [
  {
    id: 'teacher-1',
    username: 'admin',
    name: 'Admin Teacher',
    is_admin: 1,
  },
  {
    id: 'teacher-2',
    username: 'teacher1',
    name: 'John Smith',
    is_admin: 0,
  },
  {
    id: 'teacher-3',
    username: 'teacher2',
    name: 'Jane Doe',
    is_admin: 0,
  },
];

export const mockClasses: Partial<Class>[] = [
  {
    id: 'class-1',
    teacher_id: 'teacher-1',
    name: 'Class 1A',
  },
  {
    id: 'class-2',
    teacher_id: 'teacher-2',
    name: 'Class 2B',
  },
];

interface MockStudent {
  id: string;
  class_id: string;
  name: string;
  roll_number: string;
  parent_name?: string;
  parent_phone?: string;
  is_flagged?: number;
  is_archived?: number;
}

export const mockStudents: MockStudent[] = [
  {
    id: 'student-1',
    class_id: 'class-1',
    name: 'Alice Johnson',
    roll_number: '001',
    parent_name: 'Robert Johnson',
    parent_phone: '555-0001',
    is_flagged: 0,
    is_archived: 0,
  },
  {
    id: 'student-2',
    class_id: 'class-1',
    name: 'Bob Williams',
    roll_number: '002',
    parent_name: 'Sarah Williams',
    parent_phone: '555-0002',
    is_flagged: 0,
    is_archived: 0,
  },
  {
    id: 'student-3',
    class_id: 'class-2',
    name: 'Charlie Brown',
    roll_number: '001',
    parent_name: 'David Brown',
    parent_phone: '555-0003',
    is_flagged: 1,
    is_archived: 0,
  },
];
