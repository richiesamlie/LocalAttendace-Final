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

describe('Admin settings endpoint security', () => {
  const app = createTestApp();

  async function mintAdminCookie(): Promise<string> {
    const admin = await teacherService.getByUsername('admin');
    if (!admin) throw new Error('admin user not found');

    const token = jwt.sign({ teacherId: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: '1h' });
    return `auth_token=${token}`;
  }

  it('rejects unauthenticated GET /admin/settings', async () => {
    const res = await request(app).get('/api/admin/settings');
    expect(res.status).toBe(401);
    expect(String(res.body.error)).toMatch(/Authentication required/i);
  });

  it('rejects weak adminPassword change', async () => {
    const cookie = await mintAdminCookie();
    const res = await request(app)
      .post('/api/admin/settings')
      .set('Cookie', cookie)
      .send({ key: 'adminPassword', value: 'abc' });

    expect(res.status).toBe(400);
    expect(String(res.body.error)).toMatch(/Password must be at least 4 characters/i);
  });

  it('rejects invalid settings payload via schema validation', async () => {
    const cookie = await mintAdminCookie();
    const res = await request(app)
      .post('/api/admin/settings')
      .set('Cookie', cookie)
      .send({ key: '', value: '' });

    expect(res.status).toBe(400);
    expect(String(res.body.error)).toMatch(/Validation failed/i);
  });
});
