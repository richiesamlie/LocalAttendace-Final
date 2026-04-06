import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import db from './db';
import path from 'path';
import fs from 'fs';
import { validate, loginSchema, classSchema, studentSchema, attendanceRecordSchema, eventSchema, timetableSlotSchema, teacherSchema, settingSchema } from './src/lib/validation';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required. Set it in your .env file before starting the server.');
}

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
    return null;
  }
};

const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const teacherId = getTeacherId(req);
  if (!teacherId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const token = req.cookies?.auth_token;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload & { sessionId?: string };
      if (decoded.sessionId) {
        const session = db.stmt.getSession.get(decoded.sessionId) as { is_revoked: number; expires_at: string } | undefined;
        if (!session || session.is_revoked === 1 || new Date(session.expires_at) < new Date()) {
          res.clearCookie('auth_token');
          return res.status(401).json({ error: 'Session expired or revoked' });
        }
        try { db.stmt.updateSessionActivity.run(decoded.sessionId); } catch (e) {
          // Session activity update is non-critical, but log it
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
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const teacherId = (req as any).teacherId;
    const classId = req.params[paramName];
    
    if (!classId) {
      return res.status(400).json({ error: 'Class ID is required' });
    }
    
    const access = db.stmt.isClassTeacher.get(classId, teacherId) as { class_id: string; role: string } | undefined;
    if (!access) {
      return res.status(404).json({ error: 'Class not found or access denied' });
    }
    
    (req as any).classRole = access.role;
    next();
  };
};

const requireClassOwner = (paramName: string = 'classId') => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const teacherId = (req as any).teacherId;
    const classId = req.params[paramName];
    
    if (!classId) {
      return res.status(400).json({ error: 'Class ID is required' });
    }
    
    const access = db.stmt.isClassTeacher.get(classId, teacherId) as { class_id: string; role: string } | undefined;
    if (!access || access.role !== 'owner') {
      return res.status(403).json({ error: 'Only class owner can perform this action' });
    }
    
    next();
  };
};

// Role hierarchy: owner > admin > teacher > assistant
const ROLE_HIERARCHY: Record<string, number> = { owner: 4, admin: 3, teacher: 2, assistant: 1 };

const requireRole = (paramName: string = 'classId', minRole: string = 'teacher') => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const teacherId = (req as any).teacherId;
    const classId = req.params[paramName];
    
    if (!classId) {
      return res.status(400).json({ error: 'Class ID is required' });
    }
    
    const access = db.stmt.isClassTeacher.get(classId, teacherId) as { class_id: string; role: string } | undefined;
    if (!access) {
      return res.status(404).json({ error: 'Class not found or access denied' });
    }
    
    const userLevel = ROLE_HIERARCHY[access.role] || 0;
    const requiredLevel = ROLE_HIERARCHY[minRole] || 0;
    
    if (userLevel < requiredLevel) {
      return res.status(403).json({ error: `Role '${minRole}' or higher required` });
    }
    
    (req as any).classRole = access.role;
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
router.post('/auth/login', authLimiter, validate(loginSchema), (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const teacher = db.stmt.getTeacherByUsername.get(username) as { id: string; username: string; password_hash: string; name: string } | undefined;
  
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
    db.stmt.updateTeacherLastLogin.run(teacher.id);
    db.stmt.insertSession.run(sessionId, teacher.id, req.headers['user-agent']?.slice(0, 100) || 'unknown', req.ip || 'unknown', expiresAt);
  } catch (e) {
    // Session tracking is non-critical
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
  res.json({ success: true, teacherId: teacher.id, username: teacher.username, name: teacher.name });
});

router.post('/auth/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.json({ success: true });
});

router.get('/auth/verify', (req, res) => {
  const teacherId = getTeacherId(req);
  if (!teacherId) return res.status(401).json({ authenticated: false });
  const teacher = db.stmt.getTeacherById.get(teacherId) as { id: string; username: string; name: string } | undefined;
  if (!teacher) return res.status(401).json({ authenticated: false });
  res.json({ authenticated: true, teacherId, name: teacher.name });
});

router.get('/auth/me', (req, res) => {
  const teacherId = getTeacherId(req);
  if (!teacherId) return res.status(401).json({ error: 'Not authenticated' });
  const teacher = db.stmt.getTeacherById.get(teacherId) as { id: string; username: string; name: string } | undefined;
  if (!teacher) {
    return res.status(404).json({ error: 'Teacher not found' });
  }
  res.json(teacher);
});

router.get('/health', (_req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
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
router.post('/teachers/register', requireAuth, postLimiter, validate(teacherSchema), withWriteQueue((req, res) => {
  const { username, password, name } = req.body;
  if (!username || !password || !name) {
    return res.status(400).json({ error: 'Username, password, and name are required' });
  }
  
  const existing = db.stmt.getTeacherByUsername.get(username);
  if (existing) {
    return res.status(400).json({ error: 'Username already exists' });
  }
  
  const id = `teacher_${Date.now()}`;
  const hash = bcrypt.hashSync(password, 10);
  db.stmt.insertTeacher.run(id, username, hash, name);
  db.cache.invalidate('teachers:all');
  res.json({ success: true, id, username, name });
}));

router.get('/teachers', (req, res) => {
  try {
    const teachers = db.cache.cached('teachers:all', () => db.stmt.getAllTeachers.all(), 60000);
    res.json(teachers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch teachers' });
  }
});

// All routes below require authentication
router.use(requireAuth);

// --- CLASSES ---
router.get('/classes', (req, res) => {
  try {
    const teacherId = (req as any).teacherId;
    const classes = db.cache.cached(`classes:${teacherId}`, () => db.stmt.getClassesByTeacher.all(teacherId), 5000);
    res.json(classes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
});

router.post('/classes', postLimiter, validate(classSchema), withWriteQueue((req, res) => {
  const teacherId = (req as any).teacherId;
  const { id, name } = req.body;
  db.stmt.insertClass.run(id, teacherId, name);
  db.stmt.insertClassTeacher.run(id, teacherId, 'owner');
  db.cache.invalidate(`classes:${teacherId}`);
  res.json({ id, teacher_id: teacherId, name });
}));

router.put('/classes/:id', postLimiter, withWriteQueue((req, res) => {
  const teacherId = (req as any).teacherId;
  const { name } = req.body;
  const access = db.stmt.isClassTeacher.get(req.params.id, teacherId) as { class_id: string; role: string } | undefined;
  if (!access || access.role !== 'owner') {
    return res.status(403).json({ error: 'Only class owner can update class' });
  }
  const result = db.stmt.updateClass.run(name, req.params.id, teacherId);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Class not found' });
  }
  db.cache.invalidate(`classes:${teacherId}`);
  res.json({ success: true });
}));

router.delete('/classes/:id', postLimiter, withWriteQueue((req, res) => {
  const teacherId = (req as any).teacherId;
  const access = db.stmt.isClassTeacher.get(req.params.id, teacherId) as { class_id: string; role: string } | undefined;
  if (!access || access.role !== 'owner') {
    return res.status(403).json({ error: 'Only class owner can delete class' });
  }
  const result = db.stmt.deleteClass.run(req.params.id, teacherId);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Class not found' });
  }
  db.cache.invalidate(`classes:${teacherId}`);
  res.json({ success: true });
}));

// --- CLASS TEACHERS ---
router.get('/classes/:classId/teachers', (req, res) => {
  try {
    const teacherId = (req as any).teacherId;
    const classId = req.params.classId;
    
    const access = db.stmt.isClassTeacher.get(classId, teacherId) as { class_id: string; role: string } | undefined;
    if (!access) {
      return res.status(404).json({ error: 'Class not found or access denied' });
    }

    const teachers = db.cache.cached(`teachers:class:${classId}`, () => db.stmt.getClassTeachers.all(classId), 5000);
    res.json(teachers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch class teachers' });
  }
});

router.post('/classes/:classId/teachers', postLimiter, withWriteQueue((req, res) => {
  const teacherId = (req as any).teacherId;
  const classId = req.params.classId;
  
  const access = db.stmt.isClassTeacher.get(classId, teacherId) as { class_id: string; role: string } | undefined;
  if (!access || access.role !== 'owner') {
    return res.status(403).json({ error: 'Only class owner can add teachers' });
  }

  const { teacherId: newTeacherId } = req.body;
  if (!newTeacherId) {
    return res.status(400).json({ error: 'teacherId is required' });
  }

  const existing = db.stmt.getTeacherById.get(newTeacherId);
  if (!existing) {
    return res.status(404).json({ error: 'Teacher not found' });
  }

  db.stmt.insertClassTeacher.run(classId, newTeacherId, 'teacher');
  db.cache.invalidate(`teachers:class:${classId}`);
  res.json({ success: true });
}));

router.delete('/classes/:classId/teachers/:teacherId', postLimiter, withWriteQueue((req, res) => {
  const teacherId = (req as any).teacherId;
  const classId = req.params.classId;
  const targetTeacherId = req.params.teacherId;
  
  const access = db.stmt.isClassTeacher.get(classId, teacherId) as { class_id: string; role: string } | undefined;
  if (!access || access.role !== 'owner') {
    return res.status(403).json({ error: 'Only class owner can remove teachers' });
  }

  if (targetTeacherId === teacherId) {
    return res.status(400).json({ error: 'Cannot remove yourself' });
  }

  db.stmt.removeClassTeacher.run(classId, targetTeacherId);
  db.cache.invalidate(`teachers:class:${classId}`);
  res.json({ success: true });
}));

// --- INVITE SYSTEM (Phase 2.2) ---
router.post('/classes/:classId/invites', requireRole('classId', 'admin'), postLimiter, withWriteQueue((req, res) => {
  const teacherId = (req as any).teacherId;
  const classId = req.params.classId;
  const { role, expiresInHours } = req.body;
  
  const validRoles = ['admin', 'teacher', 'assistant'];
  const inviteRole = role || 'teacher';
  if (!validRoles.includes(inviteRole)) {
    return res.status(400).json({ error: 'Invalid role. Must be admin, teacher, or assistant' });
  }
  
  if (inviteRole === 'admin' && (req as any).classRole !== 'owner') {
    return res.status(403).json({ error: 'Only class owner can create admin invites' });
  }
  
  const expiryHours = Math.min(Math.max(Number(expiresInHours) || 48, 1), 720);
  const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString();
  
  const code = `inv-${crypto.randomUUID().slice(0, 12)}`;
  db.stmt.insertInviteCode.run(code, classId, inviteRole, teacherId, expiresAt);
  
  const inviteUrl = `${req.protocol}://${req.get('host')}/invite/${code}`;
  res.json({ success: true, code, inviteUrl, role: inviteRole, expiresAt });
}));

router.get('/classes/:classId/invites', requireRole('classId', 'admin'), (req, res) => {
  try {
    db.stmt.deleteExpiredInviteCodes.run();
    const codes = db.stmt.getClassInviteCodes.all(req.params.classId);
    res.json(codes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch invite codes' });
  }
});

router.delete('/classes/:classId/invites/:code', requireRole('classId', 'admin'), postLimiter, withWriteQueue((req, res) => {
  const result = db.stmt.deleteInviteCode.run(req.params.code);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Invite code not found' });
  }
  res.json({ success: true });
}));

router.post('/invites/redeem', requireAuth, postLimiter, withWriteQueue((req, res) => {
  const teacherId = (req as any).teacherId;
  const { code } = req.body;
  
  if (!code) {
    return res.status(400).json({ error: 'Invite code is required' });
  }
  
  const invite = db.stmt.getInviteCode.get(code) as { code: string; class_id: string; role: string; expires_at: string; used_by: string | null } | undefined;
  if (!invite) {
    return res.status(404).json({ error: 'Invalid invite code' });
  }
  
  if (invite.used_by) {
    return res.status(400).json({ error: 'This invite code has already been used' });
  }
  
  if (new Date(invite.expires_at) < new Date()) {
    return res.status(400).json({ error: 'This invite code has expired' });
  }
  
  const classExists = db.stmt.getClassById.get(invite.class_id, teacherId);
  if (!classExists) {
    return res.status(404).json({ error: 'This class no longer exists' });
  }
  
  const existing = db.stmt.isClassTeacher.get(invite.class_id, teacherId) as { class_id: string } | undefined;
  if (existing) {
    return res.status(400).json({ error: 'You already have access to this class' });
  }
  
  db.stmt.useInviteCode.run(teacherId, code);
  db.stmt.insertClassTeacher.run(invite.class_id, teacherId, invite.role);
  
  const className = db.stmt.getClassById.get(invite.class_id, teacherId) as { name: string } | undefined;
  res.json({ success: true, className: className?.name, role: invite.role });
}));

// --- SESSION MANAGEMENT (Phase 2.3) ---
router.get('/sessions', (req, res) => {
  try {
    const teacherId = (req as any).teacherId;
    db.stmt.deleteExpiredSessions.run();
    const sessions = db.stmt.getSessionsByTeacher.all(teacherId);
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

router.post('/sessions/revoke', postLimiter, withWriteQueue((req, res) => {
  const teacherId = (req as any).teacherId;
  const { sessionId } = req.body;
  
  if (sessionId === 'all') {
    db.stmt.revokeAllSessions.run(teacherId);
    return res.json({ success: true, message: 'All sessions revoked' });
  }
  
  const session = db.stmt.getSession.get(sessionId) as { teacher_id: string } | undefined;
  if (!session || session.teacher_id !== teacherId) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  db.stmt.revokeSession.run(sessionId);
  res.json({ success: true });
}));

// --- CLASS TEACHER ROLE MANAGEMENT ---
router.put('/classes/:classId/teachers/:teacherId/role', requireClassOwner('classId'), postLimiter, withWriteQueue((req, res) => {
  const classId = req.params.classId;
  const targetTeacherId = req.params.teacherId;
  const { role } = req.body;
  
  const validRoles = ['owner', 'admin', 'teacher', 'assistant'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  
  const existing = db.stmt.isClassTeacher.get(classId, targetTeacherId) as { class_id: string } | undefined;
  if (!existing) {
    return res.status(404).json({ error: 'Teacher not found in this class' });
  }
  
  db.stmt.updateClassTeacherRole.run(role, classId, targetTeacherId);
  res.json({ success: true });
}));

// --- STUDENTS ---
router.get('/classes/:classId/students', requireClassAccess('classId'), (req, res) => {
  try {
    const classId = req.params.classId;
    
    const includeArchived = req.query.includeArchived === 'true';
    const students = includeArchived 
      ? db.stmt.getStudentsByClassWithArchived.all(classId) 
      : db.stmt.getStudentsByClass.all(classId);
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

router.post('/classes/:classId/students', requireClassAccess('classId'), postLimiter, validate(studentSchema), withWriteQueue((req, res) => {
  const classId = req.params.classId;

  const { id, name, rollNumber, parentName, parentPhone, isFlagged } = req.body;
  db.stmt.insertStudent.run(id, classId, name, rollNumber, parentName || null, parentPhone || null, isFlagged ? 1 : 0);
  res.json({ success: true });
}));

router.put('/students/:id', postLimiter, withWriteQueue((req, res) => {
  const teacherId = (req as any).teacherId;
  const studentId = req.params.id;
  
  const student = db.stmt.getStudentById.get(studentId, teacherId) as { id: string; name: string; roll_number: string; parent_name: string; parent_phone: string; is_flagged: number; is_archived: number } | undefined;
  if (!student) {
    return res.status(404).json({ error: 'Student not found or access denied' });
  }

  const { name, rollNumber, parentName, parentPhone, isFlagged, isArchived } = req.body;
  const result = db.stmt.updateStudent.run(
    name ?? student.name, 
    rollNumber ?? student.roll_number, 
    parentName ?? student.parent_name, 
    parentPhone ?? student.parent_phone, 
    isFlagged !== undefined ? (isFlagged ? 1 : 0) : student.is_flagged, 
    isArchived !== undefined ? (isArchived ? 1 : 0) : student.is_archived,
    studentId,
    teacherId
  );
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Student not found or access denied' });
  }
  res.json({ success: true });
}));

router.delete('/students/:id', postLimiter, withWriteQueue((req, res) => {
  const teacherId = (req as any).teacherId;
  const studentId = req.params.id;
  
  const student = db.stmt.getStudentById.get(studentId, teacherId);
  if (!student) {
    return res.status(404).json({ error: 'Student not found or access denied' });
  }

  const result = db.stmt.archiveStudent.run(studentId, teacherId);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Student not found or access denied' });
  }
  res.json({ success: true });
}));

router.post('/classes/:classId/students/sync', requireClassAccess('classId'), postLimiter, withWriteQueue((req, res) => {
  const classId = req.params.classId;
  
  const importedStudents = Array.isArray(req.body) ? req.body : [];
  const syncedStudents: any[] = [];
  
  const transaction = db.transaction((stds) => {
    const existingRows = db.stmt.getStudentsByClassWithArchived.all(classId) as any[];
    const existingMap = new Map(existingRows.map(r => [r.roll_number, r.id]));
    
    const insert = db.stmt.insertStudent;
    const update = db.prepare('UPDATE students SET name = ?, parent_name = ?, parent_phone = ?, is_flagged = ?, is_archived = 0 WHERE id = ?');
    const deleteStmt = db.stmt.archiveStudent;

    const importedRolls = new Set();

    for (const s of stds) {
      importedRolls.add(s.rollNumber);
      const existingId = existingMap.get(s.rollNumber);
      
      let finalId = s.id;
      if (existingId) {
        finalId = existingId;
        update.run(s.name, s.parentName || null, s.parentPhone || null, s.isFlagged ? 1 : 0, existingId);
      } else {
        insert.run(s.id, classId, s.name, s.rollNumber, s.parentName || null, s.parentPhone || null, s.isFlagged ? 1 : 0);
      }
      
      syncedStudents.push({ ...s, id: finalId });
    }

    for (const [roll, id] of existingMap.entries()) {
      if (!importedRolls.has(roll)) {
         deleteStmt.run(id);
      }
    }
  });

  transaction(importedStudents);
  res.json({ success: true, students: syncedStudents });
}));

// --- ATTENDANCE RECORDS ---
router.get('/classes/:classId/records', requireClassAccess('classId'), (req, res) => {
  try {
    const classId = req.params.classId;

    const { date, startDate, endDate, limit, offset } = req.query;
    
    let query = 'SELECT student_id, class_id, date, status, reason FROM attendance_records WHERE class_id = ?';
    const params: any[] = [classId];
    
    if (date) {
      query += ' AND date = ?';
      params.push(date);
    } else if (startDate && endDate) {
      query += ' AND date >= ? AND date <= ?';
      params.push(startDate, endDate);
    }
    
    query += ' ORDER BY date DESC, student_id ASC';
    
    if (limit) {
      query += ' LIMIT ?';
      params.push(Number(limit));
    }
    if (offset) {
      query += ' OFFSET ?';
      params.push(Number(offset));
    }
    
    const records = db.prepare(query).all(...params);
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

router.post('/records', requireAuth, postLimiter, withWriteQueue((req, res) => {
  const teacherId = (req as any).teacherId;
  const records = Array.isArray(req.body) ? req.body : [req.body];
  
  for (const r of records) {
    const access = db.stmt.isClassTeacher.get(r.classId, teacherId) as { class_id: string; role: string } | undefined;
    if (!access) {
      return res.status(404).json({ error: `Class ${r.classId} not found or access denied` });
    }
  }

  const insert = db.stmt.insertAttendance;
  const transaction = db.transaction((recs) => {
    for (const r of recs) {
      insert.run(r.studentId, r.classId, r.date, r.status, r.reason || null);
    }
  });
  transaction(records);
  res.json({ success: true });
}));

// --- DAILY NOTES ---
router.get('/classes/:classId/daily-notes', requireClassAccess('classId'), (req, res) => {
  try {
    const classId = req.params.classId;

    const notes = db.stmt.getDailyNotesByClass.all(classId);
    const response: Record<string, string> = {};
    for (const row of notes as any) {
      response[row.date] = row.note;
    }
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch daily notes' });
  }
});

router.post('/classes/:classId/daily-notes', requireClassAccess('classId'), postLimiter, withWriteQueue((req, res) => {
  const classId = req.params.classId;

  const { date, note } = req.body;
  db.stmt.insertDailyNote.run(classId, date, note);
  res.json({ success: true });
}));

// --- EVENTS ---
router.get('/classes/:classId/events', requireClassAccess('classId'), (req, res) => {
  try {
    const classId = req.params.classId;

    const { limit, offset, type, startDate, endDate } = req.query;
    
    let query = 'SELECT id, class_id, date, title, type, description FROM events WHERE class_id = ?';
    const params: any[] = [classId];
    
    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }
    if (startDate && endDate) {
      query += ' AND date >= ? AND date <= ?';
      params.push(startDate, endDate);
    }
    
    query += ' ORDER BY date DESC';
    
    if (limit) {
      query += ' LIMIT ?';
      params.push(Number(limit));
    }
    if (offset) {
      query += ' OFFSET ?';
      params.push(Number(offset));
    }
    
    const events = db.prepare(query).all(...params);
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

router.post('/classes/:classId/events', requireClassAccess('classId'), postLimiter, validate(eventSchema), withWriteQueue((req, res) => {
  const classId = req.params.classId;

  const events = Array.isArray(req.body) ? req.body : [req.body];
  const insert = db.stmt.insertEvent;
  const transaction = db.transaction((evts) => {
    for (const e of evts) {
      insert.run(e.id, classId, e.date, e.title, e.type, e.description || null);
    }
  });
  transaction(events);
  res.json({ success: true });
}));

router.put('/events/:id', postLimiter, withWriteQueue((req, res) => {
  const teacherId = (req as any).teacherId;
  const eventId = req.params.id;
  
  const event = db.stmt.getEventById.get(eventId, teacherId);
  if (!event) {
    return res.status(404).json({ error: 'Event not found or access denied' });
  }

  const { date, title, type, description } = req.body;
  const result = db.stmt.updateEvent.run(date, title, type, description || null, eventId, teacherId);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Event not found or access denied' });
  }
  res.json({ success: true });
}));

router.delete('/events/:id', postLimiter, withWriteQueue((req, res) => {
  const teacherId = (req as any).teacherId;
  const eventId = req.params.id;
  
  const event = db.stmt.getEventById.get(eventId, teacherId);
  if (!event) {
    return res.status(404).json({ error: 'Event not found or access denied' });
  }

  const result = db.stmt.deleteEvent.run(eventId, teacherId);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Event not found or access denied' });
  }
  res.json({ success: true });
}));

// --- TIMETABLE SLOTS ---
router.get('/classes/:classId/timetable', requireClassAccess('classId'), (req, res) => {
  try {
    const classId = req.params.classId;

    const slots = db.stmt.getTimetableByClass.all(classId);
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

router.post('/classes/:classId/timetable', requireClassAccess('classId'), postLimiter, validate(timetableSlotSchema), withWriteQueue((req, res) => {
  const classId = req.params.classId;

  const { id, dayOfWeek, startTime, endTime, subject, lesson } = req.body;
  db.stmt.insertTimetableSlot.run(id, classId, dayOfWeek, startTime, endTime, subject, lesson);
  res.json({ success: true });
}));

router.put('/timetable/:id', postLimiter, withWriteQueue((req, res) => {
  const teacherId = (req as any).teacherId;
  const timetableId = req.params.id;
  
  const slot = db.stmt.getTimetableSlotById.get(timetableId, teacherId);
  if (!slot) {
    return res.status(404).json({ error: 'Timetable slot not found or access denied' });
  }

  const { dayOfWeek, startTime, endTime, subject, lesson } = req.body;
  const result = db.stmt.updateTimetableSlot.run(dayOfWeek, startTime, endTime, subject, lesson, timetableId, teacherId);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Timetable slot not found or access denied' });
  }
  res.json({ success: true });
}));

router.delete('/timetable/:id', postLimiter, withWriteQueue((req, res) => {
  const teacherId = (req as any).teacherId;
  const timetableId = req.params.id;
  
  const slot = db.stmt.getTimetableSlotById.get(timetableId, teacherId);
  if (!slot) {
    return res.status(404).json({ error: 'Timetable slot not found or access denied' });
  }

  const result = db.stmt.deleteTimetableSlot.run(timetableId, teacherId);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Timetable slot not found or access denied' });
  }
  res.json({ success: true });
}));

// --- SEATING LAYOUT ---
router.get('/classes/:classId/seating', requireClassAccess('classId'), (req, res) => {
  try {
    const classId = req.params.classId;

    const layout = db.stmt.getSeatingByClass.all(classId);
    const response: Record<string, string> = {};
    for (const row of layout as any) {
      response[row.seat_id] = row.student_id;
    }
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch seating layout' });
  }
});

router.post('/classes/:classId/seating', requireClassAccess('classId'), postLimiter, withWriteQueue((req, res) => {
  const classId = req.params.classId;

  const { seatId, studentId } = req.body;
  if (studentId === null) {
    db.stmt.deleteSeatingBySeat.run(classId, seatId);
  } else {
    db.stmt.deleteSeatingByStudent.run(classId, studentId);
    db.stmt.insertSeating.run(classId, seatId, studentId);
  }
  res.json({ success: true });
}));

router.put('/classes/:classId/seating', requireClassAccess('classId'), postLimiter, withWriteQueue((req, res) => {
  const classId = req.params.classId;

  const layout = req.body;
  db.stmt.clearSeatingByClass.run(classId);
  const insert = db.stmt.insertSeating;
  const transaction = db.transaction((lay) => {
    for (const [seatId, studentId] of Object.entries(lay)) {
      insert.run(classId, seatId, studentId as string);
    }
  });
  transaction(layout);
  res.json({ success: true });
}));

router.delete('/classes/:classId/seating', requireClassAccess('classId'), postLimiter, withWriteQueue((req, res) => {
  const classId = req.params.classId;

  db.stmt.clearSeatingByClass.run(classId);
  res.json({ success: true });
}));

// --- SETTINGS ---
router.get('/settings', (req, res) => {
  try {
    const settings = db.cache.cached('settings:all', () => db.stmt.getSettings.all(), 60000);
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

router.post('/settings', postLimiter, validate(settingSchema), withWriteQueue((req, res) => {
  const { key, value } = req.body;
  if (key === 'adminPassword') {
    const hash = bcrypt.hashSync(value, 10);
    db.stmt.upsertSetting.run(key, hash);
  } else {
    db.stmt.upsertSetting.run(key, value);
  }
  db.cache.invalidate('settings:all');
  res.json({ success: true });
}));

export default router;
