import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import express from 'express';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import db from '../../../db';
import { teacherService } from '../../../services';
import { JWT_SECRET } from '../../routes/middleware';
import { resetVersionCacheForTest } from '../../lib/updater';

process.env.DEFAULT_ADMIN_PASSWORD ??= 'test-default-admin-password';

vi.mock('../../../server', () => ({
  io: {
    to: () => ({ emit: () => undefined }),
    emit: () => undefined,
  },
}));

import { createTestApp } from '../helpers/app';

describe('Admin self-update endpoints security', () => {
  const app = createTestApp();
  const nonAdminId = `tch-nonadmin-${randomUUID().slice(0, 8)}`;
  const otherSchoolId = `sch-other-${randomUUID().slice(0, 8)}`;
  const otherAdminId = `tch-otheradmin-${randomUUID().slice(0, 8)}`;

  let sysAdminCookie = '';
  let nonAdminCookie = '';
  let otherSchoolAdminCookie = '';
  let mockTrayServer: http.Server | null = null;

  beforeAll(async () => {
    const admin = await teacherService.getByUsername('admin') as { id: string; username: string; school_id?: string } | undefined;
    if (!admin) throw new Error('admin user not found');
    const sysToken = jwt.sign(
      { teacherId: admin.id, username: admin.username, schoolId: admin.school_id || 'school_default' },
      JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '1h' },
    );
    sysAdminCookie = `auth_token=${sysToken}`;

    const pwHash = bcrypt.hashSync('password123', 4);
    db.prepare(
      'INSERT INTO teachers (id, username, password_hash, name, is_admin, school_id) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(nonAdminId, `${nonAdminId}-user`, pwHash, 'Normal Teacher', 0, 'school_default');
    const nonAdminToken = jwt.sign(
      { teacherId: nonAdminId, username: `${nonAdminId}-user`, schoolId: 'school_default' },
      JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '1h' },
    );
    nonAdminCookie = `auth_token=${nonAdminToken}`;

    db.prepare('INSERT INTO schools (id, code, name) VALUES (?, ?, ?)').run(
      otherSchoolId,
      `code-${otherSchoolId.slice(-6)}`,
      'Other School',
    );
    db.prepare(
      'INSERT INTO teachers (id, username, password_hash, name, is_admin, school_id) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(otherAdminId, `${otherAdminId}-user`, pwHash, 'Other School Admin', 1, otherSchoolId);
    const otherAdminToken = jwt.sign(
      { teacherId: otherAdminId, username: `${otherAdminId}-user`, schoolId: otherSchoolId },
      JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '1h' },
    );
    otherSchoolAdminCookie = `auth_token=${otherAdminToken}`;
  });

  afterEach(async () => {
    delete process.env.TRAY_CONTROL_PORT;
    delete process.env.TRAY_CONTROL_TOKEN;
    resetVersionCacheForTest();
    if (mockTrayServer) {
      await new Promise<void>((resolve) => mockTrayServer?.close(() => resolve()));
      mockTrayServer = null;
    }
  });

  afterAll(() => {
    try { db.prepare('DELETE FROM teachers WHERE id IN (?, ?)').run(nonAdminId, otherAdminId); } catch { /* ignore */ }
    try { db.prepare('DELETE FROM schools WHERE id = ?').run(otherSchoolId); } catch { /* ignore */ }
  });

  it('rejects unauthenticated requests to all update endpoints with 401', async () => {
    expect((await request(app).get('/api/admin/update/status')).status).toBe(401);
    expect((await request(app).post('/api/admin/update/check')).status).toBe(401);
    expect((await request(app).post('/api/admin/update/install').send({ mode: 'now' })).status).toBe(401);
    expect((await request(app).post('/api/admin/update/config').send({ autoCheckEnabled: false })).status).toBe(401);
  });

  it('rejects non-admin teachers with 403', async () => {
    const resStatus = await request(app).get('/api/admin/update/status').set('Cookie', nonAdminCookie);
    const resCheck = await request(app).post('/api/admin/update/check').set('Cookie', nonAdminCookie);
    expect(resStatus.status).toBe(403);
    expect(resCheck.status).toBe(403);
  });

  it('rejects admins from non-default schools via requireSystemAdmin with 403', async () => {
    const resStatus = await request(app).get('/api/admin/update/status').set('Cookie', otherSchoolAdminCookie);
    const resCheck = await request(app).post('/api/admin/update/check').set('Cookie', otherSchoolAdminCookie);
    expect(resStatus.status).toBe(403);
    expect(resCheck.status).toBe(403);
  });

  it('enforces localhost-only access on mutating update routes while allowing read status over LAN', async () => {
    const lanApp = express();
    lanApp.use((req, _res, next) => {
      Object.defineProperty(req.socket, 'remoteAddress', {
        value: '192.168.1.50',
        configurable: true,
      });
      next();
    });
    lanApp.use(app);

    const statusRes = await request(lanApp).get('/api/admin/update/status').set('Cookie', sysAdminCookie);
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.isLocalhost).toBe(false);

    const checkRes = await request(lanApp).post('/api/admin/update/check').set('Cookie', sysAdminCookie);
    expect(checkRes.status).toBe(403);
    expect(String(checkRes.body.error)).toMatch(/localhost/i);

    const installRes = await request(lanApp)
      .post('/api/admin/update/install')
      .set('Cookie', sysAdminCookie)
      .send({ mode: 'now' });
    expect(installRes.status).toBe(403);

    const configRes = await request(lanApp)
      .post('/api/admin/update/config')
      .set('Cookie', sysAdminCookie)
      .send({ autoCheckEnabled: false });
    expect(configRes.status).toBe(403);
  });

  it('validates payloads for POST /update/install and POST /update/config', async () => {
    const badInstall = await request(app)
      .post('/api/admin/update/install')
      .set('Cookie', sysAdminCookie)
      .send({ mode: 'invalid-mode' });
    expect(badInstall.status).toBe(400);

    const badConfig = await request(app)
      .post('/api/admin/update/config')
      .set('Cookie', sysAdminCookie)
      .send({ autoCheckEnabled: 'yes' });
    expect(badConfig.status).toBe(400);
  });

  it('returns 501 for install/config when not managed by Windows Tray', async () => {
    const installRes = await request(app)
      .post('/api/admin/update/install')
      .set('Cookie', sysAdminCookie)
      .send({ mode: 'now' });
    expect(installRes.status).toBe(501);

    const configRes = await request(app)
      .post('/api/admin/update/config')
      .set('Cookie', sysAdminCookie)
      .send({ autoCheckEnabled: false });
    expect(configRes.status).toBe(501);
  });

  it('proxies update control calls to loopback Tray server with X-Tray-Token authentication', async () => {
    const expectedToken = 'test-tray-token-abcdef0123456789';
    const trayState = {
      currentVersion: '1.0.1',
      currentRuntimeHash: 'abc123',
      installType: 'installed',
      managedByTray: true,
      canSelfUpdate: true,
      state: 'available',
      autoCheckEnabled: true,
      lastCheckedAt: '2026-11-23T00:00:00.000Z',
      availableVersion: '1.2.0',
      releaseNotesUrl: 'https://github.com/richiesamlie/LocalAttendace-Final/releases/tag/v1.2.0',
      updateKind: 'app-bundle',
      downloadSizeBytes: 1500000,
      downloadProgress: 0,
      signatureVerified: true,
      signatureRequired: true,
      installOnExit: false,
      lastError: null,
    };

    const observedTokens: string[] = [];
    mockTrayServer = http.createServer((req, res) => {
      const tokenHeader = String(req.headers['x-tray-token'] || '');
      observedTokens.push(tokenHeader);
      if (tokenHeader !== expectedToken) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden' }));
        return;
      }

      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        const body = chunks.length > 0 ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
        if (req.method === 'GET' && req.url === '/status') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(trayState));
          return;
        }
        if (req.method === 'POST' && req.url === '/check') {
          trayState.state = 'checking';
          res.writeHead(202, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(trayState));
          return;
        }
        if (req.method === 'POST' && req.url === '/install') {
          trayState.installOnExit = body.mode === 'on-exit';
          trayState.state = body.mode === 'now' ? 'downloading' : 'available';
          res.writeHead(202, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(trayState));
          return;
        }
        if (req.method === 'POST' && req.url === '/config') {
          trayState.autoCheckEnabled = Boolean(body.autoCheckEnabled);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(trayState));
          return;
        }
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      });
    });

    await new Promise<void>((resolve) => mockTrayServer?.listen(0, '127.0.0.1', () => resolve()));
    const addr = mockTrayServer.address();
    if (!addr || typeof addr === 'string') throw new Error('Mock tray server failed to bind');

    process.env.TRAY_CONTROL_PORT = String(addr.port);
    process.env.TRAY_CONTROL_TOKEN = expectedToken;

    const statusRes = await request(app).get('/api/admin/update/status').set('Cookie', sysAdminCookie);
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.managedByTray).toBe(true);
    expect(statusRes.body.availableVersion).toBe('1.2.0');
    expect(statusRes.body.isLocalhost).toBe(true);

    const cfgRes = await request(app)
      .post('/api/admin/update/config')
      .set('Cookie', sysAdminCookie)
      .send({ autoCheckEnabled: false });
    expect(cfgRes.status).toBe(200);
    expect(cfgRes.body.autoCheckEnabled).toBe(false);

    const installRes = await request(app)
      .post('/api/admin/update/install')
      .set('Cookie', sysAdminCookie)
      .send({ mode: 'on-exit' });
    expect(installRes.status).toBe(200);
    expect(installRes.body.installOnExit).toBe(true);

    const checkRes = await request(app).post('/api/admin/update/check').set('Cookie', sysAdminCookie);
    expect(checkRes.status).toBe(200);
    expect(checkRes.body.state).toBe('checking');

    expect(observedTokens.length).toBe(4);
    expect(observedTokens.every((t) => t === expectedToken)).toBe(true);
  });

  it('server.ts gates /api/_internal/shutdown behind SERVER_SHUTDOWN_TOKEN, loopback check, and timingSafeEqual', () => {
    const serverSrc = readFileSync(join(process.cwd(), 'server.ts'), 'utf8');
    expect(serverSrc).toContain('process.env.SERVER_SHUTDOWN_TOKEN');
    expect(serverSrc).toContain('/api/_internal/shutdown');
    expect(serverSrc).toContain('isLoopbackAddress');
    expect(serverSrc).toContain('timingSafeEqual');
    expect(serverSrc).toContain('closeDatabase()');
  });
});
