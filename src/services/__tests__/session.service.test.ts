import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createMockDb, seedMockData } from '../../test/mocks/db';

/**
 * Session Service Tests
 * 
 * Tests for user session management and security.
 */

describe('Session Service', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createMockDb();
    seedMockData(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('insert', () => {
    it('should create a new session', () => {
      const sessionId = 'session-test-1';
      const teacherId = 'teacher-1';
      const deviceName = 'Chrome on Windows';
      const ipAddress = '192.168.1.100';
      const expiresAt = '2025-01-01T00:00:00Z';
      
      db.prepare(`
        INSERT INTO user_sessions (id, teacher_id, device_name, ip_address, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(sessionId, teacherId, deviceName, ipAddress, expiresAt);

      const result = db.prepare('SELECT * FROM user_sessions WHERE id = ?').get(sessionId) as any;
      
      expect(result).toBeDefined();
      expect(result.id).toBe(sessionId);
      expect(result.teacher_id).toBe(teacherId);
      expect(result.device_name).toBe(deviceName);
      expect(result.ip_address).toBe(ipAddress);
    });

    it('should enforce foreign key constraint for teacher_id', () => {
      expect(() => {
        db.prepare(`
          INSERT INTO user_sessions (id, teacher_id, device_name, ip_address, expires_at)
          VALUES (?, ?, ?, ?, ?)
        `).run('session-invalid', 'nonexistent-teacher', 'Device', '127.0.0.1', '2025-01-01T00:00:00Z');
      }).toThrow(); // Should violate FOREIGN KEY constraint
    });

    it('should enforce unique session IDs', () => {
      const sessionId = 'session-duplicate';
      
      db.prepare(`
        INSERT INTO user_sessions (id, teacher_id, device_name, ip_address, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(sessionId, 'teacher-1', 'Device1', '127.0.0.1', '2025-01-01T00:00:00Z');
      
      expect(() => {
        db.prepare(`
          INSERT INTO user_sessions (id, teacher_id, device_name, ip_address, expires_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(sessionId, 'teacher-1', 'Device2', '127.0.0.2', '2025-01-01T00:00:00Z');
      }).toThrow(); // Should violate PRIMARY KEY constraint
    });

    it('should default is_revoked to 0', () => {
      const sessionId = 'session-new';
      
      db.prepare(`
        INSERT INTO user_sessions (id, teacher_id, device_name, ip_address, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(sessionId, 'teacher-1', 'Device', '127.0.0.1', '2025-01-01T00:00:00Z');

      const result = db.prepare('SELECT is_revoked FROM user_sessions WHERE id = ?').get(sessionId) as any;
      
      expect(result.is_revoked).toBe(0);
    });

    it('should store IP address correctly', () => {
      const ipAddress = '192.168.1.50';
      
      db.prepare(`
        INSERT INTO user_sessions (id, teacher_id, device_name, ip_address, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `).run('session-ip', 'teacher-1', 'Device', ipAddress, '2025-01-01T00:00:00Z');

      const result = db.prepare('SELECT ip_address FROM user_sessions WHERE id = ?').get('session-ip') as any;
      
      expect(result.ip_address).toBe(ipAddress);
    });
  });

  describe('get', () => {
    it('should retrieve session by ID', () => {
      const sessionId = 'session-retrieve';
      
      db.prepare(`
        INSERT INTO user_sessions (id, teacher_id, device_name, ip_address, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(sessionId, 'teacher-1', 'Device', '127.0.0.1', '2025-01-01T00:00:00Z');

      const result = db.prepare('SELECT is_revoked, expires_at FROM user_sessions WHERE id = ?').get(sessionId) as any;
      
      expect(result).toBeDefined();
      expect(result.is_revoked).toBeDefined();
      expect(result.expires_at).toBeDefined();
    });

    it('should return undefined for non-existent session', () => {
      const result = db.prepare('SELECT is_revoked, expires_at FROM user_sessions WHERE id = ?').get('nonexistent');
      
      expect(result).toBeUndefined();
    });

    it('should retrieve revoked status correctly', () => {
      const sessionId = 'session-revoked';
      
      db.prepare(`
        INSERT INTO user_sessions (id, teacher_id, device_name, ip_address, expires_at, is_revoked)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(sessionId, 'teacher-1', 'Device', '127.0.0.1', '2025-01-01T00:00:00Z', 1);

      const result = db.prepare('SELECT is_revoked FROM user_sessions WHERE id = ?').get(sessionId) as any;
      
      expect(result.is_revoked).toBe(1);
    });
  });

  describe('updateActivity', () => {
    it('should update last_active timestamp', () => {
      const sessionId = 'session-activity';
      
      // Insert session
      db.prepare(`
        INSERT INTO user_sessions (id, teacher_id, device_name, ip_address, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(sessionId, 'teacher-1', 'Device', '127.0.0.1', '2025-01-01T00:00:00Z');
      
      const before = db.prepare('SELECT last_active FROM user_sessions WHERE id = ?').get(sessionId) as any;
      
      // Small delay to ensure timestamp changes
      const now = new Date().toISOString();
      
      // Update activity
      db.prepare('UPDATE user_sessions SET last_active = ? WHERE id = ?').run(now, sessionId);

      const after = db.prepare('SELECT last_active FROM user_sessions WHERE id = ?').get(sessionId) as any;
      
      expect(after.last_active).not.toBe(before.last_active);
    });

    it('should handle non-existent session gracefully', () => {
      // Should not throw error
      expect(() => {
        db.prepare('UPDATE user_sessions SET last_active = ? WHERE id = ?').run(
          new Date().toISOString(), 'nonexistent'
        );
      }).not.toThrow();
    });
  });

  describe('deleteExpired', () => {
    it('should delete expired sessions', () => {
      const expiredSessionId = 'session-expired';
      const activeSessionId = 'session-active';
      const pastDate = '2020-01-01T00:00:00Z';
      const futureDate = '2030-01-01T00:00:00Z';
      
      // Insert expired session
      db.prepare(`
        INSERT INTO user_sessions (id, teacher_id, device_name, ip_address, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(expiredSessionId, 'teacher-1', 'Device1', '127.0.0.1', pastDate);
      
      // Insert active session
      db.prepare(`
        INSERT INTO user_sessions (id, teacher_id, device_name, ip_address, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(activeSessionId, 'teacher-1', 'Device2', '127.0.0.2', futureDate);
      
      // Delete expired sessions
      db.prepare('DELETE FROM user_sessions WHERE expires_at < ?').run(new Date().toISOString());

      const expired = db.prepare('SELECT * FROM user_sessions WHERE id = ?').get(expiredSessionId);
      const active = db.prepare('SELECT * FROM user_sessions WHERE id = ?').get(activeSessionId);
      
      expect(expired).toBeUndefined();
      expect(active).toBeDefined();
    });

    it('should not delete active sessions', () => {
      const futureDate = '2030-01-01T00:00:00Z';
      
      db.prepare(`
        INSERT INTO user_sessions (id, teacher_id, device_name, ip_address, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `).run('session-future', 'teacher-1', 'Device', '127.0.0.1', futureDate);
      
      // Delete expired
      db.prepare('DELETE FROM user_sessions WHERE expires_at < ?').run(new Date().toISOString());

      const result = db.prepare('SELECT * FROM user_sessions WHERE id = ?').get('session-future');
      
      expect(result).toBeDefined();
    });
  });

  describe('getByTeacher', () => {
    it('should retrieve all sessions for a teacher', () => {
      const teacherId = 'teacher-1';
      
      // Insert multiple sessions
      db.prepare(`
        INSERT INTO user_sessions (id, teacher_id, device_name, ip_address, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `).run('session-1', teacherId, 'Device1', '127.0.0.1', '2025-01-01T00:00:00Z');
      
      db.prepare(`
        INSERT INTO user_sessions (id, teacher_id, device_name, ip_address, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `).run('session-2', teacherId, 'Device2', '127.0.0.2', '2025-01-01T00:00:00Z');

      const results = db.prepare(`
        SELECT id, device_name, ip_address, created_at, last_active, expires_at, is_revoked 
        FROM user_sessions 
        WHERE teacher_id = ? 
        ORDER BY created_at DESC
      `).all(teacherId);
      
      expect(results).toHaveLength(2);
    });

    it('should return empty array for teacher with no sessions', () => {
      const results = db.prepare(`
        SELECT * FROM user_sessions WHERE teacher_id = ?
      `).all('teacher-3');
      
      expect(results).toHaveLength(0);
    });

    it('should order sessions by created_at DESC', () => {
      const teacherId = 'teacher-1';
      
      // Insert sessions with different timestamps
      db.prepare(`
        INSERT INTO user_sessions (id, teacher_id, device_name, ip_address, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('session-old', teacherId, 'Device1', '127.0.0.1', '2025-01-01T00:00:00Z', '2024-01-01T00:00:00Z');
      
      db.prepare(`
        INSERT INTO user_sessions (id, teacher_id, device_name, ip_address, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('session-new', teacherId, 'Device2', '127.0.0.2', '2025-01-01T00:00:00Z', '2024-06-01T00:00:00Z');

      const results = db.prepare(`
        SELECT id FROM user_sessions 
        WHERE teacher_id = ? 
        ORDER BY created_at DESC
      `).all(teacherId) as any[];
      
      expect(results[0].id).toBe('session-new');
      expect(results[1].id).toBe('session-old');
    });

    it('should include both revoked and active sessions', () => {
      const teacherId = 'teacher-1';
      
      db.prepare(`
        INSERT INTO user_sessions (id, teacher_id, device_name, ip_address, expires_at, is_revoked)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('session-active', teacherId, 'Device1', '127.0.0.1', '2025-01-01T00:00:00Z', 0);
      
      db.prepare(`
        INSERT INTO user_sessions (id, teacher_id, device_name, ip_address, expires_at, is_revoked)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('session-revoked', teacherId, 'Device2', '127.0.0.2', '2025-01-01T00:00:00Z', 1);

      const results = db.prepare('SELECT * FROM user_sessions WHERE teacher_id = ?').all(teacherId);
      
      expect(results).toHaveLength(2);
    });
  });

  describe('revokeAll', () => {
    it('should revoke all sessions for a teacher', () => {
      const teacherId = 'teacher-1';
      
      // Insert multiple sessions
      db.prepare(`
        INSERT INTO user_sessions (id, teacher_id, device_name, ip_address, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `).run('session-1', teacherId, 'Device1', '127.0.0.1', '2025-01-01T00:00:00Z');
      
      db.prepare(`
        INSERT INTO user_sessions (id, teacher_id, device_name, ip_address, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `).run('session-2', teacherId, 'Device2', '127.0.0.2', '2025-01-01T00:00:00Z');
      
      // Revoke all
      db.prepare('UPDATE user_sessions SET is_revoked = 1 WHERE teacher_id = ?').run(teacherId);

      const results = db.prepare('SELECT is_revoked FROM user_sessions WHERE teacher_id = ?').all(teacherId) as any[];
      
      expect(results).toHaveLength(2);
      expect(results.every(s => s.is_revoked === 1)).toBe(true);
    });

    it('should not affect other teachers sessions', () => {
      // Insert sessions for multiple teachers
      db.prepare(`
        INSERT INTO user_sessions (id, teacher_id, device_name, ip_address, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `).run('session-t1', 'teacher-1', 'Device', '127.0.0.1', '2025-01-01T00:00:00Z');
      
      db.prepare(`
        INSERT INTO user_sessions (id, teacher_id, device_name, ip_address, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `).run('session-t2', 'teacher-2', 'Device', '127.0.0.1', '2025-01-01T00:00:00Z');
      
      // Revoke only teacher-1
      db.prepare('UPDATE user_sessions SET is_revoked = 1 WHERE teacher_id = ?').run('teacher-1');

      const teacher1 = db.prepare('SELECT is_revoked FROM user_sessions WHERE id = ?').get('session-t1') as any;
      const teacher2 = db.prepare('SELECT is_revoked FROM user_sessions WHERE id = ?').get('session-t2') as any;
      
      expect(teacher1.is_revoked).toBe(1);
      expect(teacher2.is_revoked).toBe(0);
    });
  });

  describe('revoke', () => {
    it('should revoke a specific session', () => {
      const sessionId = 'session-to-revoke';
      
      db.prepare(`
        INSERT INTO user_sessions (id, teacher_id, device_name, ip_address, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(sessionId, 'teacher-1', 'Device', '127.0.0.1', '2025-01-01T00:00:00Z');
      
      // Revoke
      db.prepare('UPDATE user_sessions SET is_revoked = 1 WHERE id = ?').run(sessionId);

      const result = db.prepare('SELECT is_revoked FROM user_sessions WHERE id = ?').get(sessionId) as any;
      
      expect(result.is_revoked).toBe(1);
    });

    it('should not affect other sessions', () => {
      db.prepare(`
        INSERT INTO user_sessions (id, teacher_id, device_name, ip_address, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `).run('session-revoke', 'teacher-1', 'Device1', '127.0.0.1', '2025-01-01T00:00:00Z');
      
      db.prepare(`
        INSERT INTO user_sessions (id, teacher_id, device_name, ip_address, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `).run('session-keep', 'teacher-1', 'Device2', '127.0.0.2', '2025-01-01T00:00:00Z');
      
      // Revoke only one
      db.prepare('UPDATE user_sessions SET is_revoked = 1 WHERE id = ?').run('session-revoke');

      const revoked = db.prepare('SELECT is_revoked FROM user_sessions WHERE id = ?').get('session-revoke') as any;
      const kept = db.prepare('SELECT is_revoked FROM user_sessions WHERE id = ?').get('session-keep') as any;
      
      expect(revoked.is_revoked).toBe(1);
      expect(kept.is_revoked).toBe(0);
    });

    it('should handle non-existent session gracefully', () => {
      // Should not throw error
      expect(() => {
        db.prepare('UPDATE user_sessions SET is_revoked = 1 WHERE id = ?').run('nonexistent');
      }).not.toThrow();
    });
  });

  describe('cascade delete', () => {
    it('should delete sessions when teacher is deleted', () => {
      const teacherId = 'teacher-1';
      
      // Insert session
      db.prepare(`
        INSERT INTO user_sessions (id, teacher_id, device_name, ip_address, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `).run('session-cascade', teacherId, 'Device', '127.0.0.1', '2025-01-01T00:00:00Z');
      
      // Verify session exists
      const before = db.prepare('SELECT COUNT(*) as count FROM user_sessions WHERE teacher_id = ?').get(teacherId) as any;
      expect(before.count).toBeGreaterThan(0);
      
      // Delete teacher
      db.prepare('DELETE FROM teachers WHERE id = ?').run(teacherId);

      // Sessions should be deleted (CASCADE)
      const after = db.prepare('SELECT COUNT(*) as count FROM user_sessions WHERE teacher_id = ?').get(teacherId) as any;
      expect(after.count).toBe(0);
    });
  });

  describe('data integrity', () => {
    it('should require teacher_id', () => {
      expect(() => {
        db.prepare(`
          INSERT INTO user_sessions (id, device_name, ip_address, expires_at)
          VALUES (?, ?, ?, ?)
        `).run('session-no-teacher', 'Device', '127.0.0.1', '2025-01-01T00:00:00Z');
      }).toThrow(); // Should fail NOT NULL constraint
    });

    it('should require expires_at', () => {
      expect(() => {
        db.prepare(`
          INSERT INTO user_sessions (id, teacher_id, device_name, ip_address)
          VALUES (?, ?, ?, ?)
        `).run('session-no-expiry', 'teacher-1', 'Device', '127.0.0.1');
      }).toThrow(); // Should fail NOT NULL constraint
    });

    it('should handle long device names', () => {
      const longDevice = 'A'.repeat(200);
      
      db.prepare(`
        INSERT INTO user_sessions (id, teacher_id, device_name, ip_address, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `).run('session-long-device', 'teacher-1', longDevice, '127.0.0.1', '2025-01-01T00:00:00Z');

      const result = db.prepare('SELECT device_name FROM user_sessions WHERE id = ?').get('session-long-device') as any;
      
      expect(result.device_name).toBe(longDevice);
    });

    it('should handle IPv6 addresses', () => {
      const ipv6 = '2001:0db8:85a3:0000:0000:8a2e:0370:7334';
      
      db.prepare(`
        INSERT INTO user_sessions (id, teacher_id, device_name, ip_address, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `).run('session-ipv6', 'teacher-1', 'Device', ipv6, '2025-01-01T00:00:00Z');

      const result = db.prepare('SELECT ip_address FROM user_sessions WHERE id = ?').get('session-ipv6') as any;
      
      expect(result.ip_address).toBe(ipv6);
    });
  });
});
