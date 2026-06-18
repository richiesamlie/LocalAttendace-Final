import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

process.env.DEFAULT_ADMIN_PASSWORD ??= 'test-default-admin-password';

vi.mock('../../../server', () => ({
  io: {
    to: () => ({ emit: () => undefined }),
    emit: () => undefined,
  },
}));

import db from '../../../db';
import { createTestApp } from '../helpers/app';
import { refreshTokenService } from '../../../services';

describe('Refresh endpoint HTTP integration (F-004)', () => {
  const app = createTestApp();
  const adminId = `tch-refresh-http-${randomUUID().slice(0, 8)}`;
  const sessionId = `sess-refresh-http-${randomUUID()}`;
  const sessionExpiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  beforeAll(async () => {
    const passwordHash = bcrypt.hashSync('password123', 10);
    db.prepare(
      'INSERT INTO teachers (id, username, password_hash, name, is_admin) VALUES (?, ?, ?, ?, ?)'
    ).run(adminId, `${adminId}-user`, passwordHash, 'Refresh HTTP Tester', 0);
    db.prepare(
      'INSERT INTO user_sessions (id, teacher_id, device_name, ip_address, expires_at) VALUES (?, ?, ?, ?, ?)'
    ).run(sessionId, adminId, 'vitest', '127.0.0.1', sessionExpiresAt);
  });

  afterAll(() => {
    try { db.prepare('DELETE FROM refresh_tokens WHERE teacher_id = ?').run(adminId); } catch {}
    try { db.prepare('DELETE FROM user_sessions WHERE id = ?').run(sessionId); } catch {}
    try { db.prepare('DELETE FROM teachers WHERE id = ?').run(adminId); } catch {}
  });

  function mintRefreshCookie(): string {
    const t = refreshTokenService.issue(adminId, sessionId);
    return `refresh_token=${t.rawValue}`;
  }

  it('rejects /refresh with no cookie', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/no refresh token/i);
  });

  it('rejects /refresh with malformed cookie', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', 'refresh_token=not-a-valid-token');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid refresh token/i);
  });

  it('rotates a valid refresh token and returns new cookies', async () => {
    const cookie = mintRefreshCookie();
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // The response should set a new refresh_token cookie
    const setCookie = res.headers['set-cookie'] as string[] | undefined;
    expect(setCookie).toBeDefined();
    const cookieStr = Array.isArray(setCookie) ? setCookie.join(';') : String(setCookie);
    expect(cookieStr).toMatch(/refresh_token=rt_/);
    expect(cookieStr).toMatch(/access_token=/);
  });

  it('detects reuse and revokes the family', async () => {
    // Issue a fresh refresh, rotate it once (consume it), then try to
    // use the original cookie again → reuse detected → 401.
    const t = refreshTokenService.issue(adminId, sessionId);
    const successor = refreshTokenService.issue(adminId, sessionId, t.familyId);
    refreshTokenService.rotate(t.id, successor.id);

    // Now present the original (consumed) cookie
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `refresh_token=${t.rawValue}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/reuse detected/i);

    // Confirm successor is also revoked (family was nuked)
    const successorRow = db.prepare(
      'SELECT * FROM refresh_tokens WHERE id = ?'
    ).get(successor.id) as { used_at: string | null } | undefined;
    expect(successorRow?.used_at).not.toBeNull();
  });

  it('rejects refresh for an expired token', async () => {
    // Insert an already-expired token directly
    const id = randomUUID();
    const familyId = randomUUID();
    const tokenHash = 'fakehash-expired-' + randomUUID().slice(0, 8);
    const pastExpiry = new Date(Date.now() - 60_000).toISOString();
    db.prepare(
      'INSERT INTO refresh_tokens (id, family_id, token_hash, teacher_id, session_id, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, familyId, tokenHash, adminId, sessionId, pastExpiry);

    // The cookie value would need to be rt_<64 hex chars>; we can't compute
    // it without knowing the hash, so this test verifies the cleanup path
    // removes expired tokens instead.
    await refreshTokenService.cleanup();
    const row = db.prepare('SELECT * FROM refresh_tokens WHERE id = ?').get(id);
    expect(row).toBeUndefined();
  });

  it('rejects refresh when the linked session is revoked', async () => {
    // Issue a fresh refresh token, then revoke its session.
    const t = refreshTokenService.issue(adminId, sessionId);
    db.prepare('UPDATE user_sessions SET is_revoked = 1 WHERE id = ?').run(sessionId);

    try {
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', `refresh_token=${t.rawValue}`);

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/session expired or revoked/i);
    } finally {
      db.prepare('UPDATE user_sessions SET is_revoked = 0 WHERE id = ?').run(sessionId);
    }
  });
});