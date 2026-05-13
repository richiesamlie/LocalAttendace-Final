import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { teacherService } from '../../../services';
import { JWT_SECRET } from '../../../src/routes/middleware';

process.env.DEFAULT_ADMIN_PASSWORD ??= 'test-default-admin-password';

vi.mock('../../../server', () => ({
  io: {
    to: () => ({ emit: () => undefined }),
    emit: () => undefined,
  },
}));

import { createTestApp } from '../helpers/app';

describe('Admin database restore endpoint security', () => {
  const app = createTestApp();

  async function mintAdminCookie(): Promise<string> {
    const teacher = await teacherService.getByUsername('admin') as { id: string; username: string } | undefined;
    if (!teacher) throw new Error('admin user not found');

    const token = jwt.sign({ teacherId: teacher.id, username: teacher.username }, JWT_SECRET, { expiresIn: '1h' });
    return `auth_token=${token}`;
  }

  it('rejects unauthenticated restore attempts', async () => {
    const res = await request(app)
      .post('/api/admin/database/restore')
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('SQLite format 3\x00fake'));

    expect(res.status).toBe(401);
    expect(String(res.body.error)).toMatch(/Authentication required/i);
  });

  it('rejects unsupported content-type', async () => {
    const cookie = await mintAdminCookie();
    const res = await request(app)
      .post('/api/admin/database/restore')
      .set('Cookie', cookie)
      .set('Content-Type', 'application/json')
      .send({ data: 'not sqlite' });

    expect(res.status).toBe(415);
    expect(String(res.body.error)).toMatch(/Unsupported content type/i);
  });

  it('rejects invalid sqlite payload even with octet-stream', async () => {
    const cookie = await mintAdminCookie();
    const res = await request(app)
      .post('/api/admin/database/restore')
      .set('Cookie', cookie)
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('not-a-sqlite-file'));

    expect(res.status).toBe(400);
    expect(String(res.body.error)).toMatch(/Invalid SQLite database file/i);
  });
});
