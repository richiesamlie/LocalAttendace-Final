import express from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { randomBytes } from 'crypto';
import * as svc from '../../services';
import db from '../../db';
import type { Session, ClassTeacher } from '../types/db';
import type { RequestHandler } from 'express';

const testBypassHandler: RequestHandler = (_req, _res, next) => next();

// Disable rate limiting in test environment to avoid issues with integration tests
const skipRateLimitInTests = process.env.NODE_ENV === 'test';

// F-020: __Host- cookie prefix in production for additional subdomain
// bypass protection. The __Host- prefix requires:
//   - Name starts with __Host-
//   - Secure flag set
//   - Path=/
//   - No Domain attribute
// In dev/test we keep the plain name so non-HTTPS localhost works.

// F-004: short-lived access token cookie (default 1h). New login flow
// issues this alongside a refresh token.
export const ACCESS_COOKIE_NAME: string =
  process.env.NODE_ENV === 'production' ? '__Host-access_token' : 'access_token';

// F-004: long-lived refresh token cookie (default 7d). Opaque random
// value, looked up by sha256 hash server-side. Used only by
// POST /api/auth/refresh to mint a new access token.
export const REFRESH_COOKIE_NAME: string =
  process.env.NODE_ENV === 'production' ? '__Host-refresh_token' : 'refresh_token';

// F-020/F-004: legacy 7-day JWT cookie name. Kept for backwards compat
// with sessions created before the F-004 migration. Middleware accepts
// tokens from either this OR ACCESS_COOKIE_NAME. Once the existing 7d
// tokens naturally expire, only ACCESS_COOKIE_NAME will be in use.
export const AUTH_COOKIE_NAME: string =
  process.env.NODE_ENV === 'production' ? '__Host-auth_token' : 'auth_token';

// Login rate limiter - configured for ~40 teachers logging in during morning rush
// Allows 150 login attempts per 15 minutes (per IP) to handle simultaneous logins
// while still protecting against brute force attacks
export const authLimiter = skipRateLimitInTests
  ? testBypassHandler
  : rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 150, // Increased from 5 to support ~40 concurrent teacher logins
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
      skipSuccessfulRequests: true, // Only count failed attempts for rate limiting
    });

// General POST request rate limiter
export const postLimiter = skipRateLimitInTests
  ? testBypassHandler
  : rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 500, // Increased from 100 to support multiple concurrent users
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many requests. Please try again later.' },
    });

// Invite-code redemption rate limiter (F-008).
// Stricter than postLimiter: invite codes are short (e.g. 12 chars from
// randomUUID) but still guessable. With 10 attempts per 15 min, an attacker
// can try at most ~960/day, which is too slow for practical enumeration.
export const inviteRedeemLimiter = skipRateLimitInTests
  ? testBypassHandler
  : rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many invite redemption attempts. Please try again in 15 minutes.' },
    });

export const JWT_SECRET: string = (() => {
  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv && fromEnv.length >= 32) return fromEnv;

  // Production MUST have a configured secret. Throw early.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable must be set (>= 32 chars) in production');
  }

  // Test environment: use a stable secret so test runs are reproducible.
  // Generated once per process but constant within a run.
  if (process.env.NODE_ENV === 'test') {
    return 'test-jwt-secret-not-for-production-use-only-32c';
  }

  // Dev fallback: ephemeral random secret. No two restarts share a secret,
  // so any token from a previous dev session is invalidated on restart
  // (forces re-login). This prevents the F-005 risk of a hardcoded dev
  // secret shipping to prod via NODE_ENV misconfiguration.
  const ephemeral = randomBytes(32).toString('hex');
  console.warn(
    '[auth] JWT_SECRET not set. Generated ephemeral dev secret for this process only. ' +
    'Set JWT_SECRET in .env to keep sessions across restarts.',
  );
  return ephemeral;
})();

export interface JwtPayload {
  teacherId: string;
  username: string;
  sessionId?: string;
}

export type ClassRole = 'administrator' | 'owner' | 'teacher' | 'assistant';

declare module 'express-serve-static-core' {
  interface Request {
    teacherId: string;
    classRole?: ClassRole;
  }
}

export const getTeacherId = (req: express.Request): string | null => {
  // F-004: prefer the new access_token cookie; fall back to the legacy
  // auth_token cookie for sessions created before the F-004 migration.
  const token = req.cookies?.[ACCESS_COOKIE_NAME] || req.cookies?.[AUTH_COOKIE_NAME];
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as JwtPayload;
    return decoded.teacherId;
  } catch {
    return null;
  }
};

export const requireAuth: RequestHandler = async (req, res, next) => {
  const teacherId = getTeacherId(req);
  if (!teacherId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = req.cookies?.[ACCESS_COOKIE_NAME] || req.cookies?.[AUTH_COOKIE_NAME];
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as JwtPayload;
      if (decoded.sessionId) {
        const session = await svc.sessionService.get(decoded.sessionId) as (Session & { is_revoked: number; expires_at: string }) | null | undefined;
        if (!session || session.is_revoked === 1 || new Date(session.expires_at) < new Date()) {
          res.clearCookie(AUTH_COOKIE_NAME);
          return res.status(401).json({ error: 'Session expired or revoked' });
        }
        try { await svc.sessionService.updateActivity(decoded.sessionId); } catch (e) {
          console.warn('[auth] Failed to update session activity:', (e as Error).message);
        }
      }
    } catch (error) {
      if (error instanceof Error && !error.message.includes('jwt')) {
        return res.status(503).json({ error: 'Authentication service unavailable' });
      }
      res.clearCookie(AUTH_COOKIE_NAME);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  }

  req.teacherId = teacherId;
  return next();
};

export const requireClassAccess = (paramName: string = 'classId'): RequestHandler => {
  return async (req, res, next) => {
    if (!req.teacherId) {
      const teacherId = getTeacherId(req);
      if (!teacherId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      req.teacherId = teacherId;
    }
    const teacherId = req.teacherId;
    const classId = req.params[paramName];

    if (!classId) {
      return res.status(400).json({ error: 'Class ID is required' });
    }

    const isGlobalAdmin = await svc.teacherService.getIsAdmin(teacherId);
    if (isGlobalAdmin) {
      req.classRole = 'administrator';
      return next();
    }

    const access = await svc.classService.isClassTeacher(classId, teacherId) as ClassTeacher | null | undefined;
    if (!access) {
      return res.status(404).json({ error: 'Class not found or access denied' });
    }

    req.classRole = access.role as ClassRole;
    next();
  };
};

export const requireClassOwner = (paramName: string = 'classId'): RequestHandler => {
  return async (req, res, next) => {
    if (!req.teacherId) {
      const teacherId = getTeacherId(req);
      if (!teacherId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      req.teacherId = teacherId;
    }
    const teacherId = req.teacherId;
    const classId = req.params[paramName];

    if (!classId) {
      return res.status(400).json({ error: 'Class ID is required' });
    }

    const isGlobalAdmin = await svc.teacherService.getIsAdmin(teacherId);
    if (isGlobalAdmin) {
      return next();
    }

    const access = await svc.classService.isClassTeacher(classId, teacherId) as ClassTeacher | null | undefined;
    if (!access || access.role !== 'owner') {
      return res.status(403).json({ error: 'Only the Homeroom Teacher can perform this action' });
    }

    next();
  };
};

export const ROLE_HIERARCHY: Record<string, number> = { administrator: 5, owner: 4, teacher: 2, assistant: 1 };

export const requireRole = (paramName: string = 'classId', minRole: string = 'teacher'): RequestHandler => {
  return async (req, res, next) => {
    if (!req.teacherId) {
      const teacherId = getTeacherId(req);
      if (!teacherId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      req.teacherId = teacherId;
    }
    const teacherId = req.teacherId;
    const classId = req.params[paramName];

    if (!classId) {
      return res.status(400).json({ error: 'Class ID is required' });
    }

    const isGlobalAdmin = await svc.teacherService.getIsAdmin(teacherId);
    if (isGlobalAdmin) {
      req.classRole = 'administrator';
      return next();
    }

    const access = await svc.classService.isClassTeacher(classId, teacherId) as ClassTeacher | null | undefined;
    if (!access) {
      return res.status(404).json({ error: 'Class not found or access denied' });
    }

    const userLevel = ROLE_HIERARCHY[access.role] || 0;
    const requiredLevel = ROLE_HIERARCHY[minRole] || 0;

    if (userLevel < requiredLevel) {
      return res.status(403).json({ error: `Role '${minRole}' or higher required` });
    }

    req.classRole = access.role as ClassRole;
    next();
  };
};

export type WriteHandler = (req: express.Request, res: express.Response) => void;

export const withWriteQueue = (handler: WriteHandler): RequestHandler => {
  return async (req, res) => {
    try {
      await db.enqueueWrite(() => handler(req, res));
    } catch (_error) {
      if (!res.headersSent) {
        res.status(503).json({ error: 'Database write queue error' });
      }
    }
  };
};

/**
 * Result of verifying a Socket.IO handshake (cookie-based JWT auth).
 * Returned by `verifySocketAuth`.
 */
export interface SocketAuthContext {
  teacherId: string;
  sessionId?: string;
}

/**
 * Parse `auth_token` value out of a raw Cookie header.
 * No external dep — only handles the simple `name=value; name2=value2` format
 * used by browsers for httpOnly cookies. Decodes percent-encoded values.
 *
 * Accepts an optional `cookieName` (defaults to AUTH_COOKIE_NAME) so callers
 * can target the production __Host- prefix or the dev plain name.
 */
export function parseAuthTokenCookie(
  cookieHeader: string | undefined,
  cookieName: string = AUTH_COOKIE_NAME,
): string | null {
  if (!cookieHeader) return null;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) continue;
    const name = pair.slice(0, eqIdx).trim();
    if (name !== cookieName) continue;
    const raw = pair.slice(eqIdx + 1).trim();
    if (!raw) return null;
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return null;
}

/**
 * Verify a Socket.IO handshake using the same JWT cookie flow as HTTP.
 *
 * - Reads `auth_token` from the Cookie header on the upgrade request
 * - Verifies the JWT signature + expiry (HS256 pinned, see F-021)
 * - If the token carries a sessionId, verifies the session is not revoked
 *   and has not expired server-side (matches `requireAuth` semantics)
 *
 * Returns the authenticated teacher context, or null if the handshake
 * is invalid. Callers (e.g. `io.use(...)` middleware) should reject the
 * connection when this returns null.
 *
 * F-001: Socket.IO previously accepted any client without authentication.
 */
export async function verifySocketAuth(headers: { cookie?: string } | undefined): Promise<SocketAuthContext | null> {
  const token = parseAuthTokenCookie(headers?.cookie);
  if (!token) return null;

  let decoded: JwtPayload;
  try {
    decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as JwtPayload;
  } catch {
    return null;
  }
  if (!decoded.teacherId) return null;

  if (decoded.sessionId) {
    const session = await svc.sessionService.get(decoded.sessionId) as (Session & { is_revoked: number; expires_at: string }) | null | undefined;
    if (!session || session.is_revoked === 1 || new Date(session.expires_at) < new Date()) {
      return null;
    }
    try {
      await svc.sessionService.updateActivity(decoded.sessionId);
    } catch (e) {
      console.warn('[socket-auth] Failed to update session activity:', (e as Error).message);
    }
  }

  return { teacherId: decoded.teacherId, sessionId: decoded.sessionId };
}