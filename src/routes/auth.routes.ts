import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { teacherService, sessionService } from '../../services';
import type { Teacher } from '../types/db';
import { requireAuth, getTeacherId, JWT_SECRET } from './middleware';

export const authRouter = express.Router();

const authLimiter = (_req: express.Request, _res: express.Response, next: express.NextFunction) => {
  next();
};

authRouter.post('/login', authLimiter, async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const teacher = await teacherService.getByUsername(username) as Teacher | null;
  if (!teacher) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const isValid = bcrypt.compareSync(password, teacher.password_hash);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const sessionId = `sess-${crypto.randomUUID()}`;
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
  res.json({ success: true, teacherId: teacher.id, username: teacher.username, name: teacher.name, isAdmin: !!teacher.is_admin });
});

authRouter.post('/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.json({ success: true });
});

authRouter.get('/verify', async (req, res) => {
  const teacherId = getTeacherId(req);
  if (!teacherId) return res.status(401).json({ authenticated: false });
  const teacher = await teacherService.getById(teacherId) as Teacher | null;
  if (!teacher) return res.status(401).json({ authenticated: false });
  res.json({ authenticated: true, teacherId, name: teacher.name });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const teacherId = req.teacherId;
  const teacher = await teacherService.getById(teacherId) as Teacher | null;
  if (!teacher) {
    return res.status(404).json({ error: 'Teacher not found' });
  }
  res.json({ id: teacher.id, username: teacher.username, name: teacher.name, isAdmin: !!teacher.is_admin });
});