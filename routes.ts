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
  (req as any).teacherId = teacherId;
  next();
};

// Rate limiter: 5 attempts per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
});

// Rate limiter for general POST endpoints: 100 per 15 minutes
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

  const token = jwt.sign({ teacherId: teacher.id, username: teacher.username }, JWT_SECRET, { expiresIn: '7d' });
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
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

// Health check endpoint for Docker and monitoring
router.get('/health', (_req, res) => {
  try {
    // Quick DB ping to verify connectivity
    db.prepare('SELECT 1').get();
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: 'Database unavailable' });
  }
});

// --- TEACHER MANAGEMENT ---
router.post('/teachers/register', postLimiter, validate(teacherSchema), (req, res) => {
  try {
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
    res.json({ success: true, id, username, name });
  } catch (error) {
    res.status(500).json({ error: 'Failed to register teacher' });
  }
});

router.get('/teachers', (req, res) => {
  try {
    const teachers = db.stmt.getAllTeachers.all();
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
    const classes = db.stmt.getClassesByTeacher.all(teacherId);
    res.json(classes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
});

router.post('/classes', postLimiter, validate(classSchema), (req, res) => {
  try {
    const teacherId = (req as any).teacherId;
    const { id, name } = req.body;
    db.stmt.insertClass.run(id, teacherId, name);
    // Auto-add creator as owner in class_teachers
    db.stmt.insertClassTeacher.run(id, teacherId, 'owner');
    res.json({ id, teacher_id: teacherId, name });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create class' });
  }
});

router.put('/classes/:id', postLimiter, (req, res) => {
  try {
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
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update class' });
  }
});

router.delete('/classes/:id', postLimiter, (req, res) => {
  try {
    const teacherId = (req as any).teacherId;
    const access = db.stmt.isClassTeacher.get(req.params.id, teacherId) as { class_id: string; role: string } | undefined;
    if (!access || access.role !== 'owner') {
      return res.status(403).json({ error: 'Only class owner can delete class' });
    }
    const result = db.stmt.deleteClass.run(req.params.id, teacherId);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete class' });
  }
});

// --- CLASS TEACHERS ---
router.get('/classes/:classId/teachers', (req, res) => {
  try {
    const teacherId = (req as any).teacherId;
    const classId = req.params.classId;
    
    const access = db.stmt.isClassTeacher.get(classId, teacherId) as { class_id: string; role: string } | undefined;
    if (!access) {
      return res.status(404).json({ error: 'Class not found or access denied' });
    }

    const teachers = db.stmt.getClassTeachers.all(classId);
    res.json(teachers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch class teachers' });
  }
});

router.post('/classes/:classId/teachers', postLimiter, (req, res) => {
  try {
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
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add teacher to class' });
  }
});

router.delete('/classes/:classId/teachers/:teacherId', postLimiter, (req, res) => {
  try {
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
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove teacher from class' });
  }
});

// --- STUDENTS ---
router.get('/classes/:classId/students', (req, res) => {
  try {
    const teacherId = (req as any).teacherId;
    const classId = req.params.classId;
    
    const classOwner = db.stmt.getClassById.get(classId, teacherId);
    if (!classOwner) {
      return res.status(404).json({ error: 'Class not found or access denied' });
    }

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

router.post('/classes/:classId/students', postLimiter, validate(studentSchema), (req, res) => {
  try {
    const teacherId = (req as any).teacherId;
    const classId = req.params.classId;
    
    const classOwner = db.stmt.getClassById.get(classId, teacherId);
    if (!classOwner) {
      return res.status(404).json({ error: 'Class not found or access denied' });
    }

    const { id, name, rollNumber, parentName, parentPhone, isFlagged } = req.body;
    db.stmt.insertStudent.run(id, classId, name, rollNumber, parentName || null, parentPhone || null, isFlagged ? 1 : 0);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create student' });
  }
});

router.put('/students/:id', postLimiter, (req, res) => {
  try {
    const teacherId = (req as any).teacherId;
    const studentId = req.params.id;
    
    const student = db.stmt.getStudentById.get(studentId, teacherId) as { id: string; name: string; roll_number: string; parent_name: string; parent_phone: string; is_flagged: number; is_archived: number } | undefined;
    if (!student) {
      return res.status(404).json({ error: 'Student not found or access denied' });
    }

    const { name, rollNumber, parentName, parentPhone, isFlagged, isArchived } = req.body;
    db.stmt.updateStudent.run(
      name ?? student.name, 
      rollNumber ?? student.roll_number, 
      parentName ?? student.parent_name, 
      parentPhone ?? student.parent_phone, 
      isFlagged !== undefined ? (isFlagged ? 1 : 0) : student.is_flagged, 
      isArchived !== undefined ? (isArchived ? 1 : 0) : student.is_archived,
      studentId
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update student' });
  }
});

router.delete('/students/:id', postLimiter, (req, res) => {
  try {
    const teacherId = (req as any).teacherId;
    const studentId = req.params.id;
    
    const student = db.stmt.getStudentById.get(studentId, teacherId);
    if (!student) {
      return res.status(404).json({ error: 'Student not found or access denied' });
    }

    db.stmt.archiveStudent.run(studentId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete student' });
  }
});

router.post('/classes/:classId/students/sync', postLimiter, (req, res) => {
  try {
    const teacherId = (req as any).teacherId;
    const classId = req.params.classId;
    
    const classOwner = db.stmt.getClassById.get(classId, teacherId);
    if (!classOwner) {
      return res.status(404).json({ error: 'Class not found or access denied' });
    }

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
  } catch (error) {
    res.status(500).json({ error: 'Failed to sync students' });
  }
});

// --- ATTENDANCE RECORDS ---
router.get('/classes/:classId/records', (req, res) => {
  try {
    const teacherId = (req as any).teacherId;
    const classId = req.params.classId;
    
    const classOwner = db.stmt.getClassById.get(classId, teacherId);
    if (!classOwner) {
      return res.status(404).json({ error: 'Class not found or access denied' });
    }

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

router.post('/records', postLimiter, (req, res) => {
  try {
    const teacherId = (req as any).teacherId;
    const records = Array.isArray(req.body) ? req.body : [req.body];
    
    for (const r of records) {
      const classOwner = db.stmt.getClassById.get(r.classId, teacherId);
      if (!classOwner) {
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
  } catch (error) {
    res.status(500).json({ error: 'Failed to save records' });
  }
});

// --- DAILY NOTES ---
router.get('/classes/:classId/daily-notes', (req, res) => {
  try {
    const teacherId = (req as any).teacherId;
    const classId = req.params.classId;
    
    const classOwner = db.stmt.getClassById.get(classId, teacherId);
    if (!classOwner) {
      return res.status(404).json({ error: 'Class not found or access denied' });
    }

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

router.post('/classes/:classId/daily-notes', postLimiter, (req, res) => {
  try {
    const teacherId = (req as any).teacherId;
    const classId = req.params.classId;
    
    const classOwner = db.stmt.getClassById.get(classId, teacherId);
    if (!classOwner) {
      return res.status(404).json({ error: 'Class not found or access denied' });
    }

    const { date, note } = req.body;
    db.stmt.insertDailyNote.run(classId, date, note);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save daily note' });
  }
});

// --- EVENTS ---
router.get('/classes/:classId/events', (req, res) => {
  try {
    const teacherId = (req as any).teacherId;
    const classId = req.params.classId;
    
    const classOwner = db.stmt.getClassById.get(classId, teacherId);
    if (!classOwner) {
      return res.status(404).json({ error: 'Class not found or access denied' });
    }

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

router.post('/classes/:classId/events', postLimiter, validate(eventSchema), (req, res) => {
  try {
    const teacherId = (req as any).teacherId;
    const classId = req.params.classId;
    
    const classOwner = db.stmt.getClassById.get(classId, teacherId);
    if (!classOwner) {
      return res.status(404).json({ error: 'Class not found or access denied' });
    }

    const events = Array.isArray(req.body) ? req.body : [req.body];
    const insert = db.stmt.insertEvent;
    const transaction = db.transaction((evts) => {
      for (const e of evts) {
        insert.run(e.id, classId, e.date, e.title, e.type, e.description || null);
      }
    });
    transaction(events);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create event(s)' });
  }
});

router.put('/events/:id', postLimiter, (req, res) => {
  try {
    const teacherId = (req as any).teacherId;
    const eventId = req.params.id;
    
    const event = db.stmt.getEventById.get(eventId, teacherId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found or access denied' });
    }

    const { date, title, type, description } = req.body;
    db.stmt.updateEvent.run(date, title, type, description || null, eventId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update event' });
  }
});

router.delete('/events/:id', postLimiter, (req, res) => {
  try {
    const teacherId = (req as any).teacherId;
    const eventId = req.params.id;
    
    const event = db.stmt.getEventById.get(eventId, teacherId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found or access denied' });
    }

    db.stmt.deleteEvent.run(eventId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// --- TIMETABLE SLOTS ---
router.get('/classes/:classId/timetable', (req, res) => {
  try {
    const teacherId = (req as any).teacherId;
    const classId = req.params.classId;
    
    const classOwner = db.stmt.getClassById.get(classId, teacherId);
    if (!classOwner) {
      return res.status(404).json({ error: 'Class not found or access denied' });
    }

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

router.post('/classes/:classId/timetable', postLimiter, validate(timetableSlotSchema), (req, res) => {
  try {
    const teacherId = (req as any).teacherId;
    const classId = req.params.classId;
    
    const classOwner = db.stmt.getClassById.get(classId, teacherId);
    if (!classOwner) {
      return res.status(404).json({ error: 'Class not found or access denied' });
    }

    const { id, dayOfWeek, startTime, endTime, subject, lesson } = req.body;
    db.stmt.insertTimetableSlot.run(id, classId, dayOfWeek, startTime, endTime, subject, lesson);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create timetable slot' });
  }
});

router.put('/timetable/:id', postLimiter, (req, res) => {
  try {
    const teacherId = (req as any).teacherId;
    const timetableId = req.params.id;
    
    const slot = db.stmt.getTimetableSlotById.get(timetableId, teacherId);
    if (!slot) {
      return res.status(404).json({ error: 'Timetable slot not found or access denied' });
    }

    const { dayOfWeek, startTime, endTime, subject, lesson } = req.body;
    db.stmt.updateTimetableSlot.run(dayOfWeek, startTime, endTime, subject, lesson, timetableId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update timetable slot' });
  }
});

router.delete('/timetable/:id', postLimiter, (req, res) => {
  try {
    const teacherId = (req as any).teacherId;
    const timetableId = req.params.id;
    
    const slot = db.stmt.getTimetableSlotById.get(timetableId, teacherId);
    if (!slot) {
      return res.status(404).json({ error: 'Timetable slot not found or access denied' });
    }

    db.stmt.deleteTimetableSlot.run(timetableId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete timetable slot' });
  }
});

// --- SEATING LAYOUT ---
router.get('/classes/:classId/seating', (req, res) => {
  try {
    const teacherId = (req as any).teacherId;
    const classId = req.params.classId;
    
    const classOwner = db.stmt.getClassById.get(classId, teacherId);
    if (!classOwner) {
      return res.status(404).json({ error: 'Class not found or access denied' });
    }

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

router.post('/classes/:classId/seating', postLimiter, (req, res) => {
  try {
    const teacherId = (req as any).teacherId;
    const classId = req.params.classId;
    
    const classOwner = db.stmt.getClassById.get(classId, teacherId);
    if (!classOwner) {
      return res.status(404).json({ error: 'Class not found or access denied' });
    }

    const { seatId, studentId } = req.body;
    if (studentId === null) {
      db.stmt.deleteSeatingBySeat.run(classId, seatId);
    } else {
      db.stmt.deleteSeatingByStudent.run(classId, studentId);
      db.stmt.insertSeating.run(classId, seatId, studentId);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update seat' });
  }
});

router.put('/classes/:classId/seating', postLimiter, (req, res) => {
  try {
    const teacherId = (req as any).teacherId;
    const classId = req.params.classId;
    
    const classOwner = db.stmt.getClassById.get(classId, teacherId);
    if (!classOwner) {
      return res.status(404).json({ error: 'Class not found or access denied' });
    }

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
  } catch (error) {
    res.status(500).json({ error: 'Failed to save seating layout' });
  }
});

router.delete('/classes/:classId/seating', postLimiter, (req, res) => {
  try {
    const teacherId = (req as any).teacherId;
    const classId = req.params.classId;
    
    const classOwner = db.stmt.getClassById.get(classId, teacherId);
    if (!classOwner) {
      return res.status(404).json({ error: 'Class not found or access denied' });
    }

    db.stmt.clearSeatingByClass.run(classId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear seating layout' });
  }
});

// --- SETTINGS ---
router.get('/settings', (req, res) => {
  try {
    const settings = db.stmt.getSettings.all();
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

router.post('/settings', postLimiter, validate(settingSchema), (req, res) => {
  try {
    const { key, value } = req.body;
    if (key === 'adminPassword') {
      const hash = bcrypt.hashSync(value, 10);
      db.stmt.upsertSetting.run(key, hash);
    } else {
      db.stmt.upsertSetting.run(key, value);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

export default router;
