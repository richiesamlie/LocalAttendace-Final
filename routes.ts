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

// --- DATABASE BACKUP & RESTORE ---
router.get('/database/backup', requireAuth, (req, res) => {
  try {
    const dbPath = path.join(process.cwd(), 'database.sqlite');
    if (!fs.existsSync(dbPath)) {
      return res.status(404).json({ error: 'Database file not found' });
    }
    res.setHeader('Content-Disposition', 'attachment; filename="database.sqlite"');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.sendFile(dbPath);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

router.post('/database/restore', requireAuth, async (req, res) => {
  try {
    // Drain the write queue before restoring to prevent race conditions
    await db.enqueueWrite(() => {
      // No-op write ensures all queued writes complete before restore
    });

    const dbPath = path.join(process.cwd(), 'database.sqlite');
    const backupDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const preRestorePath = path.join(backupDir, `pre-restore-${timestamp}.sqlite`);
    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, preRestorePath);
    }
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const fileBuffer = Buffer.concat(chunks);
      if (fileBuffer.length < 100 || fileBuffer.toString('utf8', 0, 15) !== 'SQLite format 3') {
        return res.status(400).json({ error: 'Invalid SQLite database file' });
      }
      // Use db.restore() which properly closes the connection, replaces the file, and reinitializes
      db.restore(fileBuffer);
      res.json({ success: true, message: 'Database restored successfully. Refresh to apply changes.' });
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to restore database' });
  }
});

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

// --- ATTENDANCE RECORDS ---
router.get('/classes/:classId/records', requireClassAccess('classId'), async (req, res) => {
  try {
    const classId = req.params.classId;

    const records = await svc.recordService.getByClass(classId);
    const mapped = records.map((r: any) => ({
      studentId: r.student_id,
      date: r.date,
      status: r.status,
      reason: r.reason
    }));
    res.json(mapped);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch records' });
  }
});

router.post('/records', requireAuth, postLimiter, withWriteQueue(async (req, res) => {
  const teacherId = req.teacherId;
  const records = Array.isArray(req.body) ? req.body : [req.body];
  
  // N8: Verify both class access AND that each studentId belongs to that class.
  // Without the student check, a teacher could write records for students in foreign classes.
  for (const r of records) {
    const access = await svc.classService.isClassTeacher(r.classId, teacherId);
    if (!access) {
      return res.status(404).json({ error: `Class ${r.classId} not found or access denied` });
    }
    const student = await svc.studentService.getBelongsToClass(r.studentId, r.classId);
    if (!student) {
      return res.status(404).json({ error: `Student ${r.studentId} not found in class ${r.classId}` });
    }
  }

  for (const r of records) {
    await svc.recordService.insert(r.classId, r.studentId, r.date, r.status, r.reason || null);
  }
  res.json({ success: true });
  // Notify all unique class rooms that had records updated
  const classIds = [...new Set(records.map((r: any) => r.classId))];
  classIds.forEach((cid: any) => io?.to(cid).emit('records_updated'));
}));

// --- DAILY NOTES ---
router.get('/classes/:classId/daily-notes', requireClassAccess('classId'), async (req, res) => {
  try {
    const classId = req.params.classId;

    const notes = await svc.noteService.getByClass(classId) as DailyNote[];
    const response: Record<string, string> = {};
    for (const row of notes) {
      response[row.date] = row.note;
    }
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch daily notes' });
  }
});

router.post('/classes/:classId/daily-notes', requireClassAccess('classId'), postLimiter, withWriteQueue(async (req, res) => {
  const classId = req.params.classId;

  const { date, note } = req.body;
  await svc.noteService.upsert(classId, date, note);
  res.json({ success: true });
  io?.to(classId).emit('notes_updated');
}));

// --- EVENTS ---
router.get('/classes/:classId/events', requireClassAccess('classId'), async (req, res) => {
  try {
    const classId = req.params.classId;
    const events = await svc.eventService.getByClass(classId);
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

router.post('/classes/:classId/events', requireClassAccess('classId'), postLimiter, validate(eventSchema), withWriteQueue(async (req, res) => {
  const classId = req.params.classId;

  const events = Array.isArray(req.body) ? req.body : [req.body];
  for (const e of events) {
    await svc.eventService.insert(e.id, classId, e.date, e.title, e.type, e.description || null);
  }
  res.json({ success: true });
  io?.to(classId).emit('events_updated');
}));

router.put('/events/:id', postLimiter, withWriteQueue(async (req, res) => {
  const teacherId = req.teacherId;
  const eventId = req.params.id;
  
  const event = await svc.eventService.getById(eventId, teacherId);
  if (!event) {
    return res.status(404).json({ error: 'Event not found or access denied' });
  }

  const { date, title, type, description } = req.body;
  await svc.eventService.update({ date, title, type, description }, eventId, teacherId);
  res.json({ success: true });
  io?.to((event as CalendarEvent).class_id).emit('events_updated');
}));

router.delete('/events/:id', postLimiter, withWriteQueue(async (req, res) => {
  const teacherId = req.teacherId;
  const eventId = req.params.id;
  
  const event = await svc.eventService.getById(eventId, teacherId);
  if (!event) {
    return res.status(404).json({ error: 'Event not found or access denied' });
  }

  await svc.eventService.delete(eventId, teacherId);
  res.json({ success: true });
  io?.to((event as CalendarEvent).class_id).emit('events_updated');
}));

// --- TIMETABLE SLOTS ---
router.get('/classes/:classId/timetable', requireClassAccess('classId'), async (req, res) => {
  try {
    const classId = req.params.classId;

    const slots = await svc.timetableService.getByClass(classId);
    const mapped = slots.map((s: any) => ({
      id: s.id,
      dayOfWeek: s.day_of_week,
      startTime: s.start_time,
      endTime: s.end_time,
      subject: s.subject,
      lesson: s.lesson
    }));
    res.json(mapped);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch timetable' });
  }
});

router.post('/classes/:classId/timetable', requireClassAccess('classId'), postLimiter, validate(timetableSlotSchema), withWriteQueue(async (req, res) => {
  const classId = req.params.classId;

  const { id, dayOfWeek, startTime, endTime, subject, lesson } = req.body;
  await svc.timetableService.insert(id, classId, dayOfWeek, startTime, endTime, subject, lesson);
  res.json({ success: true });
  io?.to(classId).emit('timetable_updated');
}));

router.put('/timetable/:id', postLimiter, withWriteQueue(async (req, res) => {
  const teacherId = req.teacherId;
  const timetableId = req.params.id;
  
  const slot = await svc.timetableService.getById(timetableId, teacherId);
  if (!slot) {
    return res.status(404).json({ error: 'Timetable slot not found or access denied' });
  }

  const { dayOfWeek, startTime, endTime, subject, lesson } = req.body;
  await svc.timetableService.update({ day_of_week: dayOfWeek, start_time: startTime, end_time: endTime, subject, lesson }, timetableId, teacherId);
  res.json({ success: true });
  io?.to((slot as TimetableSlot).class_id).emit('timetable_updated');
}));

router.delete('/timetable/:id', postLimiter, withWriteQueue(async (req, res) => {
  const teacherId = req.teacherId;
  const timetableId = req.params.id;
  
  const slot = await svc.timetableService.getById(timetableId, teacherId);
  if (!slot) {
    return res.status(404).json({ error: 'Timetable slot not found or access denied' });
  }

  await svc.timetableService.delete(timetableId, teacherId);
  res.json({ success: true });
  io?.to((slot as TimetableSlot).class_id).emit('timetable_updated');
}));

// --- SEATING LAYOUT ---
router.get('/classes/:classId/seating', requireClassAccess('classId'), async (req, res) => {
  try {
    const classId = req.params.classId;

    const layout = await svc.seatingService.getByClass(classId) as SeatingLayoutRow[];
    const response: Record<string, string> = {};
    for (const row of layout) {
      response[row.seat_id] = row.student_id ?? '';
    }
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch seating layout' });
  }
});

router.post('/classes/:classId/seating', requireClassAccess('classId'), postLimiter, withWriteQueue(async (req, res) => {
  const classId = req.params.classId;

  const { seatId, studentId } = req.body;
  if (studentId === null) {
    await svc.seatingService.deleteSeat(classId, seatId);
  } else {
    await svc.seatingService.deleteStudent(classId, studentId);
    await svc.seatingService.insert(classId, seatId, studentId);
  }
  res.json({ success: true });
  io?.to(classId).emit('seating_updated');
}));

router.put('/classes/:classId/seating', requireClassAccess('classId'), postLimiter, withWriteQueue(async (req, res) => {
  const classId = req.params.classId;

  // N4: Use atomic saveLayout (SQLite transaction) instead of manual clear+loop
  // to prevent partial seating states if any insert fails.
  const layout = req.body as Record<string, string>;
  await svc.seatingService.saveLayout(classId, layout);
  res.json({ success: true });
  io?.to(classId).emit('seating_updated');
}));

router.delete('/classes/:classId/seating', requireClassAccess('classId'), postLimiter, withWriteQueue(async (req, res) => {
  const classId = req.params.classId;

  await svc.seatingService.clear(classId);
  res.json({ success: true });
  io?.to(classId).emit('seating_updated');
}));

// --- SETTINGS ---
router.get('/settings', requireAuth, async (req, res) => {
  try {
    const settings = await svc.settingService.getAll() as SettingRow[];
    const response: Record<string, string> = {};
    for (const row of settings) {
      if (row.key !== 'adminPassword') {
        response[row.key] = row.value;
      }
    }
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.post('/settings', postLimiter, validate(settingSchema), withWriteQueue(async (req, res) => {
  const { key, value } = req.body;
  if (key === 'adminPassword') {
    // Only the global admin can change the admin password
    const callerId = getTeacherId(req);
    const caller = callerId ? await svc.teacherService.getById(callerId) as Teacher | null : null;
    if (!caller || !caller.is_admin) {
      return res.status(403).json({ error: 'Only administrators can change the admin password' });
    }

    // Enforce minimum password length
    if (value.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }

    // N12: Wire adminPassword to actually update the admin teacher's password_hash.
    // Previously this wrote a hash to admin_settings that was never used for auth.
    const hash = bcrypt.hashSync(value, 10);
    const adminTeacher = await svc.teacherService.getByUsername('admin') as Teacher | null;
    if (adminTeacher) {
      await svc.teacherService.updatePassword(adminTeacher.id, hash);
      // Revoke all existing sessions so stale JWT cookies are rejected immediately on next request.
      // This prevents the race where an old cookie's sessionId passes requireAuth after a password change.
      await svc.sessionService.revokeAll(adminTeacher.id);
    }
  } else {
    await svc.settingService.set(key, value);
  }
  res.json({ success: true });
}));

export default router;
