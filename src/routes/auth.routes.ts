import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { teacherService, sessionService, refreshTokenService } from '../../services';
import { randomUUID } from 'crypto';
import { validate, loginSchema } from '../../src/lib/validation';
import {
  authLimiter,
  JWT_SECRET,
  requireAuth,
  AUTH_COOKIE_NAME,
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  COOKIE_SECURE,
} from './middleware';
import type { Teacher } from '../../src/types/db';

// F-004: short-lived access token. Matches the auth_token 7d expiry
// for backwards compat with sessions that pre-date F-004.
const ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour
// F-004: refresh tokens get their own 7d lifetime via refresh-token.service.

export const authRouter = express.Router();

authRouter.post('/login', authLimiter, validate(loginSchema), async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const teacher = await teacherService.getByUsername(username) as Teacher | null;
  if (!teacher) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const isValid = await bcrypt.compare(password, teacher.password_hash);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const sessionId = `sess-${randomUUID()}`;
  const sessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  try {
    await teacherService.updateLastLogin(teacher.id);
    await sessionService.insert(sessionId, teacher.id, req.headers['user-agent']?.slice(0, 100) || 'unknown', req.ip || 'unknown', sessionExpiresAt);
  } catch (e) {
    console.warn('[auth] Failed to create session record:', (e as Error).message);
  }

  // F-004: short-lived access token (1h)
  const accessToken = jwt.sign(
    { teacherId: teacher.id, username: teacher.username, sessionId },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: ACCESS_TOKEN_TTL_SECONDS },
  );
  // F-004: long-lived refresh token (7d, opaque random, hashed in DB)
  const refresh = refreshTokenService.issue(teacher.id, sessionId);

  const isSecureCookie = COOKIE_SECURE;

  // New cookies (F-004): access_token + refresh_token
  res.cookie(ACCESS_COOKIE_NAME, accessToken, {
    httpOnly: true,
    secure: isSecureCookie,
    sameSite: 'strict',
    path: '/',
    maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
  });
  res.cookie(REFRESH_COOKIE_NAME, refresh.rawValue, {
    httpOnly: true,
    secure: isSecureCookie,
    sameSite: 'strict',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  // F-004 transition: also set the legacy 7d JWT cookie so older clients
  // that still read it keep working. Will be removed once all clients
  // migrate to the access_token cookie.
  const legacyToken = jwt.sign(
    { teacherId: teacher.id, username: teacher.username, sessionId },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '7d' },
  );
  res.cookie(AUTH_COOKIE_NAME, legacyToken, {
    httpOnly: true,
    secure: isSecureCookie,
    sameSite: 'strict',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return res.json({ success: true, teacherId: teacher.id, username: teacher.username, name: teacher.name, isAdmin: !!teacher.is_admin });
});

authRouter.post('/logout', async (req, res) => {
  // F-004: best-effort revoke of the refresh family so a stolen cookie
  // can't be used after logout. We don't fail the logout if the token is
  // missing/expired — clearing the cookies is enough to end the session.
  const refreshCookie = req.cookies?.[REFRESH_COOKIE_NAME];
  if (refreshCookie) {
    try {
      const row = await refreshTokenService.findByRawValue(refreshCookie);
      if (row) {
        refreshTokenService.revokeFamily(row.family_id);
      }
    } catch {
      /* best-effort */
    }
  }

  // Legacy: still revoke the user_session row for the old JWT flow
  const legacyCookie = req.cookies?.[AUTH_COOKIE_NAME] || req.cookies?.[ACCESS_COOKIE_NAME];
  if (legacyCookie) {
    try {
      const decoded = jwt.verify(legacyCookie, JWT_SECRET, { algorithms: ['HS256'] }) as { sessionId?: string };
      if (decoded.sessionId) {
        await sessionService.revoke(decoded.sessionId);
      }
    } catch {
      // Ignore invalid/expired token on logout and continue clearing cookie.
    }
  }

  // Clear all three cookies (new + legacy)
  res.clearCookie(ACCESS_COOKIE_NAME);
  res.clearCookie(REFRESH_COOKIE_NAME);
  res.clearCookie(AUTH_COOKIE_NAME);
  return res.json({ success: true });
});

// F-004: refresh endpoint. Reads the refresh_token cookie, validates
// against the refresh_tokens table, and (if valid) issues a fresh
// access_token + rotates the refresh token. If the presented refresh
// token is already used (reuse detection), the entire family is
// revoked and the user must re-login.
authRouter.post('/refresh', async (req, res) => {
  const refreshCookie = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!refreshCookie) {
    return res.status(401).json({ error: 'No refresh token' });
  }

  const row = await refreshTokenService.findByRawValue(refreshCookie);
  if (!row) {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }

  // Check expiry
  if (new Date(row.expires_at) < new Date()) {
    return res.status(401).json({ error: 'Refresh token expired' });
  }

  // Reuse detection: if used_at is already set, this token was already
  // rotated. Treat as compromise — revoke the entire family.
  if (row.used_at) {
    refreshTokenService.revokeFamily(row.family_id);
    // Also clear the user's cookies so they're forced to re-login
    res.clearCookie(ACCESS_COOKIE_NAME);
    res.clearCookie(REFRESH_COOKIE_NAME);
    res.clearCookie(AUTH_COOKIE_NAME);
    return res.status(401).json({ error: 'Refresh token reuse detected; family revoked' });
  }

  // Confirm the session is still valid (not revoked/expired)
  const session = await sessionService.get(row.session_id) as { is_revoked: number; expires_at: string } | null | undefined;
  if (!session || session.is_revoked === 1 || new Date(session.expires_at) < new Date()) {
    refreshTokenService.revokeFamily(row.family_id);
    res.clearCookie(ACCESS_COOKIE_NAME);
    res.clearCookie(REFRESH_COOKIE_NAME);
    res.clearCookie(AUTH_COOKIE_NAME);
    return res.status(401).json({ error: 'Session expired or revoked' });
  }

  // Look up teacher for the access token payload
  const teacher = await teacherService.getById(row.teacher_id) as Teacher | null;
  if (!teacher) {
    refreshTokenService.revokeFamily(row.family_id);
    return res.status(401).json({ error: 'Teacher not found' });
  }

  // Issue the new refresh token first so we have its id (the old token's
  // rotated_to field needs the successor's id).
  const newRefresh = refreshTokenService.issue(teacher.id, row.session_id, row.family_id);

  // Atomically mark the old token as used and link to the successor.
  // Returns false if another concurrent refresh won the race.
  const won = refreshTokenService.rotate(row.id, newRefresh.id);
  if (!won) {
    // Another request rotated this token already. The newRefresh we just
    // issued is now orphaned — mark it as used so it can't be reused.
    refreshTokenService.revokeFamily(row.family_id);
    res.clearCookie(ACCESS_COOKIE_NAME);
    res.clearCookie(REFRESH_COOKIE_NAME);
    res.clearCookie(AUTH_COOKIE_NAME);
    return res.status(401).json({ error: 'Refresh token already rotated' });
  }

  // Mint new access token (1h)
  const accessToken = jwt.sign(
    { teacherId: teacher.id, username: teacher.username, sessionId: row.session_id },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: ACCESS_TOKEN_TTL_SECONDS },
  );

  const isSecureCookie = COOKIE_SECURE;
  res.cookie(ACCESS_COOKIE_NAME, accessToken, {
    httpOnly: true,
    secure: isSecureCookie,
    sameSite: 'strict',
    path: '/',
    maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
  });
  res.cookie(REFRESH_COOKIE_NAME, newRefresh.rawValue, {
    httpOnly: true,
    secure: isSecureCookie,
    sameSite: 'strict',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  // Touch the session's last_active so the user doesn't look "idle"
  try {
    await sessionService.updateActivity(row.session_id);
  } catch {
    /* non-critical */
  }

  return res.json({ success: true, teacherId: teacher.id });
});

authRouter.get('/verify', requireAuth, async (req, res) => {
  const teacherId = req.teacherId;
  const teacher = await teacherService.getById(teacherId);
  if (!teacher) return res.status(401).json({ authenticated: false });
  return res.json({ authenticated: true, teacherId, name: teacher.name, isAdmin: !!teacher.is_admin });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const teacherId = req.teacherId;
  const teacher = await teacherService.getById(teacherId) as Teacher | null;
  if (!teacher) {
    return res.status(404).json({ error: 'Teacher not found' });
  }
  return res.json({ id: teacher.id, username: teacher.username, name: teacher.name, isAdmin: !!teacher.is_admin });
});
