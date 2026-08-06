import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createMockDb, seedMockData } from '../../test/mocks/db';

interface RefreshTokenRow {
  id: string;
  family_id: string;
  token_hash: string;
  teacher_id: string;
  session_id: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  rotated_to: string | null;
}

interface CountRow {
  count: number;
}

// The refreshTokenService uses the global db singleton, so we need to
// mock it. We'll test the SQL logic directly against the in-memory DB.

describe('Refresh Token Service', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createMockDb();
    seedMockData(db);
    // Insert a session for refresh token FK references
    db.prepare(
      'INSERT INTO user_sessions (id, teacher_id, device_name, ip_address, expires_at) VALUES (?, ?, ?, ?, ?)'
    ).run('session-1', 'teacher-1', 'Test Device', '127.0.0.1', '2030-01-01T00:00:00Z');
  });

  afterEach(() => {
    db.close();
  });

  describe('token insertion and lookup', () => {
    it('should insert a refresh token and retrieve it by hash', () => {
      const id = 'rt-1';
      const familyId = 'fam-1';
      const tokenHash = 'abc123hash';
      const teacherId = 'teacher-1';
      const sessionId = 'session-1';
      const expiresAt = '2030-01-01T00:00:00Z';

      db.prepare(
        'INSERT INTO refresh_tokens (id, family_id, token_hash, teacher_id, session_id, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(id, familyId, tokenHash, teacherId, sessionId, expiresAt);

      const row = db.prepare('SELECT * FROM refresh_tokens WHERE token_hash = ?').get(tokenHash) as RefreshTokenRow | undefined;
      expect(row).toBeDefined();
      expect(row!.id).toBe(id);
      expect(row!.family_id).toBe(familyId);
      expect(row!.teacher_id).toBe(teacherId);
      expect(row!.used_at).toBeNull();
      expect(row!.rotated_to).toBeNull();
    });

    it('should enforce UNIQUE constraint on token_hash', () => {
      db.prepare(
        'INSERT INTO refresh_tokens (id, family_id, token_hash, teacher_id, session_id, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run('rt-1', 'fam-1', 'hash1', 'teacher-1', 'session-1', '2030-01-01T00:00:00Z');

      expect(() => {
        db.prepare(
          'INSERT INTO refresh_tokens (id, family_id, token_hash, teacher_id, session_id, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).run('rt-2', 'fam-1', 'hash1', 'teacher-1', 'session-1', '2030-01-01T00:00:00Z');
      }).toThrow();
    });
  });

  describe('rotation', () => {
    it('should mark old token as used and link to successor', () => {
      db.prepare(
        'INSERT INTO refresh_tokens (id, family_id, token_hash, teacher_id, session_id, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run('rt-old', 'fam-1', 'hash-old', 'teacher-1', 'session-1', '2030-01-01T00:00:00Z');

      db.prepare(
        'INSERT INTO refresh_tokens (id, family_id, token_hash, teacher_id, session_id, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run('rt-new', 'fam-1', 'hash-new', 'teacher-1', 'session-1', '2030-01-01T00:00:00Z');

      const info = db.prepare(
        'UPDATE refresh_tokens SET used_at = CURRENT_TIMESTAMP, rotated_to = ? WHERE id = ? AND used_at IS NULL'
      ).run('rt-new', 'rt-old') as { changes: number };
      expect(info.changes).toBe(1);

      const old = db.prepare('SELECT * FROM refresh_tokens WHERE id = ?').get('rt-old') as RefreshTokenRow | undefined;
      expect(old).toBeDefined();
      expect(old!.used_at).not.toBeNull();
      expect(old!.rotated_to).toBe('rt-new');
    });

    it('should not rotate an already-used token (race condition)', () => {
      db.prepare(
        'INSERT INTO refresh_tokens (id, family_id, token_hash, teacher_id, session_id, expires_at, used_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)'
      ).run('rt-used', 'fam-1', 'hash-used', 'teacher-1', 'session-1', '2030-01-01T00:00:00Z');

      const info = db.prepare(
        'UPDATE refresh_tokens SET used_at = CURRENT_TIMESTAMP, rotated_to = ? WHERE id = ? AND used_at IS NULL'
      ).run('rt-new', 'rt-used') as { changes: number };
      expect(info.changes).toBe(0);
    });
  });

  describe('family revocation', () => {
    it('should revoke all tokens in a family', () => {
      for (let i = 1; i <= 3; i++) {
        db.prepare(
          'INSERT INTO refresh_tokens (id, family_id, token_hash, teacher_id, session_id, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(`rt-${i}`, 'fam-1', `hash-${i}`, 'teacher-1', 'session-1', '2030-01-01T00:00:00Z');
      }

      db.prepare('UPDATE refresh_tokens SET used_at = CURRENT_TIMESTAMP WHERE family_id = ?').run('fam-1');

      const active = db.prepare('SELECT COUNT(*) as count FROM refresh_tokens WHERE family_id = ? AND used_at IS NULL').get('fam-1') as CountRow;
      expect(active.count).toBe(0);
    });

    it('should not affect tokens in other families', () => {
      db.prepare(
        'INSERT INTO refresh_tokens (id, family_id, token_hash, teacher_id, session_id, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run('rt-1', 'fam-1', 'hash-1', 'teacher-1', 'session-1', '2030-01-01T00:00:00Z');
      db.prepare(
        'INSERT INTO refresh_tokens (id, family_id, token_hash, teacher_id, session_id, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run('rt-2', 'fam-2', 'hash-2', 'teacher-1', 'session-1', '2030-01-01T00:00:00Z');

      db.prepare('UPDATE refresh_tokens SET used_at = CURRENT_TIMESTAMP WHERE family_id = ?').run('fam-1');

      const other = db.prepare('SELECT * FROM refresh_tokens WHERE id = ?').get('rt-2') as RefreshTokenRow | undefined;
      expect(other).toBeDefined();
      expect(other!.used_at).toBeNull();
    });
  });

  describe('cleanup', () => {
    it('should delete expired tokens', () => {
      db.prepare(
        'INSERT INTO refresh_tokens (id, family_id, token_hash, teacher_id, session_id, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run('rt-expired', 'fam-1', 'hash-exp', 'teacher-1', 'session-1', '2020-01-01T00:00:00Z');

      db.prepare(
        'INSERT INTO refresh_tokens (id, family_id, token_hash, teacher_id, session_id, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run('rt-valid', 'fam-2', 'hash-valid', 'teacher-1', 'session-1', '2030-01-01T00:00:00Z');

      db.prepare("DELETE FROM refresh_tokens WHERE datetime(expires_at) < datetime('now')").run();

      const remaining = db.prepare('SELECT COUNT(*) as count FROM refresh_tokens').get() as CountRow;
      expect(remaining.count).toBe(1);

      const valid = db.prepare('SELECT * FROM refresh_tokens WHERE id = ?').get('rt-valid') as RefreshTokenRow | undefined;
      expect(valid).toBeDefined();
    });
  });

  describe('active token counting', () => {
    it('should count only active (unused, unexpired) tokens', () => {
      db.prepare(
        'INSERT INTO refresh_tokens (id, family_id, token_hash, teacher_id, session_id, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run('rt-active', 'fam-1', 'hash-active', 'teacher-1', 'session-1', '2030-01-01T00:00:00Z');

      db.prepare(
        'INSERT INTO refresh_tokens (id, family_id, token_hash, teacher_id, session_id, expires_at, used_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)'
      ).run('rt-used', 'fam-2', 'hash-used', 'teacher-1', 'session-1', '2030-01-01T00:00:00Z');

      db.prepare(
        'INSERT INTO refresh_tokens (id, family_id, token_hash, teacher_id, session_id, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run('rt-expired', 'fam-3', 'hash-exp', 'teacher-1', 'session-1', '2020-01-01T00:00:00Z');

      const count = db.prepare(
        "SELECT COUNT(*) as count FROM refresh_tokens WHERE teacher_id = ? AND used_at IS NULL AND expires_at > datetime('now')"
      ).get('teacher-1') as CountRow;
      expect(count.count).toBe(1);
    });
  });
});
