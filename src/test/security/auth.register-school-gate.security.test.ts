import { describe, it, expect, afterEach, vi } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';

process.env.DEFAULT_ADMIN_PASSWORD ??= 'test-default-admin-password';

vi.mock('../../../server', () => ({
  io: {
    to: () => ({ emit: () => undefined }),
    emit: () => undefined,
  },
}));

import { createTestApp } from '../helpers/app';

describe('Public school registration gate (ALLOW_PUBLIC_SCHOOL_REGISTRATION)', () => {
  const app = createTestApp();
  const prevValue = process.env.ALLOW_PUBLIC_SCHOOL_REGISTRATION;

  afterEach(() => {
    if (prevValue === undefined) {
      delete process.env.ALLOW_PUBLIC_SCHOOL_REGISTRATION;
    } else {
      process.env.ALLOW_PUBLIC_SCHOOL_REGISTRATION = prevValue;
    }
  });

  it('rejects POST /api/auth/register-school with 403 and exposes config=false when disabled', async () => {
    process.env.ALLOW_PUBLIC_SCHOOL_REGISTRATION = 'false';

    const cfgRes = await request(app).get('/api/auth/config');
    expect(cfgRes.status).toBe(200);
    expect(cfgRes.body).toEqual({ allowPublicSchoolRegistration: false });

    const regRes = await request(app)
      .post('/api/auth/register-school')
      .send({
        schoolName: 'Blocked Academy',
        schoolCode: `blocked_${randomUUID().slice(0, 6)}`,
        adminName: 'Blocked Admin',
        username: 'admin',
        password: 'password123',
      });
    expect(regRes.status).toBe(403);
    expect(String(regRes.body.error)).toMatch(/disabled/i);
  });

  it('allows POST /api/auth/register-school and exposes config=true when explicitly enabled', async () => {
    process.env.ALLOW_PUBLIC_SCHOOL_REGISTRATION = 'true';

    const cfgRes = await request(app).get('/api/auth/config');
    expect(cfgRes.status).toBe(200);
    expect(cfgRes.body).toEqual({ allowPublicSchoolRegistration: true });

    const code = `open_${randomUUID().slice(0, 6)}`;
    const regRes = await request(app)
      .post('/api/auth/register-school')
      .send({
        schoolName: 'Open Academy',
        schoolCode: code,
        adminName: 'Open Admin',
        username: 'admin',
        password: 'password123',
      });
    expect(regRes.status).toBe(201);
    expect(regRes.body.schoolCode).toBe(code);
  });
});
