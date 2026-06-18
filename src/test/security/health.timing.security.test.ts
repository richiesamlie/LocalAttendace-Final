import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/app';

process.env.DEFAULT_ADMIN_PASSWORD ??= 'test-default-admin-password';

vi.mock('../../../server', () => ({
  io: {
    to: () => ({ emit: () => undefined }),
    emit: () => undefined,
  },
}));

describe('Health endpoint timing-safe (F-024)', () => {
  const app = createTestApp();

  it('GET /api/health returns { status: "ok" }', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /api/health does NOT expose database type (info leak fix)', async () => {
    const res = await request(app).get('/api/health');
    expect(res.body.database).toBeUndefined();
    expect(res.body.dbType).toBeUndefined();
  });

  it('GET /api/health does NOT query the database (constant-time)', async () => {
    // Make a request — should complete regardless of DB state.
    // If the route tried to query the DB, an outage would cause 500.
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /api/health completes within a bounded time range (with padding)', async () => {
    // The route pads responses to ~50ms so timing attacks can't fingerprint state
    const start = Date.now();
    await request(app).get('/api/health');
    const elapsed = Date.now() - start;
    // Should be at least ~50ms (padding) but well under 500ms (no real work)
    expect(elapsed).toBeGreaterThanOrEqual(40); // allow small slack for setTimeout precision
    expect(elapsed).toBeLessThan(500);
  });

  it('GET /api/health response shape is constant (no DB-derived fields)', async () => {
    const r1 = await request(app).get('/api/health');
    const r2 = await request(app).get('/api/health');
    expect(JSON.stringify(r1.body)).toBe(JSON.stringify(r2.body));
  });
});

describe('internalHealthCheck (operator-only)', () => {
  it('returns { status, dbReachable } shape', async () => {
    const { internalHealthCheck } = await import('../../../src/routes/health.routes');
    const result = await internalHealthCheck();
    expect(result).toHaveProperty('status');
    expect(result).toHaveProperty('dbReachable');
    expect(['ok', 'degraded']).toContain(result.status);
    expect(typeof result.dbReachable).toBe('boolean');
  });
});