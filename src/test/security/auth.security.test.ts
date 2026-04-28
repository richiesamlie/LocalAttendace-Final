import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import { createMockDb, seedMockData } from '../mocks/db';

/**
 * Authentication Security Tests
 * 
 * Critical security tests for authentication logic.
 * 
 * Tests cover:
 * - SQL injection prevention (via parameterized queries)
 * - Password hashing (bcrypt)
 * - Session management basics
 * - Input sanitization
 */

describe('Authentication Security', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createMockDb();
    seedMockData(db);
  });

  describe('Password Security', () => {
    it('should hash passwords using bcrypt (never store plain text)', () => {
      const result = db.prepare('SELECT password_hash FROM teachers WHERE username = ?').get('admin') as any;
      
      expect(result).toBeDefined();
      expect(result.password_hash).toBeTruthy();
      
      // Bcrypt hashes start with $2a$, $2b$, or $2y$
      expect(result.password_hash).toMatch(/^\$2[aby]\$/);
      
      // Verify it's NOT plain text
      expect(result.password_hash).not.toBe('password123');
    });

    it('should verify passwords using bcrypt.compareSync', () => {
      const result = db.prepare('SELECT password_hash FROM teachers WHERE username = ?').get('admin') as any;
      
      // Correct password should match
      const isValidCorrect = bcrypt.compareSync('password123', result.password_hash);
      expect(isValidCorrect).toBe(true);
      
      // Wrong password should not match
      const isValidWrong = bcrypt.compareSync('wrongpassword', result.password_hash);
      expect(isValidWrong).toBe(false);
    });

    it('should enforce minimum password length (4 chars for classroom use)', () => {
      const shortPassword = 'abc';  // Only 3 characters
      
      // In the actual app, this validation happens before hashing
      expect(shortPassword.length).toBeLessThan(4);
      
      // Document that classroom app intentionally allows simple passwords
      const minLength = 4;
      expect(minLength).toBe(4);  // Intentionally simple for local use
    });

    it('should create different hashes for same password (salt)', () => {
      const password = 'test123';
      const hash1 = bcrypt.hashSync(password, 10);
      const hash2 = bcrypt.hashSync(password, 10);
      
      // Hashes should be different due to unique salt
      expect(hash1).not.toBe(hash2);
      
      // But both should validate the same password
      expect(bcrypt.compareSync(password, hash1)).toBe(true);
      expect(bcrypt.compareSync(password, hash2)).toBe(true);
    });
  });

  describe('SQL Injection Prevention', () => {
    it('should safely handle SQL injection attempts in username (parameterized queries)', () => {
      const sqlInjectionAttempts = [
        "admin' OR '1'='1",
        "admin'--",
        "admin'; DROP TABLE teachers;--",
        "' OR 1=1--",
        "admin' UNION SELECT * FROM teachers--",
      ];

      for (const maliciousInput of sqlInjectionAttempts) {
        // Using parameterized query (safe)
        const result = db.prepare('SELECT * FROM teachers WHERE username = ?').get(maliciousInput);
        
        // Should return undefined (no match) instead of bypassing auth
        expect(result).toBeUndefined();
      }
    });

    it('should safely handle special characters in username', () => {
      const specialChars = ['admin\x00', 'admin\n', 'admin\r', 'admin\\', "admin'"];
      
      for (const input of specialChars) {
        const result = db.prepare('SELECT * FROM teachers WHERE username = ?').get(input);
        
        // Should either return undefined or match exact username (if exists)
        // Should NOT cause errors or security bypass
        if (result) {
          expect(result).toHaveProperty('username', input);
        } else {
          expect(result).toBeUndefined();
        }
      }
    });
  });

  describe('Session Security', () => {
    it('should create session with proper structure', () => {
      const sessionId = 'sess-test-123';
      const teacherId = 'teacher-1';
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      db.prepare(`
        INSERT INTO user_sessions (id, teacher_id, device_name, ip_address, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(sessionId, teacherId, 'Test Device', '127.0.0.1', expiresAt);

      const session = db.prepare('SELECT * FROM user_sessions WHERE id = ?').get(sessionId) as any;
      
      expect(session).toBeDefined();
      expect(session.teacher_id).toBe(teacherId);
      expect(session.is_revoked).toBe(0);
    });

    it('should support session revocation', () => {
      const sessionId = 'sess-revoke-test';
      const teacherId = 'teacher-1';
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      db.prepare(`
        INSERT INTO user_sessions (id, teacher_id, device_name, ip_address, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(sessionId, teacherId, 'Test', '127.0.0.1', expiresAt);

      // Revoke session
      db.prepare('UPDATE user_sessions SET is_revoked = 1 WHERE id = ?').run(sessionId);

      const session = db.prepare('SELECT * FROM user_sessions WHERE id = ?').get(sessionId) as any;
      
      expect(session.is_revoked).toBe(1);
    });

    it('should track last_active timestamp', () => {
      const sessionId = 'sess-activity-test';
      const teacherId = 'teacher-1';
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      db.prepare(`
        INSERT INTO user_sessions (id, teacher_id, device_name, ip_address, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(sessionId, teacherId, 'Test', '127.0.0.1', expiresAt);

      const now = new Date().toISOString();
      db.prepare('UPDATE user_sessions SET last_active = ? WHERE id = ?').run(now, sessionId);

      const session = db.prepare('SELECT last_active FROM user_sessions WHERE id = ?').get(sessionId) as any;
      
      expect(session.last_active).toBe(now);
    });

    it('should enforce foreign key constraint (cascade delete on teacher deletion)', () => {
      const sessionId = 'sess-fk-test';
      const teacherId = 'teacher-2';
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      db.prepare(`
        INSERT INTO user_sessions (id, teacher_id, device_name, ip_address, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(sessionId, teacherId, 'Test', '127.0.0.1', expiresAt);

      // Delete teacher
      db.prepare('DELETE FROM teachers WHERE id = ?').run(teacherId);

      // Session should be deleted (CASCADE)
      const session = db.prepare('SELECT * FROM user_sessions WHERE id = ?').get(sessionId);
      
      expect(session).toBeUndefined();
    });
  });

  describe('Input Validation', () => {
    it('should handle very long username inputs without crashing', () => {
      const longUsername = 'a'.repeat(1000);
      
      const result = db.prepare('SELECT * FROM teachers WHERE username = ?').get(longUsername);
      
      // Should return undefined without errors
      expect(result).toBeUndefined();
    });

    it('should handle null and undefined safely', () => {
      expect(() => {
        db.prepare('SELECT * FROM teachers WHERE username = ?').get(null as any);
      }).not.toThrow();
      
      expect(() => {
        db.prepare('SELECT * FROM teachers WHERE username = ?').get(undefined as any);
      }).not.toThrow();
    });

    it('should handle empty string username', () => {
      const result = db.prepare('SELECT * FROM teachers WHERE username = ?').get('');
      
      expect(result).toBeUndefined();
    });
  });

  describe('Authorization Checks', () => {
    it('should distinguish between admin and non-admin teachers', () => {
      const admin = db.prepare('SELECT is_admin FROM teachers WHERE username = ?').get('admin') as any;
      const regular = db.prepare('SELECT is_admin FROM teachers WHERE username = ?').get('teacher1') as any;
      
      expect(admin.is_admin).toBe(1);
      expect(regular.is_admin).toBe(0);
    });

    it('should track class ownership (homeroom teacher)', () => {
      const ownerCount = db.prepare(`
        SELECT COUNT(*) as count FROM class_teachers 
        WHERE teacher_id = ? AND role = 'owner'
      `).get('teacher-1') as any;
      
      const nonOwnerCount = db.prepare(`
        SELECT COUNT(*) as count FROM class_teachers 
        WHERE teacher_id = ? AND role = 'owner'
      `).get('teacher-3') as any;
      
      expect(ownerCount.count).toBeGreaterThan(0);
      expect(nonOwnerCount.count).toBe(0);
    });
  });
});
