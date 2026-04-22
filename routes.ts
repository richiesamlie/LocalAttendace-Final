import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import db from './db';
import path from 'path';
import fs from 'fs';
import { validate, loginSchema, classSchema, studentSchema, attendanceRecordSchema, eventSchema, timetableSlotSchema, teacherSchema, settingSchema } from './src/lib/validation';
import * as svc from './services';
import { io } from './server';
import type { Session, ClassTeacher, Teacher, Invite, CalendarEvent, TimetableSlot, ClassWithRole, DailyNote, SeatingLayoutRow, SettingRow, ClassInfo, StudentRow } from './src/types/db';
import { authRouter, classRouter, studentRouter, recordRouter, eventRouter, noteRouter, timetableRouter, seatingRouter, inviteRouter, sessionRouter, teacherRouter, adminRouter, healthRouter } from './src/routes';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production'
 ? (() => { throw new Error('JWT_SECRET must be set in production'); })()
 : 'dev-secret-change-in-production');

interface JwtPayload {
  teacherId: string;
  username: string;
  sessionId?: string;
}

type ClassRole = 'administrator' | 'owner' | 'teacher' | 'assistant';

declare global {
  namespace Express {
    interface Request {
      teacherId: string;
      classRole?: ClassRole;
    }
  }
}

const getTeacherId = (req: express.Request): string | null => {
  const token = req.cookies?.auth_token;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return decoded.teacherId;
  } catch {
    return null; // Invalid/expired JWT — let requireAuth return 401
  }
};

const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const teacherId = getTeacherId(req);
  if (!teacherId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const token = req.cookies?.auth_token;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload & { sessionId?: string };
      if (decoded.sessionId) {
        const session = await svc.sessionService.get(decoded.sessionId) as (Session & { is_revoked: number; expires_at: string }) | null | undefined;
        if (!session || session.is_revoked === 1 || new Date(session.expires_at) < new Date()) {
          res.clearCookie('auth_token');
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
      res.clearCookie('auth_token');
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  }
  
  req.teacherId = teacherId;
  next();
};

const requireClassAccess = (paramName: string = 'classId') => {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const teacherId = req.teacherId;
    const classId = req.params[paramName];
    
    if (!classId) {
      return res.status(400).json({ error: 'Class ID is required' });
    }
    
    // Global administrators can access any class
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

const requireClassOwner = (paramName: string = 'classId') => {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const teacherId = req.teacherId;
    const classId = req.params[paramName];
    
    if (!classId) {
      return res.status(400).json({ error: 'Class ID is required' });
    }
    
    // Global administrators can perform any class action
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

// Role hierarchy: administrator > owner > teacher > assistant
const ROLE_HIERARCHY: Record<string, number> = { administrator: 5, owner: 4, teacher: 2, assistant: 1 };

const requireRole = (paramName: string = 'classId', minRole: string = 'teacher') => {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const teacherId = req.teacherId;
    const classId = req.params[paramName];
    
    if (!classId) {
      return res.status(400).json({ error: 'Class ID is required' });
    }

    // Global administrators can access any class
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

// Write queue wrapper: serializes write handlers through db.enqueueWrite (Phase 1.2 + 1.3)
// Wraps an Express request handler so its DB writes execute sequentially, preventing "database is locked" errors.
// Reads (GET) do not need this wrapper since WAL mode handles concurrent reads well.
type WriteHandler = (req: express.Request, res: express.Response) => void;

const withWriteQueue = (handler: WriteHandler) => {
  return async (req: express.Request, res: express.Response) => {
    try {
      await db.enqueueWrite(() => handler(req, res));
    } catch (error) {
      if (!res.headersSent) {
        res.status(503).json({ error: 'Database write queue error' });
      }
    }
  };
};

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
});

const postLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

// --- AUTHENTICATION (delegated to authRouter) ---
router.use('/auth', authRouter);

// --- HEALTH CHECK (delegated to healthRouter) ---
router.use(healthRouter);

// --- TEACHER MANAGEMENT (delegated to teacherRouter) ---
router.use('/teachers', teacherRouter);

// --- SESSION MANAGEMENT (delegated to sessionRouter - BEFORE requireAuth since routes have their own auth) ---
router.use('/sessions', sessionRouter);

// All routes below require authentication
router.use(requireAuth);

// --- CLASSES (delegated to classRouter) ---
router.use('/classes', classRouter);

// --- INVITES (redeem at root level) ---
router.post('/invites/redeem', requireAuth, postLimiter, withWriteQueue(async (req, res) => {
  const teacherId = req.teacherId;
  const { code } = req.body;
  
  if (!code) {
    return res.status(400).json({ error: 'Invite code is required' });
  }
  
  const invite = await svc.inviteService.getByCode(code) as Invite | null | undefined;
  if (!invite) {
    return res.status(404).json({ error: 'Invalid invite code' });
  }

  if (invite.used_by) {
    return res.status(400).json({ error: 'This invite code has already been used' });
  }

  if (new Date(invite.expires_at) < new Date()) {
    return res.status(400).json({ error: 'This invite code has expired' });
  }

  const classExists = await svc.classService.getById(invite.class_id, teacherId) as ClassInfo | null;
  if (!classExists) {
    return res.status(404).json({ error: 'This class no longer exists' });
  }

  const existing = await svc.classService.isClassTeacher(invite.class_id, teacherId);
  if (existing) {
    return res.status(400).json({ error: 'You already have access to this class' });
  }

  await svc.inviteService.use(teacherId, code);
  await svc.classService.addTeacher(invite.class_id, teacherId, invite.role);

  const className = classExists;
  res.json({ success: true, className: className?.name, role: invite.role });
}));

// --- STUDENTS (delegated to studentRouter) ---
router.use(studentRouter);

// --- ATTENDANCE RECORDS (delegated to recordRouter) ---
router.use(recordRouter);

// --- DAILY NOTES (delegated to noteRouter) ---
router.use(noteRouter);

// --- EVENTS (delegated to eventRouter) ---
router.use(eventRouter);

// --- TIMETABLE SLOTS (delegated to timetableRouter) ---
router.use(timetableRouter);

// --- SEATING LAYOUT (delegated to seatingRouter) ---
router.use(seatingRouter);

// --- SETTINGS & ADMIN (delegated to adminRouter) ---
router.use(adminRouter);

export default router;
