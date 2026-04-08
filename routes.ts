import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import db from './db';
import path from 'path';
import fs from 'fs';
import { validate, loginSchema, classSchema, studentSchema, attendanceRecordSchema, eventSchema, timetableSlotSchema, teacherSchema, settingSchema } from './src/lib/validation';
import * as svc from './services';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

interface JwtPayload {
  teacherId: string;
  username: string;
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
        const session = await svc.sessionService.get(decoded.sessionId);
        if (!session || (session as any).is_revoked === 1 || new Date((session as any).expires_at) < new Date()) {
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
  
  (req as any).teacherId = teacherId;
  next();
};

const requireClassAccess = (paramName: string = 'classId') => {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const teacherId = (req as any).teacherId;
    const classId = req.params[paramName];
    
    if (!classId) {
      return res.status(400).json({ error: 'Class ID is required' });
    }
    
    const access = await svc.classService.isClassTeacher(classId, teacherId);
    if (!access) {
      return res.status(404).json({ error: 'Class not found or access denied' });
    }
    
    (req as any).classRole = (access as any).role;
    next();
  };
};

const requireClassOwner = (paramName: string = 'classId') => {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const teacherId = (req as any).teacherId;
    const classId = req.params[paramName];
    
    if (!classId) {
      return res.status(400).json({ error: 'Class ID is required' });
    }
    
    const access = await svc.classService.isClassTeacher(classId, teacherId);
    if (!access || (access as any).role !== 'owner') {
      return res.status(403).json({ error: 'Only class owner can perform this action' });
    }
    
    next();
  };
};

// Role hierarchy: owner > admin > teacher > assistant
const ROLE_HIERARCHY: Record<string, number> = { owner: 4, admin: 3, teacher: 2, assistant: 1 };

const requireRole = (paramName: string = 'classId', minRole: string = 'teacher') => {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const teacherId = (req as any).teacherId;
    const classId = req.params[paramName];
    
    if (!classId) {
      return res.status(400).json({ error: 'Class ID is required' });
    }
    
    const access = await svc.classService.isClassTeacher(classId, teacherId);
    if (!access) {
      return res.status(404).json({ error: 'Class not found or access denied' });
    }
    
    const userLevel = ROLE_HIERARCHY[(access as any).role] || 0;
    const requiredLevel = ROLE_HIERARCHY[minRole] || 0;
    
    if (userLevel < requiredLevel) {
      return res.status(403).json({ error: `Role '${minRole}' or higher required` });
    }
    
    (req as any).classRole = (access as any).role;
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

// --- AUTHENTICATION (NO AUTH REQUIRED) ---
router.post('/auth/login', authLimiter, validate(loginSchema), async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const teacher = await svc.teacherService.getByUsername(username);
  if (!teacher) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const isValid = bcrypt.compareSync(password, (teacher as any).password_hash);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const sessionId = `sess-${crypto.randomUUID()}`;
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  try {
    await svc.teacherService.updateLastLogin((teacher as any).id);
    await svc.sessionService.insert(sessionId, (teacher as any).id, req.headers['user-agent']?.slice(0, 100) || 'unknown', req.ip || 'unknown', expiresAt);
  } catch (e) {
    console.warn('[auth] Failed to create session record:', (e as Error).message);
  }

  const token = jwt.sign({ teacherId: (teacher as any).id, username: (teacher as any).username, sessionId }, JWT_SECRET, { expiresIn: '7d' });
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
  res.json({ success: true, teacherId: (teacher as any).id, username: (teacher as any).username, name: (teacher as any).name });
});

router.post('/auth/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.json({ success: true });
});

router.get('/auth/verify', async (req, res) => {
  const teacherId = getTeacherId(req);
  if (!teacherId) return res.status(401).json({ authenticated: false });
  const teacher = await svc.teacherService.getById(teacherId);
  if (!teacher) return res.status(401).json({ authenticated: false });
  res.json({ authenticated: true, teacherId, name: (teacher as any).name });
});

router.get('/auth/me', async (req, res) => {
  const teacherId = getTeacherId(req);
  if (!teacherId) return res.status(401).json({ error: 'Not authenticated' });
  const teacher = await svc.teacherService.getById(teacherId);
  if (!teacher) {
    return res.status(404).json({ error: 'Teacher not found' });
  }
  res.json(teacher);
});

router.get('/health', async (_req, res) => {
  try {
    const dbType = process.env.DB_TYPE || 'sqlite';
    if (dbType === 'postgres') {
      await svc.settingService.getAll(); // Test PG connection
    } else {
      db.prepare('SELECT 1').get();
    }
    res.json({ status: 'healthy', db: dbType, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: 'Database unavailable' });
  }
});

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

// --- TEACHER MANAGEMENT ---
router.post('/teachers/register', requireAuth, postLimiter, validate(teacherSchema), withWriteQueue(async (req, res) => {
  const teacherId = (req as any).teacherId;
  const { username, password, name } = req.body;
  if (!username || !password || !name) {
    return res.status(400).json({ error: 'Username, password, and name are required' });
  }

  // N6: Only class owners (admins) can register new teachers
  const isAdmin = await svc.teacherService.isAdmin(teacherId);
  if (!isAdmin) {
    return res.status(403).json({ error: 'Only class owners can register new teachers' });
  }

  const existing = await svc.teacherService.getByUsername(username);
  if (existing) {
    return res.status(400).json({ error: 'Username already exists' });
  }
  
  const id = `teacher_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const hash = bcrypt.hashSync(password, 10);
  await svc.teacherService.insert(id, username, hash, name);
  res.json({ success: true, id, username, name });
}));

router.get('/teachers', requireAuth, async (req, res) => {
  try {
    const teachers = await svc.teacherService.getAll();
    res.json(teachers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch teachers' });
  }
});

// All routes below require authentication
router.use(requireAuth);

// --- CLASSES ---
router.get('/classes', async (req, res) => {
  try {
    const teacherId = (req as any).teacherId;
    const classes = await svc.classService.getByTeacher(teacherId);
    res.json(classes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
});

router.post('/classes', postLimiter, validate(classSchema), withWriteQueue(async (req, res) => {
  const teacherId = (req as any).teacherId;
  const canCreate = await svc.classService.canCreateClass(teacherId);
  if (!canCreate) {
    return res.status(403).json({ error: 'You already manage a Homeroom class. To teach other classes, please ask their owners to invite you as a Subject Teacher.' });
  }

  const { id, name } = req.body;
  await svc.classService.insert(id, teacherId, name);
  res.json({ id, teacher_id: teacherId, name });
}));

router.put('/classes/:id', postLimiter, withWriteQueue(async (req, res) => {
  const teacherId = (req as any).teacherId;
  const { name } = req.body;
  const access = await svc.classService.isClassTeacher(req.params.id, teacherId);
  if (!access || (access as any).role !== 'owner') {
    return res.status(403).json({ error: 'Only the Homeroom Teacher can update the class' });
  }
  await svc.classService.update(name, req.params.id, teacherId);
  res.json({ success: true });
}));

router.delete('/classes/:id', postLimiter, withWriteQueue(async (req, res) => {
  const teacherId = (req as any).teacherId;
  const access = await svc.classService.isClassTeacher(req.params.id, teacherId);
  if (!access || (access as any).role !== 'owner') {
    return res.status(403).json({ error: 'Only the Homeroom Teacher can delete the class' });
  }
  await svc.classService.delete(req.params.id, teacherId);
  res.json({ success: true });
}));

// --- CLASS TEACHERS ---
router.get('/classes/:classId/teachers', async (req, res) => {
  try {
    const teacherId = (req as any).teacherId;
    const classId = req.params.classId;
    
    const access = await svc.classService.isClassTeacher(classId, teacherId);
    if (!access) {
      return res.status(404).json({ error: 'Class not found or access denied' });
    }

    const teachers = await svc.classService.getTeachers(classId);
    res.json(teachers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch class teachers' });
  }
});

router.post('/classes/:classId/teachers', postLimiter, withWriteQueue(async (req, res) => {
  const teacherId = (req as any).teacherId;
  const classId = req.params.classId;
  
  const access = await svc.classService.isClassTeacher(classId, teacherId);
  if (!access || (access as any).role !== 'owner') {
    return res.status(403).json({ error: 'Only the Homeroom Teacher can add other teachers' });
  }

  const { teacherId: newTeacherId } = req.body;
  if (!newTeacherId) {
    return res.status(400).json({ error: 'teacherId is required' });
  }

  const existing = await svc.teacherService.getById(newTeacherId);
  if (!existing) {
    return res.status(404).json({ error: 'Teacher not found' });
  }

  await svc.classService.addTeacher(classId, newTeacherId, 'teacher');
  res.json({ success: true });
}));

router.delete('/classes/:classId/teachers/:teacherId', postLimiter, withWriteQueue(async (req, res) => {
  const teacherId = (req as any).teacherId;
  const classId = req.params.classId;
  const targetTeacherId = req.params.teacherId;
  
  const access = await svc.classService.isClassTeacher(classId, teacherId);
  if (!access || (access as any).role !== 'owner') {
    return res.status(403).json({ error: 'Only the Homeroom Teacher can remove other teachers' });
  }

  if (targetTeacherId === teacherId) {
    return res.status(400).json({ error: 'Cannot remove yourself' });
  }

  await svc.classService.removeTeacher(classId, targetTeacherId);
  res.json({ success: true });
}));

// --- INVITE SYSTEM (Phase 2.2) ---
router.post('/classes/:classId/invites', requireRole('classId', 'admin'), postLimiter, withWriteQueue(async (req, res) => {
  const teacherId = (req as any).teacherId;
  const classId = req.params.classId;
  const { role, expiresInHours } = req.body;
  
  const validRoles = ['admin', 'teacher', 'assistant'];
  const inviteRole = role || 'teacher';
  if (!validRoles.includes(inviteRole)) {
    return res.status(400).json({ error: 'Invalid role. Must be admin, teacher, or assistant' });
  }
  
  if (inviteRole === 'admin' && (req as any).classRole !== 'owner') {
    return res.status(403).json({ error: 'Only the Homeroom Teacher can create admin invites' });
  }
  
  const expiryHours = Math.min(Math.max(Number(expiresInHours) || 48, 1), 720);
  const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString();
  
  const code = `inv-${crypto.randomUUID().slice(0, 12)}`;
  await svc.inviteService.insert(code, classId, inviteRole, teacherId, expiresAt);
  
  const inviteUrl = `${req.protocol}://${req.get('host')}/invite/${code}`;
  res.json({ success: true, code, inviteUrl, role: inviteRole, expiresAt });
}));

router.get('/classes/:classId/invites', requireRole('classId', 'admin'), async (req, res) => {
  try {
    await svc.inviteService.deleteExpired();
    const codes = await svc.inviteService.getByClass(req.params.classId);
    res.json(codes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch invite codes' });
  }
});

router.delete('/classes/:classId/invites/:code', requireRole('classId', 'admin'), postLimiter, withWriteQueue(async (req, res) => {
  await svc.inviteService.delete(req.params.code);
  res.json({ success: true });
}));

router.post('/invites/redeem', requireAuth, postLimiter, withWriteQueue(async (req, res) => {
  const teacherId = (req as any).teacherId;
  const { code } = req.body;
  
  if (!code) {
    return res.status(400).json({ error: 'Invite code is required' });
  }
  
  const invite = await svc.inviteService.getByCode(code);
  if (!invite) {
    return res.status(404).json({ error: 'Invalid invite code' });
  }
  
  if ((invite as any).used_by) {
    return res.status(400).json({ error: 'This invite code has already been used' });
  }
  
  if (new Date((invite as any).expires_at) < new Date()) {
    return res.status(400).json({ error: 'This invite code has expired' });
  }
  
  const classExists = await svc.classService.getById((invite as any).class_id, teacherId);
  if (!classExists) {
    return res.status(404).json({ error: 'This class no longer exists' });
  }
  
  const existing = await svc.classService.isClassTeacher((invite as any).class_id, teacherId);
  if (existing) {
    return res.status(400).json({ error: 'You already have access to this class' });
  }
  
  await svc.inviteService.use(teacherId, code);
  await svc.classService.addTeacher((invite as any).class_id, teacherId, (invite as any).role);
  
  const className = classExists;
  res.json({ success: true, className: (className as any)?.name, role: (invite as any).role });
}));

// --- SESSION MANAGEMENT (Phase 2.3) ---
router.get('/sessions', async (req, res) => {
  try {
    const teacherId = (req as any).teacherId;
    await svc.sessionService.deleteExpired();
    const sessions = await svc.sessionService.getByTeacher(teacherId);
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

router.post('/sessions/revoke', postLimiter, withWriteQueue(async (req, res) => {
  const teacherId = (req as any).teacherId;
  const { sessionId } = req.body;
  
  if (sessionId === 'all') {
    await svc.sessionService.revokeAll(teacherId);
    return res.json({ success: true, message: 'All sessions revoked' });
  }
  
  const session = await svc.sessionService.get(sessionId);
  if (!session || (session as any).teacher_id !== teacherId) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  await svc.sessionService.revoke(sessionId);
  res.json({ success: true });
}));

// --- CLASS TEACHER ROLE MANAGEMENT ---
router.put('/classes/:classId/teachers/:teacherId/role', requireClassOwner('classId'), postLimiter, withWriteQueue(async (req, res) => {
  const classId = req.params.classId;
  const targetTeacherId = req.params.teacherId;
  const { role } = req.body;
  
  const validRoles = ['owner', 'admin', 'teacher', 'assistant'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  
  const existing = await svc.classService.isClassTeacher(classId, targetTeacherId);
  if (!existing) {
    return res.status(404).json({ error: 'Teacher not found in this class' });
  }
  
  await svc.classService.updateTeacherRole(role, classId, targetTeacherId);
  res.json({ success: true });
}));

// --- STUDENTS ---
router.get('/classes/:classId/students', requireClassAccess('classId'), async (req, res) => {
  try {
    const classId = req.params.classId;
    
    const includeArchived = req.query.includeArchived === 'true';
    const students = await svc.studentService.getByClass(classId, includeArchived);
    const mapped = students.map((s: any) => ({
      id: s.id,
      name: s.name,
      rollNumber: s.roll_number,
      parentName: s.parent_name,
      parentPhone: s.parent_phone,
      isFlagged: s.is_flagged === 1,
      isArchived: s.is_archived === 1
    }));
    res.json(mapped);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

router.post('/classes/:classId/students', requireClassAccess('classId'), postLimiter, validate(studentSchema), withWriteQueue(async (req, res) => {
  const classId = req.params.classId;

  const { id, name, rollNumber, parentName, parentPhone, isFlagged } = req.body;
  await svc.studentService.insert(id, classId, name, rollNumber, parentName || null, parentPhone || null, isFlagged ? 1 : 0);
  res.json({ success: true });
}));

router.put('/students/:id', postLimiter, withWriteQueue(async (req, res) => {
  const teacherId = (req as any).teacherId;
  const studentId = req.params.id;
  
  const student = await svc.studentService.getById(studentId, teacherId);
  if (!student) {
    return res.status(404).json({ error: 'Student not found or access denied' });
  }

  const { name, rollNumber, parentName, parentPhone, isFlagged, isArchived } = req.body;
  const updateData: any = {};
  if (name !== undefined) updateData.name = name;
  if (rollNumber !== undefined) updateData.roll_number = rollNumber;
  if (parentName !== undefined) updateData.parent_name = parentName;
  if (parentPhone !== undefined) updateData.parent_phone = parentPhone;
  if (isFlagged !== undefined) updateData.is_flagged = isFlagged ? 1 : 0;
  if (isArchived !== undefined) updateData.is_archived = isArchived ? 1 : 0;
  
  await svc.studentService.update(updateData, studentId, teacherId);
  res.json({ success: true });
}));

router.delete('/students/:id', postLimiter, withWriteQueue(async (req, res) => {
  const teacherId = (req as any).teacherId;
  const studentId = req.params.id;
  
  const student = await svc.studentService.getById(studentId, teacherId);
  if (!student) {
    return res.status(404).json({ error: 'Student not found or access denied' });
  }

  await svc.studentService.archive(studentId, teacherId);
  res.json({ success: true });
}));

router.post('/classes/:classId/students/sync', requireClassAccess('classId'), postLimiter, withWriteQueue(async (req, res) => {
  const classId = req.params.classId;
  const teacherId = (req as any).teacherId;
  
  const importedStudents = Array.isArray(req.body) ? req.body : [];
  const syncedStudents: any[] = [];
  
  const existingRows = await svc.studentService.getByClass(classId, true);
  const existingMap = new Map<string, string>(existingRows.map((r: any) => [r.roll_number, r.id] as [string, string]));

  for (const s of importedStudents) {
    const existingId = existingMap.get(s.rollNumber);
    let finalId = s.id;
    if (existingId) {
      finalId = existingId;
      await svc.studentService.update({ name: s.name, parent_name: s.parentName, parent_phone: s.parentPhone, is_flagged: s.isFlagged ? 1 : 0 }, existingId, teacherId);
    } else {
      await svc.studentService.insert(s.id, classId, s.name, s.rollNumber, s.parentName || null, s.parentPhone || null, s.isFlagged ? 1 : 0);
    }
    syncedStudents.push({ ...s, id: finalId });
  }

  res.json({ success: true, students: syncedStudents });
}));

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
  const teacherId = (req as any).teacherId;
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
    await svc.recordService.insert(r.studentId, r.date, r.status, r.reason || null);
  }
  res.json({ success: true });
}));

// --- DAILY NOTES ---
router.get('/classes/:classId/daily-notes', requireClassAccess('classId'), async (req, res) => {
  try {
    const classId = req.params.classId;

    const notes = await svc.noteService.getByClass(classId);
    const response: Record<string, string> = {};
    for (const row of notes as any) {
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
}));

router.put('/events/:id', postLimiter, withWriteQueue(async (req, res) => {
  const teacherId = (req as any).teacherId;
  const eventId = req.params.id;
  
  const event = await svc.eventService.getById(eventId, teacherId);
  if (!event) {
    return res.status(404).json({ error: 'Event not found or access denied' });
  }

  const { date, title, type, description } = req.body;
  await svc.eventService.update({ date, title, type, description }, eventId, teacherId);
  res.json({ success: true });
}));

router.delete('/events/:id', postLimiter, withWriteQueue(async (req, res) => {
  const teacherId = (req as any).teacherId;
  const eventId = req.params.id;
  
  const event = await svc.eventService.getById(eventId, teacherId);
  if (!event) {
    return res.status(404).json({ error: 'Event not found or access denied' });
  }

  await svc.eventService.delete(eventId, teacherId);
  res.json({ success: true });
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
}));

router.put('/timetable/:id', postLimiter, withWriteQueue(async (req, res) => {
  const teacherId = (req as any).teacherId;
  const timetableId = req.params.id;
  
  const slot = await svc.timetableService.getById(timetableId, teacherId);
  if (!slot) {
    return res.status(404).json({ error: 'Timetable slot not found or access denied' });
  }

  const { dayOfWeek, startTime, endTime, subject, lesson } = req.body;
  await svc.timetableService.update({ day_of_week: dayOfWeek, start_time: startTime, end_time: endTime, subject, lesson }, timetableId, teacherId);
  res.json({ success: true });
}));

router.delete('/timetable/:id', postLimiter, withWriteQueue(async (req, res) => {
  const teacherId = (req as any).teacherId;
  const timetableId = req.params.id;
  
  const slot = await svc.timetableService.getById(timetableId, teacherId);
  if (!slot) {
    return res.status(404).json({ error: 'Timetable slot not found or access denied' });
  }

  await svc.timetableService.delete(timetableId, teacherId);
  res.json({ success: true });
}));

// --- SEATING LAYOUT ---
router.get('/classes/:classId/seating', requireClassAccess('classId'), async (req, res) => {
  try {
    const classId = req.params.classId;

    const layout = await svc.seatingService.getByClass(classId);
    const response: Record<string, string> = {};
    for (const row of layout as any) {
      response[row.seat_id] = row.student_id;
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
}));

router.put('/classes/:classId/seating', requireClassAccess('classId'), postLimiter, withWriteQueue(async (req, res) => {
  const classId = req.params.classId;

  // N4: Use atomic saveLayout (SQLite transaction) instead of manual clear+loop
  // to prevent partial seating states if any insert fails.
  const layout = req.body as Record<string, string>;
  await svc.seatingService.saveLayout(classId, layout);
  res.json({ success: true });
}));

router.delete('/classes/:classId/seating', requireClassAccess('classId'), postLimiter, withWriteQueue(async (req, res) => {
  const classId = req.params.classId;

  await svc.seatingService.clear(classId);
  res.json({ success: true });
}));

// --- SETTINGS ---
router.get('/settings', async (req, res) => {
  try {
    const settings = await svc.settingService.getAll();
    const response: Record<string, string> = {};
    for (const row of settings as any) {
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
    // N12: Wire adminPassword to actually update the admin teacher's password_hash.
    // Previously this wrote a hash to admin_settings that was never used for auth.
    const hash = bcrypt.hashSync(value, 10);
    const adminTeacher = await svc.teacherService.getByUsername('admin');
    if (adminTeacher) {
      await svc.teacherService.updatePassword((adminTeacher as any).id, hash);
    }
    // Also allow any logged-in teacher to change their own password via this endpoint
    // if they are the requester (future improvement: add current-password verification)
  } else {
    await svc.settingService.set(key, value);
  }
  res.json({ success: true });
}));

export default router;
