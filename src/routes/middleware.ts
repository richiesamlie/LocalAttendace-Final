import express from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import * as svc from '../../services';
import db from '../../db';
import type { Session, ClassTeacher } from '../types/db';
import type { RequestHandler } from 'express';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
});

export const postLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

export const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production'
 ? (() => { throw new Error('JWT_SECRET must be set in production'); })()
 : 'dev-secret-change-in-production');

export interface JwtPayload {
  teacherId: string;
  username: string;
  sessionId?: string;
}

export type ClassRole = 'administrator' | 'owner' | 'teacher' | 'assistant';

declare global {
  namespace Express {
    interface Request {
      teacherId: string;
      classRole?: ClassRole;
    }
  }
}

export const getTeacherId = (req: express.Request): string | null => {
  const token = req.cookies?.auth_token;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
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

  const token = req.cookies?.auth_token;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
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

export const requireClassAccess = (paramName: string = 'classId'): RequestHandler => {
  return async (req, res, next) => {
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
    } catch (error) {
      if (!res.headersSent) {
        res.status(503).json({ error: 'Database write queue error' });
      }
    }
  };
};