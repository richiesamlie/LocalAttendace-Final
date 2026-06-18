import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { join } from 'path';
import { tmpdir } from 'os';
import { unlinkSync, existsSync, readFileSync } from 'fs';

process.env.DEFAULT_ADMIN_PASSWORD ??= 'test-default-admin-password';

describe('RES-1: ISO 8601 datetime comparison bug', () => {
  let db: Database.Database;
  let dbPath: string;

  beforeAll(() => {
    dbPath = join(tmpdir(), `res1-test-${Date.now()}.sqlite`);
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    // Mirror the actual schema
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id TEXT PRIMARY KEY,
        teacher_id TEXT,
        expires_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS invite_codes (
        code TEXT PRIMARY KEY,
        expires_at TEXT NOT NULL
      );
    `);
  });

  afterAll(() => {
    db.close();
    if (existsSync(dbPath)) unlinkSync(dbPath);
    // Clean up WAL files
    for (const suffix of ['-shm', '-wal']) {
      const p = dbPath + suffix;
      if (existsSync(p)) unlinkSync(p);
    }
  });

  describe('user_sessions.deleteExpiredSessions', () => {
    it('deletes an expired session stored as ISO 8601 string', () => {
      // Insert a row with an ISO 8601 timestamp that's clearly in the past
      // (the bug: original SQL used `expires_at < datetime('now')` which
      // compares the ISO string against SQLite's native datetime output,
      // and string comparison fails because 'T' > ' ' in ASCII.
      const isoPast = '2020-01-01T00:00:00.000Z'; // 6+ years ago
      db.prepare(
        'INSERT INTO user_sessions (id, teacher_id, expires_at) VALUES (?, ?, ?)'
      ).run('sess-old', 'teacher-1', isoPast);

      // Verify it's there
      const before = db.prepare('SELECT COUNT(*) as count FROM user_sessions WHERE id = ?').get('sess-old') as { count: number };
      expect(before.count).toBe(1);

      // Run the FIXED prepared statement
      const result = db.prepare(
        "DELETE FROM user_sessions WHERE datetime(expires_at) < datetime('now')"
      ).run();
      expect(result.changes).toBe(1);

      // Verify it's gone
      const after = db.prepare('SELECT COUNT(*) as count FROM user_sessions WHERE id = ?').get('sess-old') as { count: number };
      expect(after.count).toBe(0);
    });

    it('does NOT delete a future ISO 8601 session', () => {
      // Insert a future ISO timestamp (5 years from now)
      const isoFuture = '2030-01-01T00:00:00.000Z';
      db.prepare(
        'INSERT INTO user_sessions (id, teacher_id, expires_at) VALUES (?, ?, ?)'
      ).run('sess-future', 'teacher-2', isoFuture);

      // Run the FIXED prepared statement
      const result = db.prepare(
        "DELETE FROM user_sessions WHERE datetime(expires_at) < datetime('now')"
      ).run();
      expect(result.changes).toBe(0); // should not delete the future one

      // Verify the future session is still there
      const after = db.prepare('SELECT COUNT(*) as count FROM user_sessions WHERE id = ?').get('sess-future') as { count: number };
      expect(after.count).toBe(1);

      // Cleanup
      db.prepare('DELETE FROM user_sessions WHERE id = ?').run('sess-future');
    });
  });

  describe('invite_codes.deleteExpiredInviteCodes', () => {
    it('deletes an expired invite code stored as ISO 8601 string', () => {
      const isoPast = '2020-06-15T12:30:00.000Z';
      db.prepare(
        'INSERT INTO invite_codes (code, expires_at) VALUES (?, ?)'
      ).run('inv-old', isoPast);

      const result = db.prepare(
        "DELETE FROM invite_codes WHERE datetime(expires_at) < datetime('now')"
      ).run();
      expect(result.changes).toBe(1);

      const after = db.prepare('SELECT COUNT(*) as count FROM invite_codes WHERE code = ?').get('inv-old') as { count: number };
      expect(after.count).toBe(0);
    });

    it('does NOT delete a future invite code', () => {
      const isoFuture = '2030-12-31T23:59:59.999Z';
      db.prepare(
        'INSERT INTO invite_codes (code, expires_at) VALUES (?, ?)'
      ).run('inv-future', isoFuture);

      const result = db.prepare(
        "DELETE FROM invite_codes WHERE datetime(expires_at) < datetime('now')"
      ).run();
      expect(result.changes).toBe(0);

      const after = db.prepare('SELECT COUNT(*) as count FROM invite_codes WHERE code = ?').get('inv-future') as { count: number };
      expect(after.count).toBe(1);

      // Cleanup
      db.prepare('DELETE FROM invite_codes WHERE code = ?').run('inv-future');
    });
  });

  describe('regression: the BROKEN query (without datetime() wrapper)', () => {
    it('fails to delete a same-day past ISO 8601 session — proves the bug', () => {
      // Use a SAME-DAY past timestamp so the string comparison diverges
      // from the logical comparison. Today at midnight (00:00:00Z) is
      // logically in the past, but string compares GREATER than the
      // SQLite native format for the current time because:
      //   ISO 8601: '2026-06-18T00:00:00.000Z' (midnight today)
      //   Native : '2026-06-18 12:34:56'       (some time today)
      // At position 10: ISO has 'T' (0x54), Native has ' ' (0x20).
      // Since 0x54 > 0x20, the ISO string compares GREATER than the
      // native string, so the broken query thinks the row is NOT
      // expired and fails to delete it.
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0); // midnight today (UTC)
      const isoSameDayPast = today.toISOString();

      // Sanity: ensure the timestamp is logically in the past (it is,
      // unless the test runs at exactly midnight UTC).
      expect(new Date(isoSameDayPast).getTime()).toBeLessThanOrEqual(Date.now());

      db.prepare(
        'INSERT INTO user_sessions (id, teacher_id, expires_at) VALUES (?, ?, ?)'
      ).run('sess-bug-demo', 'teacher-3', isoSameDayPast);

      // Run the BROKEN prepared statement (no datetime() wrapper)
      const brokenResult = db.prepare(
        "DELETE FROM user_sessions WHERE expires_at < datetime('now')"
      ).run();
      // The broken query deletes 0 rows — the bug!
      expect(brokenResult.changes).toBe(0);

      // Verify the row is still there (because the bug failed to delete it)
      const afterBroken = db.prepare('SELECT COUNT(*) as count FROM user_sessions WHERE id = ?').get('sess-bug-demo') as { count: number };
      expect(afterBroken.count).toBe(1);

      // Now run the FIXED prepared statement on the same row
      const fixedResult = db.prepare(
        "DELETE FROM user_sessions WHERE datetime(expires_at) < datetime('now')"
      ).run();
      // The fixed query correctly identifies the row as expired and deletes it
      expect(fixedResult.changes).toBe(1);

      // Verify the row is now gone
      const afterFixed = db.prepare('SELECT COUNT(*) as count FROM user_sessions WHERE id = ?').get('sess-bug-demo') as { count: number };
      expect(afterFixed.count).toBe(0);
    });
  });
});

describe('RES-1 source fix is in place', () => {
  function findRepoRoot(): string {
    let dir = __dirname;
    for (let i = 0; i < 10; i++) {
      if (existsSync(join(dir, 'server.ts'))) return dir;
      const parent = join(dir, '..');
      if (parent === dir) break;
      dir = parent;
    }
    return process.cwd();
  }
  const repoRoot = findRepoRoot();

  it('src/db/statements.ts uses datetime() wrapper on deleteExpiredInviteCodes', () => {
    const src = readFileSync(join(repoRoot, 'src/db/statements.ts'), 'utf8');
    expect(src).toMatch(/deleteExpiredInviteCodes[\s\S]{0,200}datetime\(expires_at\)/);
  });

  it('src/db/statements.ts uses datetime() wrapper on deleteExpiredSessions', () => {
    const src = readFileSync(join(repoRoot, 'src/db/statements.ts'), 'utf8');
    expect(src).toMatch(/deleteExpiredSessions[\s\S]{0,200}datetime\(expires_at\)/);
  });
});