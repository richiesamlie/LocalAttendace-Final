import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import { createMockDb, seedMockData } from '../../test/mocks/db';

/**
 * Teacher Service Tests
 * 
 * Tests for teacher CRUD operations and authentication.
 * 
 * These are integration tests that test the database queries directly.
 */

describe('Teacher Service', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createMockDb();
    seedMockData(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('getByUsername', () => {
    it('should retrieve teacher by username', () => {
      const result = db.prepare('SELECT * FROM teachers WHERE username = ?').get('admin');
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('id', 'teacher-1');
      expect(result).toHaveProperty('username', 'admin');
      expect(result).toHaveProperty('name', 'Admin Teacher');
      expect(result).toHaveProperty('is_admin', 1);
    });

    it('should return undefined for non-existent username', () => {
      const result = db.prepare('SELECT * FROM teachers WHERE username = ?').get('nonexistent');
      
      expect(result).toBeUndefined();
    });

    it('should verify password hash is stored', () => {
      const result = db.prepare('SELECT password_hash FROM teachers WHERE username = ?').get('admin') as any;
      
      expect(result).toBeDefined();
      expect(result.password_hash).toBeTruthy();
      
      // Verify it's a valid bcrypt hash
      const isValid = bcrypt.compareSync('password123', result.password_hash);
      expect(isValid).toBe(true);
    });
  });

  describe('insert', () => {
    it('should create a new teacher with hashed password', () => {
      const newTeacherId = 'teacher-new';
      const username = 'newteacher';
      const name = 'New Teacher';
      const passwordHash = bcrypt.hashSync('test123', 10);

      db.prepare('INSERT INTO teachers (id, username, password_hash, name, is_admin) VALUES (?, ?, ?, ?, ?)').run(
        newTeacherId, username, passwordHash, name, 0
      );

      const result = db.prepare('SELECT * FROM teachers WHERE id = ?').get(newTeacherId) as any;
      
      expect(result).toBeDefined();
      expect(result.id).toBe(newTeacherId);
      expect(result.username).toBe(username);
      expect(result.name).toBe(name);
      expect(result.is_admin).toBe(0);
      
      // Verify password
      const isValid = bcrypt.compareSync('test123', result.password_hash);
      expect(isValid).toBe(true);
    });

    it('should prevent duplicate usernames', () => {
      const passwordHash = bcrypt.hashSync('test123', 10);

      expect(() => {
        db.prepare('INSERT INTO teachers (id, username, password_hash, name, is_admin) VALUES (?, ?, ?, ?, ?)').run(
          'teacher-duplicate', 'admin', passwordHash, 'Duplicate', 0
        );
      }).toThrow();  // Should violate UNIQUE constraint
    });

    it('should require all mandatory fields', () => {
      expect(() => {
        db.prepare('INSERT INTO teachers (id, username) VALUES (?, ?)').run('teacher-incomplete', 'incomplete');
      }).toThrow();  // Should fail NOT NULL constraint on password_hash and name
    });
  });

  describe('getById', () => {
    it('should retrieve teacher by ID', () => {
      const result = db.prepare('SELECT id, username, name, is_admin FROM teachers WHERE id = ?').get('teacher-1') as any;
      
      expect(result).toBeDefined();
      expect(result.id).toBe('teacher-1');
      expect(result.username).toBe('admin');
      expect(result.name).toBe('Admin Teacher');
    });

    it('should return undefined for non-existent ID', () => {
      const result = db.prepare('SELECT * FROM teachers WHERE id = ?').get('nonexistent');
      
      expect(result).toBeUndefined();
    });
  });

  describe('getIsAdmin', () => {
    it('should return true for admin teacher', () => {
      const result = db.prepare('SELECT is_admin FROM teachers WHERE id = ?').get('teacher-1') as any;
      
      expect(result).toBeDefined();
      expect(result.is_admin).toBe(1);
    });

    it('should return false for non-admin teacher', () => {
      const result = db.prepare('SELECT is_admin FROM teachers WHERE id = ?').get('teacher-2') as any;
      
      expect(result).toBeDefined();
      expect(result.is_admin).toBe(0);
    });
  });

  describe('isHomeroom (class ownership)', () => {
    it('should return true for homeroom teacher (owner) of class', () => {
      const result = db.prepare(
        "SELECT COUNT(*) as count FROM class_teachers WHERE teacher_id = ? AND role = 'owner'"
      ).get('teacher-1') as any;
      
      expect(result.count).toBeGreaterThan(0);
    });

    it('should return false for teacher without owned classes', () => {
      const result = db.prepare(
        "SELECT COUNT(*) as count FROM class_teachers WHERE teacher_id = ? AND role = 'owner'"
      ).get('teacher-3') as any;
      
      expect(result.count).toBe(0);
    });
  });

  describe('getAllTeachers', () => {
    it('should retrieve all teachers', () => {
      const results = db.prepare('SELECT id, username, name FROM teachers ORDER BY name').all();
      
      expect(results).toHaveLength(3);
      expect(results[0]).toHaveProperty('username');
      expect(results[0]).toHaveProperty('name');
    });
  });

  describe('updatePassword', () => {
    it('should update teacher password hash', () => {
      const teacherId = 'teacher-2';
      const newPasswordHash = bcrypt.hashSync('newpassword456', 10);

      db.prepare('UPDATE teachers SET password_hash = ? WHERE id = ?').run(newPasswordHash, teacherId);

      const result = db.prepare('SELECT password_hash FROM teachers WHERE id = ?').get(teacherId) as any;
      
      expect(result).toBeDefined();
      const isValid = bcrypt.compareSync('newpassword456', result.password_hash);
      expect(isValid).toBe(true);
      
      // Old password should not work
      const isOldValid = bcrypt.compareSync('password123', result.password_hash);
      expect(isOldValid).toBe(false);
    });
  });

  describe('last_login tracking', () => {
    it('should update last_login timestamp', () => {
      const teacherId = 'teacher-1';
      const now = new Date().toISOString();

      db.prepare('UPDATE teachers SET last_login = ? WHERE id = ?').run(now, teacherId);

      const result = db.prepare('SELECT last_login FROM teachers WHERE id = ?').get(teacherId) as any;
      
      expect(result).toBeDefined();
      expect(result.last_login).toBe(now);
    });
  });
});
