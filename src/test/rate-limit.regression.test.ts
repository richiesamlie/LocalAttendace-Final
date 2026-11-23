import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';

process.env.DEFAULT_ADMIN_PASSWORD ??= 'test-default-admin-password';

vi.mock('../../server', () => ({
  io: {
    to: () => ({ emit: () => undefined }),
    emit: () => undefined,
  },
}));

import { createTestApp } from './helpers/app';

describe('Rate limiter isolation and single-counting regression', () => {
  const app = createTestApp();

  beforeAll(() => {
    process.env.ENABLE_RATE_LIMIT_IN_TESTS = 'true';
  });

  afterAll(() => {
    delete process.env.ENABLE_RATE_LIMIT_IN_TESTS;
  });

  it('GET /api/health bypasses rate limiters and does not decrement postLimiter or readLimiter', async () => {
    const readBefore = await request(app).get('/api/classes/test-class/seating');
    const postBefore = await request(app).post('/api/records').send([]);

    const readRemBefore = Number(readBefore.headers['ratelimit-remaining']);
    const postRemBefore = Number(postBefore.headers['ratelimit-remaining']);
    expect(Number.isFinite(readRemBefore)).toBe(true);
    expect(Number.isFinite(postRemBefore)).toBe(true);

    for (let i = 0; i < 10; i++) {
      const healthRes = await request(app).get('/api/health');
      expect(healthRes.status).toBe(200);
      expect(healthRes.body).toEqual({ status: 'ok' });
      expect(healthRes.headers['ratelimit-limit']).toBeUndefined();
      expect(healthRes.headers['ratelimit-remaining']).toBeUndefined();
    }

    const readAfter = await request(app).get('/api/classes/test-class/seating');
    const postAfter = await request(app).post('/api/records').send([]);

    expect(Number(readAfter.headers['ratelimit-remaining'])).toBe(readRemBefore - 1);
    expect(Number(postAfter.headers['ratelimit-remaining'])).toBe(postRemBefore - 1);
  });

  it('GET /api/classes/:classId/seating decrements readLimiter by exactly 1 per request', async () => {
    const first = await request(app).get('/api/classes/test-class/seating');
    const second = await request(app).get('/api/classes/test-class/seating');

    expect(Number(first.headers['ratelimit-limit'])).toBe(2000);
    expect(Number(second.headers['ratelimit-limit'])).toBe(2000);
    expect(Number(first.headers['ratelimit-remaining']) - Number(second.headers['ratelimit-remaining'])).toBe(1);
  });

  it('POST /api/records decrements postLimiter by exactly 1 per request and ignores interleaved health checks', async () => {
    const first = await request(app).post('/api/records').send([]);
    const healthRes = await request(app).get('/api/health');
    expect(healthRes.status).toBe(200);
    const second = await request(app).post('/api/records').send([]);

    expect(Number(first.headers['ratelimit-limit'])).toBe(500);
    expect(Number(second.headers['ratelimit-limit'])).toBe(500);
    expect(Number(first.headers['ratelimit-remaining']) - Number(second.headers['ratelimit-remaining'])).toBe(1);
  });
});
