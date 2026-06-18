import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';
import db from '../../../db';
import { refreshTokenService, sessionService } from '../../../services';

process.env.DEFAULT_ADMIN_PASSWORD ??= 'test-default-admin-password';

describe('refresh-token rotation (F-004)', () => {
  let teacherId: string;
  let sessionId: string;
  let sessionExpiresAt: string;

  beforeEach(async () => {
    teacherId = `tch-refresh-${randomUUID().slice(0, 8)}`;
    sessionId = `sess-refresh-${randomUUID()}`;
    sessionExpiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const passwordHash = bcrypt.hashSync('password123', 10);
    db.prepare(
      'INSERT INTO teachers (id, username, password_hash, name, is_admin) VALUES (?, ?, ?, ?, ?)'
    ).run(teacherId, `${teacherId}-user`, passwordHash, 'Refresh Tester', 0);

    await sessionService.insert(sessionId, teacherId, 'vitest', '127.0.0.1', sessionExpiresAt);
  });

  afterEach(() => {
    // Best-effort cleanup of test fixtures. Each DELETE may fail if the
    // row was already removed by a prior cleanup; we ignore those.
    try {
      db.prepare('DELETE FROM refresh_tokens WHERE teacher_id = ?').run(teacherId);
    } catch (_ignore) {
      // expected when row already gone
    }
    try {
      db.prepare('DELETE FROM user_sessions WHERE teacher_id = ?').run(teacherId);
    } catch (_ignore) {
      // expected when row already gone
    }
    try {
      db.prepare('DELETE FROM teachers WHERE id = ?').run(teacherId);
    } catch (_ignore) {
      // expected when row already gone
    }
  });

  describe('issue + findByRawValue', () => {
    it('issues a refresh token with the rt_ prefix and 64-hex format', () => {
      const t = refreshTokenService.issue(teacherId, sessionId);
      expect(t.rawValue).toMatch(/^rt_[a-f0-9]{64}$/);
      expect(t.familyId).toBeDefined();
      expect(t.expiresAt).toBeDefined();
    });

    it('findByRawValue returns null for unknown token', async () => {
      const result = await refreshTokenService.findByRawValue('rt_nonexistent');
      expect(result).toBeNull();
    });

    it('findByRawValue returns null for malformed token (missing prefix)', async () => {
      const t = refreshTokenService.issue(teacherId, sessionId);
      const malformed = t.rawValue.replace('rt_', '');
      expect(await refreshTokenService.findByRawValue(malformed)).toBeNull();
    });

    it('findByRawValue returns the row for a fresh token', async () => {
      const t = refreshTokenService.issue(teacherId, sessionId);
      const row = await refreshTokenService.findByRawValue(t.rawValue);
      expect(row).not.toBeNull();
      expect(row?.id).toBe(t.id);
      expect(row?.family_id).toBe(t.familyId);
      expect(row?.teacher_id).toBe(teacherId);
      expect(row?.session_id).toBe(sessionId);
      expect(row?.used_at).toBeNull();
    });
  });

  describe('rotation', () => {
    it('rotates successfully on first call', () => {
      const old = refreshTokenService.issue(teacherId, sessionId);
      const successor = refreshTokenService.issue(teacherId, sessionId, old.familyId);
      const won = refreshTokenService.rotate(old.id, successor.id);
      expect(won).toBe(true);
    });

    it('returns false when rotating an already-used token (race lost)', () => {
      const old = refreshTokenService.issue(teacherId, sessionId);
      const successor1 = refreshTokenService.issue(teacherId, sessionId, old.familyId);
      const successor2 = refreshTokenService.issue(teacherId, sessionId, old.familyId);

      const first = refreshTokenService.rotate(old.id, successor1.id);
      expect(first).toBe(true);

      const second = refreshTokenService.rotate(old.id, successor2.id);
      expect(second).toBe(false);
    });

    it('two concurrent rotations of same token — exactly one wins', () => {
      const old = refreshTokenService.issue(teacherId, sessionId);
      const a = refreshTokenService.issue(teacherId, sessionId, old.familyId);

      const [r1, r2] = [refreshTokenService.rotate(old.id, a.id),
                        refreshTokenService.rotate(old.id, a.id)];
      const winners = [r1, r2].filter(x => x === true).length;
      const losers = [r1, r2].filter(x => x === false).length;
      expect(winners).toBe(1);
      expect(losers).toBe(1);
    });

    it('marks used_at after successful rotation', async () => {
      const old = refreshTokenService.issue(teacherId, sessionId);
      const successor = refreshTokenService.issue(teacherId, sessionId, old.familyId);
      refreshTokenService.rotate(old.id, successor.id);

      const row = await refreshTokenService.findByRawValue(old.rawValue);
      expect(row?.used_at).not.toBeNull();
      expect(row?.rotated_to).toBe(successor.id);
    });
  });

  describe('revokeFamily (reuse detection)', () => {
    it('marks every token in a family as used', async () => {
      const a = refreshTokenService.issue(teacherId, sessionId);
      const b = refreshTokenService.issue(teacherId, sessionId, a.familyId);
      const c = refreshTokenService.issue(teacherId, sessionId, a.familyId);

      refreshTokenService.revokeFamily(a.familyId);

      const rowA = await refreshTokenService.findByRawValue(a.rawValue);
      const rowB = await refreshTokenService.findByRawValue(b.rawValue);
      const rowC = await refreshTokenService.findByRawValue(c.rawValue);

      expect(rowA?.used_at).not.toBeNull();
      expect(rowB?.used_at).not.toBeNull();
      expect(rowC?.used_at).not.toBeNull();
    });

    it('does not affect tokens in a different family', async () => {
      const a = refreshTokenService.issue(teacherId, sessionId);
      const b = refreshTokenService.issue(teacherId, sessionId);

      refreshTokenService.revokeFamily(a.familyId);

      const rowA = await refreshTokenService.findByRawValue(a.rawValue);
      const rowB = await refreshTokenService.findByRawValue(b.rawValue);

      expect(rowA?.used_at).not.toBeNull();
      expect(rowB?.used_at).toBeNull();
    });

    it('is idempotent (calling twice does not error)', () => {
      const a = refreshTokenService.issue(teacherId, sessionId);
      refreshTokenService.revokeFamily(a.familyId);
      expect(() => refreshTokenService.revokeFamily(a.familyId)).not.toThrow();
    });
  });

  describe('expiry', () => {
    it('cleanup deletes tokens whose expires_at is in the past', async () => {
      // Insert a row directly with a past expires_at to simulate an
      // expired token without waiting for the real 7-day TTL.
      const id = randomUUID();
      const familyId = randomUUID();
      const tokenHash = 'fakehash-' + randomUUID().slice(0, 8);
      const pastExpiry = new Date(Date.now() - 60_000).toISOString();
      db.prepare(
        'INSERT INTO refresh_tokens (id, family_id, token_hash, teacher_id, session_id, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(id, familyId, tokenHash, teacherId, sessionId, pastExpiry);

      const before = db.prepare('SELECT * FROM refresh_tokens WHERE id = ?').get(id) as
        { expires_at: string } | undefined;
      expect(before).toBeDefined();
      expect(before?.expires_at).toBe(pastExpiry);

      // Run cleanup — the past-expired row should be removed.
      await refreshTokenService.cleanup();

      const after = db.prepare('SELECT * FROM refresh_tokens WHERE id = ?').get(id);
      expect(after).toBeUndefined();
    });
  });

  describe('countActiveForTeacher', () => {
    it('counts unused, unexpired tokens only', async () => {
      const a = refreshTokenService.issue(teacherId, sessionId);
      // _b is unused-but-needed: keeps two distinct tokens in DB so the
      // count assertion is meaningful (2 active vs 1 if we omitted it).
      const _b = refreshTokenService.issue(teacherId, sessionId);

      // Rotate a → it's now used
      const c = refreshTokenService.issue(teacherId, sessionId, a.familyId);
      refreshTokenService.rotate(a.id, c.id);

      const count = await refreshTokenService.countActiveForTeacher(teacherId);
      // _b and c are active; a is used
      expect(count).toBe(2);
    });

    it('returns 0 for a teacher with no tokens', async () => {
      const count = await refreshTokenService.countActiveForTeacher('tch-no-tokens-here');
      expect(count).toBe(0);
    });
  });

  describe('integration: reuse detection in rotation flow', () => {
    it('a refresh token presented after rotation triggers family revocation', async () => {
      // Simulate the full refresh flow:
      // 1. issue A
      // 2. rotate A → issue B (A.used_at set)
      // 3. present A again → reuse detected → revoke entire family

      const A = refreshTokenService.issue(teacherId, sessionId);
      const B = refreshTokenService.issue(teacherId, sessionId, A.familyId);
      expect(refreshTokenService.rotate(A.id, B.id)).toBe(true);

      // Reuse: present A again
      const reusedRow = await refreshTokenService.findByRawValue(A.rawValue);
      expect(reusedRow?.used_at).not.toBeNull();

      // The /refresh route would call revokeFamily at this point
      refreshTokenService.revokeFamily(A.familyId);

      // Now B is also revoked (whole family)
      const rowB = await refreshTokenService.findByRawValue(B.rawValue);
      expect(rowB?.used_at).not.toBeNull();
    });
  });
});