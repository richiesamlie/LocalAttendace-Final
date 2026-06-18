import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { createTestApp } from '../helpers/app';

process.env.DEFAULT_ADMIN_PASSWORD ??= 'test-default-admin-password';

vi.mock('../../server', () => ({
  io: {
    to: () => ({ emit: () => undefined }),
    emit: () => undefined,
  },
}));

import db from '../../../db';

describe('Student routes dual mount (F-022)', () => {
  const app = createTestApp();
  let teacherId: string;
  let classId: string;
  let cookie: string;

  beforeAll(async () => {
    teacherId = `tch-f022-${randomUUID().slice(0, 8)}`;
    classId = `cls-f022-${randomUUID().slice(0, 8)}`;
    const sessionId = `sess-f022-${randomUUID()}`;
    const sessionExpiry = new Date(Date.now() + 3600_000).toISOString();
    const passwordHash = bcrypt.hashSync('password123', 4); // low cost for tests

    db.prepare(
      'INSERT INTO teachers (id, username, password_hash, name, is_admin) VALUES (?, ?, ?, ?, ?)'
    ).run(teacherId, `${teacherId}-user`, passwordHash, 'F022 Teacher', 0);
    db.prepare(
      'INSERT INTO classes (id, teacher_id, name) VALUES (?, ?, ?)'
    ).run(classId, teacherId, 'F022 Class');
    db.prepare(
      'INSERT INTO class_teachers (class_id, teacher_id, role) VALUES (?, ?, ?)'
    ).run(classId, teacherId, 'owner');
    db.prepare(
      'INSERT INTO user_sessions (id, teacher_id, expires_at) VALUES (?, ?, ?)'
    ).run(sessionId, teacherId, sessionExpiry);

    const jwt = await import('jsonwebtoken');
    const { JWT_SECRET } = await import('../../../src/routes/middleware');
    const token = jwt.sign(
      { teacherId, username: `${teacherId}-user`, sessionId },
      JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '1h' },
    );
    cookie = `access_token=${token}`;
  });

  afterAll(() => {
    // Best-effort cleanup; each DELETE may fail if the row was already
    // removed by a previous test, which is fine.
    try {
      db.prepare('DELETE FROM user_sessions WHERE teacher_id = ?').run(teacherId);
    } catch (_ignore) {
      // row already gone
    }
    try {
      db.prepare('DELETE FROM class_teachers WHERE teacher_id = ?').run(teacherId);
    } catch (_ignore) {
      // row already gone
    }
    try {
      db.prepare('DELETE FROM classes WHERE teacher_id = ?').run(teacherId);
    } catch (_ignore) {
      // row already gone
    }
    try {
      db.prepare('DELETE FROM teachers WHERE id = ?').run(teacherId);
    } catch (_ignore) {
      // row already gone
    }
  });

  it('GET /classes/:classId/students works (canonical mount)', async () => {
    const res = await request(app)
      .get(`/api/classes/${classId}/students`)
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /students/:classId/students works (legacy mount)', async () => {
    const res = await request(app)
      .get(`/api/students/${classId}/students`)
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('RBAC is enforced identically on both mounts', async () => {
    // No cookie → both mounts reject with 401 (requireAuth)
    const res1 = await request(app).get(`/api/classes/${classId}/students`);
    const res2 = await request(app).get(`/api/students/${classId}/students`);
    expect(res1.status).toBe(401);
    expect(res2.status).toBe(401);
  });

  it('Bogus classId returns the same error shape on both mounts', async () => {
    const fakeId = `cls-bogus-${randomUUID()}`;
    const res1 = await request(app)
      .get(`/api/classes/${fakeId}/students`)
      .set('Cookie', cookie);
    const res2 = await request(app)
      .get(`/api/students/${fakeId}/students`)
      .set('Cookie', cookie);
    expect(res1.status).toBe(res2.status);
    expect(JSON.stringify(res1.body)).toBe(JSON.stringify(res2.body));
  });
});

describe('routes.ts mounts (F-022 source verification)', () => {
  it('studentRouter is mounted on both /classes and /students prefixes', async () => {
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    const src = readFileSync(join(process.cwd(), 'routes.ts'), 'utf8');
    expect(src).toMatch(/router\.use\(['"]\/classes['"],\s*studentRouter\)/);
    expect(src).toMatch(/router\.use\(['"]\/students['"],\s*studentRouter\)/);
  });

  it('routes.ts contains F-022 documentation comment', async () => {
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    const src = readFileSync(join(process.cwd(), 'routes.ts'), 'utf8');
    expect(src).toContain('F-022');
  });
});