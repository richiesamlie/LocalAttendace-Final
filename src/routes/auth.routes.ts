import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { teacherService, sessionService } from '../../services';
import { randomUUID } from 'crypto';
import { validate, loginSchema } from '../../src/lib/validation';
import { authLimiter, JWT_SECRET, requireAuth } from './middleware';
import type { Teacher } from '../../src/types/db';

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
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  try {
    await teacherService.updateLastLogin(teacher.id);
    await sessionService.insert(sessionId, teacher.id, req.headers['user-agent']?.slice(0, 100) || 'unknown', req.ip || 'unknown', expiresAt);
  } catch (e) {
    console.warn('[auth] Failed to create session record:', (e as Error).message);
  }

  const token = jwt.sign({ teacherId: teacher.id, username: teacher.username, sessionId }, JWT_SECRET, { expiresIn: '7d' });
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
  return res.json({ success: true, teacherId: teacher.id, username: teacher.username, name: teacher.name, isAdmin: !!teacher.is_admin });
});

authRouter.post('/logout', async (req, res) => {
  const token = req.cookies?.auth_token;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as { sessionId?: string };
      if (decoded.sessionId) {
        await sessionService.revoke(decoded.sessionId);
      }
    } catch {
      // Ignore invalid/expired token on logout and continue clearing cookie.
    }
  }

  res.clearCookie('auth_token');
  return res.json({ success: true });
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