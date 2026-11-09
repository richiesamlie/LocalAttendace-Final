import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';

process.env.DEFAULT_ADMIN_PASSWORD ??= 'test-default-admin-password';

vi.mock('../../server', () => ({
  io: {
    to: () => ({ emit: () => undefined }),
    emit: () => undefined,
  },
}));

import { createTestApp } from './helpers/app';

describe('Multi-School Tenancy & Isolation (Path B)', () => {
  const app = createTestApp();
  const suffix = randomUUID().slice(0, 6);
  const schoolACode = `stmarys_${suffix}`;
  const schoolBCode = `lincoln_${suffix}`;

  let schoolACookies: string[] = [];
  let schoolBCookies: string[] = [];
  let schoolAClassId = '';
  let schoolBClassId = '';
  let schoolBTeacherId = '';

  it('allows registering two independent schools that both use username "admin"', async () => {
    const resA = await request(app)
      .post('/api/auth/register-school')
      .send({
        schoolName: 'St. Marys Academy',
        schoolCode: schoolACode,
        adminName: 'Principal Mary',
        username: 'admin',
        password: 'passwordA123',
      });

    expect(resA.status).toBe(201);
    expect(resA.body.success).toBe(true);
    expect(resA.body.schoolCode).toBe(schoolACode);
    expect(resA.body.isAdmin).toBe(true);
    schoolACookies = resA.headers['set-cookie'] as unknown as string[];
    expect(schoolACookies?.length).toBeGreaterThan(0);

    const resB = await request(app)
      .post('/api/auth/register-school')
      .send({
        schoolName: 'Lincoln High School',
        schoolCode: schoolBCode,
        adminName: 'Principal Abraham',
        username: 'admin',
        password: 'passwordB456',
      });

    expect(resB.status).toBe(201);
    expect(resB.body.success).toBe(true);
    expect(resB.body.schoolCode).toBe(schoolBCode);
    expect(resB.body.isAdmin).toBe(true);
    expect(resB.body.schoolId).not.toBe(resA.body.schoolId);
    schoolBCookies = resB.headers['set-cookie'] as unknown as string[];
    expect(schoolBCookies?.length).toBeGreaterThan(0);
  });

  it('supports logging into each school via schoolCode or username@schoolCode and rejects cross-school passwords', async () => {
    // Explicit schoolCode login for School A
    const loginA = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'admin',
        password: 'passwordA123',
        schoolCode: schoolACode,
      });
    expect(loginA.status).toBe(200);
    expect(loginA.body.schoolCode).toBe(schoolACode);

    // Suffixed username@schoolCode login for School B
    const loginB = await request(app)
      .post('/api/auth/login')
      .send({
        username: `admin@${schoolBCode}`,
        password: 'passwordB456',
      });
    expect(loginB.status).toBe(200);
    expect(loginB.body.schoolCode).toBe(schoolBCode);

    // Cross-school password must fail
    const crossLogin = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'admin',
        password: 'passwordA123',
        schoolCode: schoolBCode,
      });
    expect(crossLogin.status).toBe(401);
  });

  it('isolates classes, teachers, dashboard payloads, and mutations between School A and School B admins', async () => {
    const classesA = await request(app)
      .get('/api/classes')
      .set('Cookie', schoolACookies);
    expect(classesA.status).toBe(200);
    expect(classesA.body.length).toBe(1);
    schoolAClassId = classesA.body[0].id;

    const classesB = await request(app)
      .get('/api/classes')
      .set('Cookie', schoolBCookies);
    expect(classesB.status).toBe(200);
    expect(classesB.body.length).toBe(1);
    schoolBClassId = classesB.body[0].id;
    expect(schoolBClassId).not.toBe(schoolAClassId);

    // Register a teacher in School B
    const regTeacherB = await request(app)
      .post('/api/teachers/register')
      .set('Cookie', schoolBCookies)
      .send({
        username: 'science_teacher',
        password: 'teacherPassword123',
        name: 'Mr. Newton',
      });
    expect(regTeacherB.status).toBe(200);
    schoolBTeacherId = regTeacherB.body.id;

    // School A admin must NOT see School B's teachers
    const teachersA = await request(app)
      .get('/api/teachers')
      .set('Cookie', schoolACookies);
    expect(teachersA.status).toBe(200);
    expect(teachersA.body.some((t: { id: string }) => t.id === schoolBTeacherId)).toBe(false);

    // School A admin must NOT be able to read School B's class dashboard-payload
    const crossPayload = await request(app)
      .get(`/api/classes/${schoolBClassId}/dashboard-payload`)
      .set('Cookie', schoolACookies);
    expect(crossPayload.status).toBe(404);

    // School A admin must NOT be able to rename or delete School B's class
    const crossUpdate = await request(app)
      .put(`/api/classes/${schoolBClassId}`)
      .set('Cookie', schoolACookies)
      .send({ name: 'Hijacked Class' });
    expect(crossUpdate.status).toBe(404);

    const crossDelete = await request(app)
      .delete(`/api/classes/${schoolBClassId}`)
      .set('Cookie', schoolACookies);
    expect(crossDelete.status).toBe(404);

    // School A homeroom/admin must NOT be able to add School B's teacher to School A's class
    const crossAddTeacher = await request(app)
      .post(`/api/classes/${schoolAClassId}/teachers`)
      .set('Cookie', schoolACookies)
      .send({ teacherId: schoolBTeacherId });
    expect(crossAddTeacher.status).toBe(404);

    // Create an invite in School B and ensure School A cannot redeem it or delete it
    const inviteB = await request(app)
      .post(`/api/classes/${schoolBClassId}/invites`)
      .set('Cookie', schoolBCookies)
      .send({ role: 'teacher', expiresInHours: 24 });
    expect(inviteB.status).toBe(200);

    const crossDeleteInvite = await request(app)
      .delete(`/api/classes/${schoolAClassId}/invites/${inviteB.body.code}`)
      .set('Cookie', schoolACookies);
    expect(crossDeleteInvite.status).toBe(404);

    const crossRedeem = await request(app)
      .post('/api/invites/redeem')
      .set('Cookie', schoolACookies)
      .send({ code: inviteB.body.code });
    expect(crossRedeem.status).toBe(404);

    // Create a student in School A and ensure School B admin cannot write attendance records for School A's class
    const studentAId = `stu_${suffix}`;
    const studentARes = await request(app)
      .post(`/api/classes/${schoolAClassId}/students`)
      .set('Cookie', schoolACookies)
      .send({
        id: studentAId,
        name: 'Alice StMarys',
        rollNumber: '101',
      });
    expect(studentARes.status).toBe(200);

    const crossPostRecords = await request(app)
      .post('/api/records')
      .set('Cookie', schoolBCookies)
      .send([
        {
          studentId: studentAId,
          classId: schoolAClassId,
          date: '2026-04-19',
          status: 'Present',
          reason: '',
        },
      ]);
    expect(crossPostRecords.status).toBe(404);

    // School-scoped admin settings: School A's schoolName change must not mutate School B's schoolName
    const updateSettingsA = await request(app)
      .post('/api/admin/settings')
      .set('Cookie', schoolACookies)
      .send({
        key: 'schoolName',
        value: 'St. Marys Updated Name',
      });
    expect(updateSettingsA.status).toBe(200);

    const getSettingsA = await request(app)
      .get('/api/admin/settings')
      .set('Cookie', schoolACookies);
    expect(getSettingsA.status).toBe(200);
    expect(getSettingsA.body.schoolName).toBe('St. Marys Updated Name');

    const getSettingsB = await request(app)
      .get('/api/admin/settings')
      .set('Cookie', schoolBCookies);
    expect(getSettingsB.status).toBe(200);
    expect(getSettingsB.body.schoolName).not.toBe('St. Marys Updated Name');

    // Non-default school admins must NOT access global database backup/restore or raw SQL profiling
    const crossDbBackup = await request(app)
      .post('/api/admin/database/backup')
      .set('Cookie', schoolBCookies);
    expect(crossDbBackup.status).toBe(403);

    const crossProfilingQuery = await request(app)
      .post('/api/admin/profiling/query')
      .set('Cookie', schoolBCookies)
      .send({ sql: 'SELECT 1' });
    expect(crossProfilingQuery.status).toBe(403);

    // Default school username squatting prevention: registering "bob@schoolBCode" from School A must not collide with School B
    const squatAttempt = await request(app)
      .post('/api/teachers/register')
      .set('Cookie', schoolACookies)
      .send({
        username: `science_teacher@${schoolBCode}`,
        password: 'squatPassword123',
        name: 'Squatter',
      });
    // Strips @suffix and registers as science_teacher@schoolACode in School A
    expect(squatAttempt.status).toBe(200);
    expect(squatAttempt.body.username).toBe(`science_teacher@${schoolACode}`);
  });
});
