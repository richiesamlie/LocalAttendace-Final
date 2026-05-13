import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { teacherService, sessionService } from '../../../services';
import { JWT_SECRET } from '../../../src/routes/middleware';

process.env.DEFAULT_ADMIN_PASSWORD ??= 'test-default-admin-password';

vi.mock('../../../server', () => ({
  io: {
    to: () => ({ emit: () => undefined }),
    emit: () => undefined,
  },
}));

import { createTestApp } from '../helpers/app';

describe('Auth/session abuse scenarios', () => {
  const app = createTestApp();

  async function mintCookie(opts?: { expiresAt?: string; revoked?: boolean }): Promise<string> {
    const admin = await teacherService.getByUsername('admin') as { id: string; username: string } | undefined;
    if (!admin) throw new Error('admin user not found');

    const sessionId = `sess-${randomUUID()}`;
    const expiresAt = opts?.expiresAt ?? new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await sessionService.insert(sessionId, admin.id, 'vitest', '127.0.0.1', expiresAt);

    if (opts?.revoked) {
      await sessionService.revoke(sessionId);
    }

    const token = jwt.sign({ teacherId: admin.id, username: admin.username, sessionId }, JWT_SECRET, { expiresIn: '1h' });
    return `auth_token=${token}`;
  }

  it('blocks replay of revoked session token', async () => {
    const cookie = await mintCookie({ revoked: true });

    const res = await request(app)
      .get('/api/auth/verify')
      .set('Cookie', cookie);

    expect(res.status).toBe(401);
    expect(String(res.body.error)).toMatch(/Session expired or revoked/i);
  });

  it('blocks token tied to expired server-side session', async () => {
    const cookie = await mintCookie({ expiresAt: new Date(Date.now() - 60_000).toISOString() });

    const res = await request(app)
      .get('/api/auth/verify')
      .set('Cookie', cookie);

    expect(res.status).toBe(401);
    expect(String(res.body.error)).toMatch(/Session expired or revoked/i);
  });

  it('revoking all sessions immediately invalidates current token', async () => {
    const cookie = await mintCookie();

    const revoke = await request(app)
      .post('/api/sessions/revoke')
      .set('Cookie', cookie)
      .send({ sessionId: 'all' });

    expect(revoke.status).toBe(200);

    const replay = await request(app)
      .get('/api/auth/verify')
      .set('Cookie', cookie);

    expect(replay.status).toBe(401);
    expect(String(replay.body.error)).toMatch(/Session expired or revoked/i);
  });
});
