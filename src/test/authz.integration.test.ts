import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

process.env.DEFAULT_ADMIN_PASSWORD ??= 'test-default-admin-password';

vi.mock('../../server', () => ({
  io: {
    to: () => ({ emit: () => undefined }),
    emit: () => undefined,
  },
}));

import { createTestApp } from './helpers/app';

describe('AuthZ Integration - unauthenticated requests', () => {
  const app = createTestApp();

  const cases: Array<{ method: 'get' | 'post' | 'put' | 'delete'; path: string; body?: unknown }> = [
    { method: 'get', path: '/api/admin/settings' },
    { method: 'post', path: '/api/admin/settings', body: { key: 'siteName', value: 'x' } },
    { method: 'post', path: '/api/classes', body: { id: 'CLS-1', name: 'Class 1' } },
    { method: 'put', path: '/api/classes/CLS-1', body: { name: 'Class 1 Updated' } },
    { method: 'delete', path: '/api/classes/CLS-1' },
    { method: 'post', path: '/api/classes/CLS-1/teachers', body: { teacherId: 'teacher-1' } },
    { method: 'delete', path: '/api/classes/CLS-1/teachers/teacher-1' },
    { method: 'post', path: '/api/sessions/revoke', body: { sessionId: 'all' } },
  ];

  for (const c of cases) {
    it(`${c.method.toUpperCase()} ${c.path} -> 401`, async () => {
      const req = request(app)[c.method](c.path);
      const res = c.body ? await req.send(c.body) : await req;

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
      expect(String(res.body.error)).toMatch(/Authentication required|Session expired or revoked|Invalid or expired token/i);
    });
  }
});
