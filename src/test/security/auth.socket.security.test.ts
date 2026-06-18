import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { teacherService, sessionService } from '../../../services';
import { JWT_SECRET, parseAuthTokenCookie, verifySocketAuth } from '../../../src/routes/middleware';

process.env.DEFAULT_ADMIN_PASSWORD ??= 'test-default-admin-password';

describe('Socket.IO handshake auth (F-001)', () => {
  describe('parseAuthTokenCookie', () => {
    it('returns null for undefined/empty', () => {
      expect(parseAuthTokenCookie(undefined)).toBeNull();
      expect(parseAuthTokenCookie('')).toBeNull();
    });

    it('returns null when auth_token is missing', () => {
      expect(parseAuthTokenCookie('session=abc; theme=dark')).toBeNull();
    });

    it('returns null when auth_token value is empty', () => {
      expect(parseAuthTokenCookie('auth_token=; theme=dark')).toBeNull();
    });

    it('extracts auth_token from a single-cookie header', () => {
      expect(parseAuthTokenCookie('auth_token=abc123')).toBe('abc123');
    });

    it('extracts auth_token from a multi-cookie header', () => {
      expect(parseAuthTokenCookie('session=xyz; auth_token=abc123; theme=dark')).toBe('abc123');
    });

    it('decodes percent-encoded values', () => {
      expect(parseAuthTokenCookie('auth_token=abc%20123')).toBe('abc 123');
    });

    it('trims whitespace around name and value', () => {
      expect(parseAuthTokenCookie('  auth_token  =  abc123  ')).toBe('abc123');
    });
  });

  describe('verifySocketAuth', () => {
    async function mintTokenFor(teacherId: string, opts?: { sessionId?: string; expired?: boolean }): Promise<string> {
      const expiresIn = opts?.expired ? '-1h' : '1h';
      return jwt.sign(
        { teacherId, username: 'test', sessionId: opts?.sessionId },
        JWT_SECRET,
        { algorithm: 'HS256', expiresIn } as jwt.SignOptions,
      );
    }

    it('returns null when no cookie header is present', async () => {
      expect(await verifySocketAuth({})).toBeNull();
      expect(await verifySocketAuth(undefined)).toBeNull();
    });

    it('returns null when cookie header has no auth_token', async () => {
      expect(await verifySocketAuth({ cookie: 'session=abc' })).toBeNull();
    });

    it('returns null when token is malformed', async () => {
      expect(await verifySocketAuth({ cookie: 'auth_token=not-a-jwt' })).toBeNull();
    });

    it('returns null when token signature is invalid', async () => {
      const badToken = jwt.sign({ teacherId: 'x', username: 'x' }, 'wrong-secret', { algorithm: 'HS256', expiresIn: '1h' });
      expect(await verifySocketAuth({ cookie: `auth_token=${badToken}` })).toBeNull();
    });

    it('returns null when token is expired', async () => {
      const admin = await teacherService.getByUsername('admin') as { id: string; username: string } | undefined;
      expect(admin).toBeDefined();
      if (!admin) return;
      const expired = await mintTokenFor(admin.id, { expired: true });
      expect(await verifySocketAuth({ cookie: `auth_token=${expired}` })).toBeNull();
    });

    it('returns teacherId for a valid token without sessionId', async () => {
      const admin = await teacherService.getByUsername('admin') as { id: string; username: string } | undefined;
      expect(admin).toBeDefined();
      if (!admin) return;
      const token = await mintTokenFor(admin.id);
      const result = await verifySocketAuth({ cookie: `auth_token=${token}` });
      expect(result).not.toBeNull();
      expect(result?.teacherId).toBe(admin.id);
      expect(result?.sessionId).toBeUndefined();
    });

    it('returns teacherId for a valid token tied to a live session', async () => {
      const admin = await teacherService.getByUsername('admin') as { id: string; username: string } | undefined;
      expect(admin).toBeDefined();
      if (!admin) return;

      const sessionId = `sess-${randomUUID()}`;
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      await sessionService.insert(sessionId, admin.id, 'vitest', '127.0.0.1', expiresAt);

      const token = await mintTokenFor(admin.id, { sessionId });
      const result = await verifySocketAuth({ cookie: `auth_token=${token}` });
      expect(result).not.toBeNull();
      expect(result?.teacherId).toBe(admin.id);
      expect(result?.sessionId).toBe(sessionId);
    });

    it('returns null when token references a revoked session', async () => {
      const admin = await teacherService.getByUsername('admin') as { id: string; username: string } | undefined;
      expect(admin).toBeDefined();
      if (!admin) return;

      const sessionId = `sess-${randomUUID()}`;
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      await sessionService.insert(sessionId, admin.id, 'vitest', '127.0.0.1', expiresAt);
      await sessionService.revoke(sessionId);

      const token = await mintTokenFor(admin.id, { sessionId });
      expect(await verifySocketAuth({ cookie: `auth_token=${token}` })).toBeNull();
    });

    it('returns null when token references an expired session', async () => {
      const admin = await teacherService.getByUsername('admin') as { id: string; username: string } | undefined;
      expect(admin).toBeDefined();
      if (!admin) return;

      const sessionId = `sess-${randomUUID()}`;
      const pastExpiry = new Date(Date.now() - 60_000).toISOString();
      await sessionService.insert(sessionId, admin.id, 'vitest', '127.0.0.1', pastExpiry);

      const token = await mintTokenFor(admin.id, { sessionId });
      expect(await verifySocketAuth({ cookie: `auth_token=${token}` })).toBeNull();
    });
  });
});