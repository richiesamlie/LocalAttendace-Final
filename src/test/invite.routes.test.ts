import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

process.env.DEFAULT_ADMIN_PASSWORD ??= 'test-default-admin-password';

vi.mock('../../server', () => ({
  io: {
    to: () => ({ emit: () => undefined }),
    emit: () => undefined,
  },
}));

import db from '../../db';
import { createTestApp } from './helpers/app';
import { JWT_SECRET } from '../routes/middleware';
import { sessionService } from '../../services';

describe('Invite routes', () => {
  const app = createTestApp();
  const ownerId = `teacher-invite-owner-${randomUUID()}`;
  const inviteeId = `teacher-invite-new-${randomUUID()}`;
  const classId = `class-invite-${randomUUID()}`;
  const inviteCode = `inv-${randomUUID().slice(0, 12)}`;

  beforeAll(() => {
    const passwordHash = bcrypt.hashSync('password123', 10);
    db.prepare('INSERT INTO teachers (id, username, password_hash, name, is_admin) VALUES (?, ?, ?, ?, ?)')
      .run(ownerId, `${ownerId}-user`, passwordHash, 'Invite Owner', 0);
    db.prepare('INSERT INTO teachers (id, username, password_hash, name, is_admin) VALUES (?, ?, ?, ?, ?)')
      .run(inviteeId, `${inviteeId}-user`, passwordHash, 'Invitee Teacher', 0);
    db.prepare('INSERT INTO classes (id, teacher_id, name) VALUES (?, ?, ?)')
      .run(classId, ownerId, 'Invite Regression Class');
    db.prepare('INSERT INTO class_teachers (class_id, teacher_id, role) VALUES (?, ?, ?)')
      .run(classId, ownerId, 'owner');
    db.prepare('INSERT INTO invite_codes (code, class_id, role, created_by, expires_at) VALUES (?, ?, ?, ?, ?)')
      .run(inviteCode, classId, 'teacher', ownerId, new Date(Date.now() + 60 * 60 * 1000).toISOString());
  });

  afterAll(() => {
    db.prepare('DELETE FROM invite_codes WHERE code = ?').run(inviteCode);
    db.prepare('DELETE FROM class_teachers WHERE class_id = ?').run(classId);
    db.prepare('DELETE FROM classes WHERE id = ?').run(classId);
    db.prepare('DELETE FROM user_sessions WHERE teacher_id IN (?, ?)').run(ownerId, inviteeId);
    db.prepare('DELETE FROM teachers WHERE id IN (?, ?)').run(ownerId, inviteeId);
  });

  async function mintCookie(teacherId: string, username: string): Promise<string> {
    const sessionId = `sess-${randomUUID()}`;
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await sessionService.insert(sessionId, teacherId, 'vitest', '127.0.0.1', expiresAt);
    const token = jwt.sign({ teacherId, username, sessionId }, JWT_SECRET, { expiresIn: '1h' });
    return `auth_token=${token}`;
  }

  it('redeems a valid invite for a teacher without existing class access', async () => {
    const cookie = await mintCookie(inviteeId, `${inviteeId}-user`);

    const res = await request(app)
      .post('/api/invites/redeem')
      .set('Cookie', cookie)
      .send({ code: inviteCode });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      className: 'Invite Regression Class',
      role: 'teacher',
    });

    const membership = db.prepare('SELECT role FROM class_teachers WHERE class_id = ? AND teacher_id = ?')
      .get(classId, inviteeId) as { role: string } | undefined;
    expect(membership?.role).toBe('teacher');

    const usedInvite = db.prepare('SELECT used_by FROM invite_codes WHERE code = ?')
      .get(inviteCode) as { used_by: string | null } | undefined;
    expect(usedInvite?.used_by).toBe(inviteeId);
  });
});
