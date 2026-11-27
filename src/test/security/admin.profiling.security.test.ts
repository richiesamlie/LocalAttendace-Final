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

describe('Admin profiling endpoint security', () => {
  const app = createTestApp();

  async function adminCookie(): Promise<string> {
    const admin = await teacherService.getByUsername('admin') as { id: string; username: string } | undefined;
    if (!admin) throw new Error('admin user not found in test database');

    const token = jwt.sign(
      { teacherId: admin.id, username: admin.username },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    return `auth_token=${token}`;
  }

  it('rejects non-SELECT statements for admin', async () => {
    const cookie = await adminCookie();

    const res = await request(app)
      .post('/api/admin/profiling/query')
      .set('Cookie', cookie)
      .send({ sql: 'DELETE FROM teachers' });

    expect(res.status).toBe(400);
    expect(String(res.body.error)).toMatch(/Only single SELECT statements are allowed/i);
  });

  it('rejects multi-statement payloads for admin', async () => {
    const cookie = await adminCookie();

    const res = await request(app)
      .post('/api/admin/profiling/query')
      .set('Cookie', cookie)
      .send({ sql: 'SELECT 1; SELECT 2' });

    expect(res.status).toBe(400);
    expect(String(res.body.error)).toMatch(/Only single SELECT statements are allowed/i);
  });

  it('accepts safe single SELECT statements for admin', async () => {
    const cookie = await adminCookie();

    const res = await request(app)
      .post('/api/admin/profiling/query')
      .set('Cookie', cookie)
      .send({ sql: 'SELECT id, name FROM teachers LIMIT 1' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('analysis');
    expect(res.body).toHaveProperty('score');
  });

  it('returns 501 for SQLite query profiling when DB_TYPE is postgres', async () => {
    const admin = await teacherService.getByUsername('admin') as { id: string; username: string };
    const cookie = await adminCookie();
    const prevDbType = process.env.DB_TYPE;
    const getByIdSpy = vi.spyOn(teacherService, 'getById').mockResolvedValue({
      id: admin.id,
      username: admin.username,
      name: 'Administrator',
      is_admin: 1,
      school_id: 'school_default',
    } as never);
    process.env.DB_TYPE = 'postgres';
    try {
      const res = await request(app)
        .post('/api/admin/profiling/query')
        .set('Cookie', cookie)
        .send({ sql: 'SELECT id, name FROM teachers LIMIT 1' });

      expect(res.status).toBe(501);
      expect(String(res.body.error)).toMatch(/SQLite/i);
    } finally {
      getByIdSpy.mockRestore();
      if (prevDbType === undefined) delete process.env.DB_TYPE;
      else process.env.DB_TYPE = prevDbType;
    }
  });
});
