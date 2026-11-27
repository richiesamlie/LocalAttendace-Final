import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { teacherService } from '../../../services';
import db from '../../../db';
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

  it('releases restore lock after rejected restore attempts so db.enqueueWrite does not deadlock', async () => {
    const cookie = await mintAdminCookie();

    const badTypeRes = await request(app)
      .post('/api/admin/database/restore')
      .set('Cookie', cookie)
      .set('Content-Type', 'application/json')
      .send({ data: 'not sqlite' });
    expect(badTypeRes.status).toBe(415);

    const badPayloadRes = await request(app)
      .post('/api/admin/database/restore')
      .set('Cookie', cookie)
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('not-a-sqlite-file'));
    expect(badPayloadRes.status).toBe(400);

    const writeOutcome = await Promise.race([
      db.enqueueWrite(() => undefined).then(() => 'resolved'),
      new Promise<string>((_resolve, reject) =>
        setTimeout(() => reject(new Error('write queue deadlocked after rejected restore')), 1000),
      ),
    ]);
    expect(writeOutcome).toBe('resolved');
  });

  it('returns 501 for SQLite backup and restore when DB_TYPE is postgres', async () => {
    const teacher = await teacherService.getByUsername('admin') as { id: string; username: string };
    const cookie = await mintAdminCookie();
    const prevDbType = process.env.DB_TYPE;
    const getByIdSpy = vi.spyOn(teacherService, 'getById').mockResolvedValue({
      id: teacher.id,
      username: teacher.username,
      name: 'Administrator',
      is_admin: 1,
      school_id: 'school_default',
    } as never);
    process.env.DB_TYPE = 'postgres';
    try {
      const backupRes = await request(app)
        .post('/api/admin/database/backup')
        .set('Cookie', cookie);
      expect(backupRes.status).toBe(501);

      const restoreRes = await request(app)
        .post('/api/admin/database/restore')
        .set('Cookie', cookie)
        .set('Content-Type', 'application/octet-stream')
        .send(Buffer.from('SQLite format 3\x00fake'));
      expect(restoreRes.status).toBe(501);
    } finally {
      getByIdSpy.mockRestore();
      if (prevDbType === undefined) delete process.env.DB_TYPE;
      else process.env.DB_TYPE = prevDbType;
    }
  });
});
