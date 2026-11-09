import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import {
  teacherService,
  sessionService,
  refreshTokenService,
  schoolService,
  classService,
  DEFAULT_SCHOOL_ID,
  DEFAULT_SCHOOL_CODE,
} from '../../services';
import { randomUUID } from 'crypto';
import { validate, loginSchema, registerSchoolSchema } from '../../src/lib/validation';
import { hashPassword, needsRehash } from '../../src/lib/bcrypt';
import {
  authLimiter,
  postLimiter,
  JWT_SECRET,
  requireAuth,
  withWriteQueue,
  AUTH_COOKIE_NAME,
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  COOKIE_SECURE,
} from './middleware';
import type { Teacher, School } from '../../src/types/db';

// F-004: short-lived access token. Matches the auth_token 7d expiry
// for backwards compat with sessions that pre-date F-004.
const ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour
// F-004: refresh tokens get their own 7d lifetime via refresh-token.service.

export const authRouter = express.Router();

/**
 * Resolve school and teacher from login inputs.
 * Supports:
 * - Default school when schoolCode is omitted or 'default'
 * - Explicit schoolCode field (`{ username: 'admin', schoolCode: 'stmarys' }`)
 * - Suffixed username (`{ username: 'admin@stmarys' }`)
 */
async function resolveSchoolAndTeacher(
  rawUsername: string,
  rawSchoolCode?: string,
): Promise<{ teacher: Teacher | null; school: School | null }> {
  let baseUsername = rawUsername.trim();
  let schoolCode = (rawSchoolCode ?? '').trim().toLowerCase();

  if (!schoolCode && baseUsername.includes('@')) {
    const atIdx = baseUsername.lastIndexOf('@');
    const candidateCode = baseUsername.slice(atIdx + 1).trim().toLowerCase();
    const candidateUser = baseUsername.slice(0, atIdx).trim();
    if (candidateCode && candidateUser) {
      const matchedSchool = await schoolService.getByCode(candidateCode);
      if (matchedSchool) {
        baseUsername = candidateUser;
        schoolCode = matchedSchool.code;
      }
    }
  }

  if (!schoolCode) {
    schoolCode = DEFAULT_SCHOOL_CODE;
  }

  const school = await schoolService.getByCode(schoolCode);
  if (!school) {
    return { teacher: null, school: null };
  }

  // For non-default schools, check qualified username (`user@schoolcode`) first, then raw username scoped to school.id
  if (school.id !== DEFAULT_SCHOOL_ID) {
    const qualifiedUsername = baseUsername.endsWith(`@${school.code}`)
      ? baseUsername
      : `${baseUsername}@${school.code}`;
    const byQualified = await teacherService.getByUsername(qualifiedUsername, school.id) as Teacher | null;
    if (byQualified) {
      return { teacher: byQualified, school };
    }
  }

  const byScoped = await teacherService.getByUsername(baseUsername, school.id) as Teacher | null;
  if (byScoped) {
    return { teacher: byScoped, school };
  }

  // Fallback for default school if legacy rows have null/default school_id
  if (school.id === DEFAULT_SCHOOL_ID) {
    const byLegacy = await teacherService.getByUsername(rawUsername) as Teacher | null;
    if (byLegacy && (!byLegacy.school_id || byLegacy.school_id === DEFAULT_SCHOOL_ID)) {
      return { teacher: byLegacy, school };
    }
  }

  return { teacher: null, school };
}

authRouter.post('/login', authLimiter, validate(loginSchema), async (req, res) => {
  const { username, password, schoolCode } = req.body;

  if (!username || !password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const { teacher, school } = await resolveSchoolAndTeacher(username, schoolCode);
  if (!teacher) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const isValid = await bcrypt.compare(password, teacher.password_hash);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // F-002: transparently upgrade legacy cost-10 hashes to current BCRYPT_COST on login
  if (needsRehash(teacher.password_hash)) {
    try {
      const upgradedHash = await hashPassword(password);
      await teacherService.updatePassword(teacher.id, upgradedHash);
    } catch (e) {
      console.warn('[auth] Failed to upgrade password hash cost:', (e as Error).message);
    }
  }

  const resolvedSchoolId = teacher.school_id || school?.id || DEFAULT_SCHOOL_ID;
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
    { teacherId: teacher.id, username: teacher.username, sessionId, schoolId: resolvedSchoolId },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: ACCESS_TOKEN_TTL_SECONDS },
  );
  // F-004: long-lived refresh token (7d, opaque random, hashed in DB)
  const refresh = await refreshTokenService.issue(teacher.id, sessionId);

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
  return res.json({
    success: true,
    teacherId: teacher.id,
    username: teacher.username,
    name: teacher.name,
    isAdmin: !!teacher.is_admin,
    schoolId: resolvedSchoolId,
    schoolCode: school?.code || DEFAULT_SCHOOL_CODE,
    schoolName: school?.name || 'Default School',
  });
});

authRouter.post('/register-school', authLimiter, validate(registerSchoolSchema), withWriteQueue(async (req, res) => {
  const { schoolName, schoolCode, username, password, adminName } = req.body;
  const normalizedCode = schoolCode.trim().toLowerCase();

  const existingSchool = await schoolService.getByCode(normalizedCode);
  if (existingSchool) {
    return res.status(400).json({ error: 'School code is already registered' });
  }

  const baseUsername = username.includes('@') ? username.split('@')[0].trim() : username.trim();
  const storedUsername = normalizedCode === DEFAULT_SCHOOL_CODE
    ? baseUsername
    : `${baseUsername}@${normalizedCode}`;

  const existingTeacher = await teacherService.getByUsername(storedUsername);
  if (existingTeacher) {
    return res.status(400).json({ error: 'Username already exists for this school' });
  }

  const schoolId = `school_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const teacherId = `teacher_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const initialClassId = `class_${randomUUID().replace(/-/g, '').slice(0, 16)}`;

  const hash = await hashPassword(password);
  const school = await schoolService.insert(schoolId, normalizedCode, schoolName.trim());
  await teacherService.insert(teacherId, storedUsername, hash, adminName.trim(), school.id, 1);
  await classService.insert(initialClassId, teacherId, 'My First Class', school.id);

  const sessionId = `sess-${randomUUID()}`;
  const sessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  try {
    await teacherService.updateLastLogin(teacherId);
    await sessionService.insert(sessionId, teacherId, req.headers['user-agent']?.slice(0, 100) || 'unknown', req.ip || 'unknown', sessionExpiresAt);
  } catch (e) {
    console.warn('[auth] Failed to create session record on school registration:', (e as Error).message);
  }

  const accessToken = jwt.sign(
    { teacherId, username: storedUsername, sessionId, schoolId: school.id },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: ACCESS_TOKEN_TTL_SECONDS },
  );
  const refresh = await refreshTokenService.issue(teacherId, sessionId);
  const isSecureCookie = COOKIE_SECURE;

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

  return res.status(201).json({
    success: true,
    teacherId,
    username: storedUsername,
    name: adminName.trim(),
    isAdmin: true,
    schoolId: school.id,
    schoolCode: school.code,
    schoolName: school.name,
  });
}));

authRouter.post('/logout', async (req, res) => {
  // F-004: best-effort revoke of the refresh family so a stolen cookie
  // can't be used after logout. We don't fail the logout if the token is
  // missing/expired — clearing the cookies is enough to end the session.
  const refreshCookie = req.cookies?.[REFRESH_COOKIE_NAME];
  if (refreshCookie) {
    try {
      const row = await refreshTokenService.findByRawValue(refreshCookie);
      if (row) {
        await refreshTokenService.revokeFamily(row.family_id);
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
    await refreshTokenService.revokeFamily(row.family_id);
    await sessionService.revoke(row.session_id);
    // Also clear the user's cookies so they're forced to re-login
    res.clearCookie(ACCESS_COOKIE_NAME);
    res.clearCookie(REFRESH_COOKIE_NAME);
    res.clearCookie(AUTH_COOKIE_NAME);
    return res.status(401).json({ error: 'Refresh token reuse detected; family revoked' });
  }

  // Confirm the session is still valid (not revoked/expired)
  const session = await sessionService.get(row.session_id) as { is_revoked: number; expires_at: string } | null | undefined;
  if (!session || session.is_revoked === 1 || new Date(session.expires_at) < new Date()) {
    await refreshTokenService.revokeFamily(row.family_id);
    res.clearCookie(ACCESS_COOKIE_NAME);
    res.clearCookie(REFRESH_COOKIE_NAME);
    res.clearCookie(AUTH_COOKIE_NAME);
    return res.status(401).json({ error: 'Session expired or revoked' });
  }

  // Look up teacher for the access token payload
  const teacher = await teacherService.getById(row.teacher_id) as Teacher | null;
  if (!teacher) {
    await refreshTokenService.revokeFamily(row.family_id);
    return res.status(401).json({ error: 'Teacher not found' });
  }

  // Issue the new refresh token first so we have its id (the old token's
  // rotated_to field needs the successor's id).
  const newRefresh = await refreshTokenService.issue(teacher.id, row.session_id, row.family_id);

  // Atomically mark the old token as used and link to the successor.
  // Returns false if another concurrent refresh won the race.
  const won = await refreshTokenService.rotate(row.id, newRefresh.id);
  if (!won) {
    // Another request rotated this token already. The newRefresh we just
    // issued is now orphaned — mark it as used so it can't be reused.
    await refreshTokenService.revokeFamily(row.family_id);
    res.clearCookie(ACCESS_COOKIE_NAME);
    res.clearCookie(REFRESH_COOKIE_NAME);
    res.clearCookie(AUTH_COOKIE_NAME);
    return res.status(401).json({ error: 'Refresh token already rotated' });
  }

  // Mint new access token (1h)
  const resolvedSchoolId = teacher.school_id || DEFAULT_SCHOOL_ID;
  const accessToken = jwt.sign(
    { teacherId: teacher.id, username: teacher.username, sessionId: row.session_id, schoolId: resolvedSchoolId },
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

  return res.json({ success: true, teacherId: teacher.id, schoolId: resolvedSchoolId });
});

authRouter.get('/verify', postLimiter, requireAuth, async (req, res) => {
  const teacherId = req.teacherId;
  const teacher = await teacherService.getById(teacherId);
  if (!teacher) return res.status(401).json({ authenticated: false });
  const schoolId = teacher.school_id || DEFAULT_SCHOOL_ID;
  const school = await schoolService.getById(schoolId);
  return res.json({
    authenticated: true,
    teacherId,
    name: teacher.name,
    isAdmin: !!teacher.is_admin,
    schoolId,
    schoolCode: school?.code || DEFAULT_SCHOOL_CODE,
    schoolName: school?.name || 'Default School',
  });
});

authRouter.get('/me', postLimiter, requireAuth, async (req, res) => {
  const teacherId = req.teacherId;
  const teacher = await teacherService.getById(teacherId) as Teacher | null;
  if (!teacher) {
    return res.status(404).json({ error: 'Teacher not found' });
  }
  const schoolId = teacher.school_id || DEFAULT_SCHOOL_ID;
  const school = await schoolService.getById(schoolId);
  return res.json({
    id: teacher.id,
    username: teacher.username,
    name: teacher.name,
    isAdmin: !!teacher.is_admin,
    schoolId,
    schoolCode: school?.code || DEFAULT_SCHOOL_CODE,
    schoolName: school?.name || 'Default School',
  });
});

authRouter.post('/verify-password', authLimiter, requireAuth, async (req, res) => {
  const { password } = req.body;
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Password is required' });
  }

  const caller = await teacherService.getById(req.teacherId) as Teacher | null;
  if (!caller || !caller.is_admin) {
    return res.status(403).json({ error: 'Administrator access required' });
  }

  const callerSchoolId = caller.school_id || DEFAULT_SCHOOL_ID;

  // Verify against the caller's full record (with password_hash), falling back to the 'admin' master password if in the default school
  const callerFull = await teacherService.getByUsername(caller.username, callerSchoolId) as Teacher | null;
  if (callerFull?.password_hash && await bcrypt.compare(password, callerFull.password_hash)) {
    return res.json({ success: true });
  }

  if (callerSchoolId === DEFAULT_SCHOOL_ID && caller.username !== 'admin') {
    const masterAdmin = await teacherService.getByUsername('admin', DEFAULT_SCHOOL_ID) as Teacher | null;
    if (masterAdmin?.password_hash && await bcrypt.compare(password, masterAdmin.password_hash)) {
      return res.json({ success: true });
    }
  }

  return res.status(401).json({ error: 'Incorrect admin password' });
});
