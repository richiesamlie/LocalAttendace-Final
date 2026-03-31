import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import db from './db';
import path from 'path';
import fs from 'fs';

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

// --- AUTHENTICATION (NO AUTH REQUIRED) ---
router.post('/auth/login', authLimiter, (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const teacher = db.prepare('SELECT id, username, password_hash FROM teachers WHERE username = ?').get(username) as { id: string; username: string; password_hash: string } | undefined;
  
  if (!teacher) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const isValid = bcrypt.compareSync(password, teacher.password_hash);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ teacherId: teacher.id, username: teacher.username }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
  res.json({ success: true, teacherId: teacher.id, username: teacher.username });
});

router.post('/auth/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.json({ success: true });
});

router.get('/auth/verify', (req, res) => {
  const teacherId = getTeacherId(req);
  if (!teacherId) return res.status(401).json({ authenticated: false });
  res.json({ authenticated: true, teacherId });
});

router.get('/auth/me', (req, res) => {
  const teacherId = getTeacherId(req);
  if (!teacherId) return res.status(401).json({ error: 'Not authenticated' });
  const teacher = db.prepare('SELECT id, username, name FROM teachers WHERE id = ?').get(teacherId) as { id: string; username: string; name: string } | undefined;
  if (!teacher) {
    return res.status(404).json({ error: 'Teacher not found' });
  }
  res.json(teacher);
});

// All routes below require authentication
router.use(requireAuth);

// --- CLASSES ---
router.get('/classes', (req, res) => {
  try {
    const teacherId = (req as any).teacherId;
    const classes = db.prepare('SELECT * FROM classes WHERE teacher_id = ?').all(teacherId);
    res.json(classes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
});

router.post('/classes', (req, res) => {
  try {
    const teacherId = (req as any).teacherId;
    const { id, name } = req.body;
    db.prepare('INSERT INTO classes (id, teacher_id, name) VALUES (?, ?, ?)').run(id, teacherId, name);
    res.json({ id, teacher_id: teacherId, name });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create class' });
  }
});

router.put('/classes/:id', (req, res) => {
  try {
    const teacherId = (req as any).teacherId;
    const { name } = req.body;
    const result = db.prepare('UPDATE classes SET name = ? WHERE id = ? AND teacher_id = ?').run(name, req.params.id, teacherId);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Class not found or access denied' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update class' });
  }
});

router.delete('/classes/:id', (req, res) => {
  try {
    const teacherId = (req as any).teacherId;
    const result = db.prepare('DELETE FROM classes WHERE id = ? AND teacher_id = ?').run(req.params.id, teacherId);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Class not found or access denied' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete class' });
  }
});

// --- STUDENTS ---
router.get('/classes/:classId/students', (req, res) => {
  try {
    const teacherId = (req as any).teacherId;
    const classId = req.params.classId;
    
    const classOwner = db.prepare('SELECT id FROM classes WHERE id = ? AND teacher_id = ?').get(classId, teacherId);
    if (!classOwner) {
      return res.status(404).json({ error: 'Class not found or access denied' });
    }

    const includeArchived = req.query.includeArchived === 'true';
    const query = includeArchived 
      ? 'SELECT * FROM students WHERE class_id = ?' 
      : 'SELECT * FROM students WHERE class_id = ? AND is_archived = 0';
    const students = db.prepare(query).all(classId);
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

router.post('/classes/:classId/students', (req, res) => {
  try {
    const teacherId = (req as any).teacherId;
    const classId = req.params.classId;
    
    const classOwner = db.prepare('SELECT id FROM classes WHERE id = ? AND teacher_id = ?').get(classId, teacherId);
    if (!classOwner) {
      return res.status(404).json({ error: 'Class not found or access denied' });
    }

    const { id, name, rollNumber, parentName, parentPhone, isFlagged } = req.body;
    db.prepare('INSERT INTO students (id, class_id, name, roll_number, parent_name, parent_phone, is_flagged) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, classId, name, rollNumber, parentName || null, parentPhone || null, isFlagged ? 1 : 0);
    res.json({ success: true });
  } catch (error) {
    console.error('SQLite Error:', error);
    res.status(500).json({ error: 'Failed to create student' });
  }
});

router.put('/students/:id', (req, res) => {
  try {
    const teacherId = (req as any).teacherId;
    const studentId = req.params.id;
    
    const student = db.prepare(`
      SELECT s.id FROM students s
      JOIN classes c ON s.class_id = c.id
      WHERE s.id = ? AND c.teacher_id = ?
    `).get(studentId, teacherId);
    
    if (!student) {
      return res.status(404).json({ error: 'Student not found or access denied' });
    }

    const { name, rollNumber, parentName, parentPhone, isFlagged, isArchived } = req.body;
    const updates: string[] = [];
    const values: any[] = [];
    
    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (rollNumber !== undefined) { updates.push('roll_number = ?'); values.push(rollNumber); }
    if (parentName !== undefined) { updates.push('parent_name = ?'); values.push(parentName); }
    if (parentPhone !== undefined) { updates.push('parent_phone = ?'); values.push(parentPhone); }
    if (isFlagged !== undefined) { updates.push('is_flagged = ?'); values.push(isFlagged ? 1 : 0); }
    if (isArchived !== undefined) { updates.push('is_archived = ?'); values.push(isArchived ? 1 : 0); }
    
    if (updates.length > 0) {
      values.push(studentId);
      db.prepare(`UPDATE students SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update student' });
  }
});

router.delete('/students/:id', (req, res) => {
  try {
    const teacherId = (req as any).teacherId;
    const studentId = req.params.id;
    
    const student = db.prepare(`
      SELECT s.id FROM students s
      JOIN classes c ON s.class_id = c.id
      WHERE s.id = ? AND c.teacher_id = ?
    `).get(studentId, teacherId);
    
    if (!student) {
      return res.status(404).json({ error: 'Student not found or access denied' });
    }

    db.prepare('UPDATE students SET is_archived = 1 WHERE id = ?').run(studentId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete student' });
  }
});

router.post('/classes/:classId/students/sync', (req, res) => {
  try {
    const teacherId = (req as any).teacherId;
    const classId = req.params.classId;
    
    const classOwner = db.prepare('SELECT id FROM classes WHERE id = ? AND teacher_id = ?').get(classId, teacherId);
    if (!classOwner) {
      return res.status(404).json({ error: 'Class not found or access denied' });
    }

    const importedStudents = Array.isArray(req.body) ? req.body : [];
    const syncedStudents: any[] = [];
    
    const transaction = db.transaction((stds) => {
      const existingRows = db.prepare('SELECT id, roll_number FROM students WHERE class_id = ?').all(classId) as any[];
      const existingMap = new Map(existingRows.map(r => [r.roll_number, r.id]));
      
      const insert = db.prepare('INSERT INTO students (id, class_id, name, roll_number, parent_name, parent_phone, is_flagged) VALUES (?, ?, ?, ?, ?, ?, ?)');
      const update = db.prepare('UPDATE students SET name = ?, parent_name = ?, parent_phone = ?, is_flagged = ?, is_archived = 0 WHERE id = ?');
      const deleteStmt = db.prepare('UPDATE students SET is_archived = 1 WHERE id = ?');

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
    console.error('SQLite Sync Error:', error);
    res.status(500).json({ error: 'Failed to sync students' });
  }
});

// --- ATTENDANCE RECORDS ---
router.get('/classes/:classId/records', (req, res) => {
  try {
    const teacherId = (req as any).teacherId;
    const classId = req.params.classId;
    
    const classOwner = db.prepare('SELECT id FROM classes WHERE id = ? AND teacher_id = ?').get(classId, teacherId);
    if (!classOwner) {
      return res.status(404).json({ error: 'Class not found or access denied' });
    }

    const records = db.prepare('SELECT * FROM attendance_records WHERE class_id = ?').all(classId);
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

router.post('/records', (req, res) => {
  try {
    const teacherId = (req as any).teacherId;
    const records = Array.isArray(req.body) ? req.body : [req.body];
    
    for (const r of records) {
      const classOwner = db.prepare('SELECT id FROM classes WHERE id = ? AND teacher_id = ?').get(r.classId, teacherId);
      if (!classOwner) {
        return res.status(404).json({ error: `Class ${r.classId} not found or access denied` });
      }
    }

    const insert = db.prepare('INSERT OR REPLACE INTO attendance_records (student_id, class_id, date, status, reason) VALUES (?, ?, ?, ?, ?)');
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
    
    const classOwner = db.prepare('SELECT id FROM classes WHERE id = ? AND teacher_id = ?').get(classId, teacherId);
    if (!classOwner) {
      return res.status(404).json({ error: 'Class not found or access denied' });
    }

    const notes = db.prepare('SELECT date, note FROM daily_notes WHERE class_id = ?').all(classId);
    const response: Record<string, string> = {};
    for (const row of notes as any) {
      response[row.date] = row.note;
    }
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch daily notes' });
  }
});

router.post('/classes/:classId/daily-notes', (req, res) => {
  try {
    const teacherId = (req as any).teacherId;
    const classId = req.params.classId;
    
    const classOwner = db.prepare('SELECT id FROM classes WHERE id = ? AND teacher_id = ?').get(classId, teacherId);
    if (!classOwner) {
      return res.status(404).json({ error: 'Class not found or access denied' });
    }

    const { date, note } = req.body;
    db.prepare('INSERT OR REPLACE INTO daily_notes (class_id, date, note) VALUES (?, ?, ?)').run(classId, date, note);
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
    
    const classOwner = db.prepare('SELECT id FROM classes WHERE id = ? AND teacher_id = ?').get(classId, teacherId);
    if (!classOwner) {
      return res.status(404).json({ error: 'Class not found or access denied' });
    }

    const events = db.prepare('SELECT * FROM events WHERE class_id = ?').all(classId);
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

router.post('/classes/:classId/events', (req, res) => {
  try {
    const teacherId = (req as any).teacherId;
    const classId = req.params.classId;
    
    const classOwner = db.prepare('SELECT id FROM classes WHERE id = ? AND teacher_id = ?').get(classId, teacherId);
    if (!classOwner) {
      return res.status(404).json({ error: 'Class not found or access denied' });
    }

    const events = Array.isArray(req.body) ? req.body : [req.body];
    const insert = db.prepare('INSERT INTO events (id, class_id, date, title, type, description) VALUES (?, ?, ?, ?, ?, ?)');
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

router.put('/events/:id', (req, res) => {
  try {
    const teacherId = (req as any).teacherId;
    const eventId = req.params.id;
    
    const event = db.prepare(`
      SELECT e.id FROM events e
      JOIN classes c ON e.class_id = c.id
      WHERE e.id = ? AND c.teacher_id = ?
    `).get(eventId, teacherId);
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found or access denied' });
    }

    const updates: string[] = [];
    const values: any[] = [];
    const allowedFields = ['date', 'title', 'type', 'description'];
    
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    }
    
    if (updates.length > 0) {
      values.push(eventId);
      db.prepare(`UPDATE events SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update event' });
  }
});

router.delete('/events/:id', (req, res) => {
  try {
    const teacherId = (req as any).teacherId;
    const eventId = req.params.id;
    
    const event = db.prepare(`
      SELECT e.id FROM events e
      JOIN classes c ON e.class_id = c.id
      WHERE e.id = ? AND c.teacher_id = ?
    `).get(eventId, teacherId);
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found or access denied' });
    }

    db.prepare('DELETE FROM events WHERE id = ?').run(eventId);
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
    
    const classOwner = db.prepare('SELECT id FROM classes WHERE id = ? AND teacher_id = ?').get(classId, teacherId);
    if (!classOwner) {
      return res.status(404).json({ error: 'Class not found or access denied' });
    }

    const slots = db.prepare('SELECT * FROM timetable_slots WHERE class_id = ?').all(classId);
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

router.post('/classes/:classId/timetable', (req, res) => {
  try {
    const teacherId = (req as any).teacherId;
    const classId = req.params.classId;
    
    const classOwner = db.prepare('SELECT id FROM classes WHERE id = ? AND teacher_id = ?').get(classId, teacherId);
    if (!classOwner) {
      return res.status(404).json({ error: 'Class not found or access denied' });
    }

    const { id, dayOfWeek, startTime, endTime, subject, lesson } = req.body;
    db.prepare('INSERT INTO timetable_slots (id, class_id, day_of_week, start_time, end_time, subject, lesson) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, classId, dayOfWeek, startTime, endTime, subject, lesson);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create timetable slot' });
  }
});

router.put('/timetable/:id', (req, res) => {
  try {
    const teacherId = (req as any).teacherId;
    const timetableId = req.params.id;
    
    const slot = db.prepare(`
      SELECT t.id FROM timetable_slots t
      JOIN classes c ON t.class_id = c.id
      WHERE t.id = ? AND c.teacher_id = ?
    `).get(timetableId, teacherId);
    
    if (!slot) {
      return res.status(404).json({ error: 'Timetable slot not found or access denied' });
    }

    const updates: string[] = [];
    const values: any[] = [];
    const mapFields: Record<string, string> = { dayOfWeek: 'day_of_week', startTime: 'start_time', endTime: 'end_time', subject: 'subject', lesson: 'lesson' };
    
    for (const [key, dbCol] of Object.entries(mapFields)) {
      if (req.body[key] !== undefined) {
        updates.push(`${dbCol} = ?`);
        values.push(req.body[key]);
      }
    }
    
    if (updates.length > 0) {
      values.push(timetableId);
      db.prepare(`UPDATE timetable_slots SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update timetable slot' });
  }
});

router.delete('/timetable/:id', (req, res) => {
  try {
    const teacherId = (req as any).teacherId;
    const timetableId = req.params.id;
    
    const slot = db.prepare(`
      SELECT t.id FROM timetable_slots t
      JOIN classes c ON t.class_id = c.id
      WHERE t.id = ? AND c.teacher_id = ?
    `).get(timetableId, teacherId);
    
    if (!slot) {
      return res.status(404).json({ error: 'Timetable slot not found or access denied' });
    }

    db.prepare('DELETE FROM timetable_slots WHERE id = ?').run(timetableId);
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
    
    const classOwner = db.prepare('SELECT id FROM classes WHERE id = ? AND teacher_id = ?').get(classId, teacherId);
    if (!classOwner) {
      return res.status(404).json({ error: 'Class not found or access denied' });
    }

    const layout = db.prepare('SELECT seat_id, student_id FROM seating_layout WHERE class_id = ?').all(classId);
    const response: Record<string, string> = {};
    for (const row of layout as any) {
      response[row.seat_id] = row.student_id;
    }
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch seating layout' });
  }
});

router.post('/classes/:classId/seating', (req, res) => {
  try {
    const teacherId = (req as any).teacherId;
    const classId = req.params.classId;
    
    const classOwner = db.prepare('SELECT id FROM classes WHERE id = ? AND teacher_id = ?').get(classId, teacherId);
    if (!classOwner) {
      return res.status(404).json({ error: 'Class not found or access denied' });
    }

    const { seatId, studentId } = req.body;
    if (studentId === null) {
      db.prepare('DELETE FROM seating_layout WHERE class_id = ? AND seat_id = ?').run(classId, seatId);
    } else {
      db.prepare('DELETE FROM seating_layout WHERE class_id = ? AND student_id = ?').run(classId, studentId);
      db.prepare('INSERT OR REPLACE INTO seating_layout (class_id, seat_id, student_id) VALUES (?, ?, ?)')
        .run(classId, seatId, studentId);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update seat' });
  }
});

router.put('/classes/:classId/seating', (req, res) => {
  try {
    const teacherId = (req as any).teacherId;
    const classId = req.params.classId;
    
    const classOwner = db.prepare('SELECT id FROM classes WHERE id = ? AND teacher_id = ?').get(classId, teacherId);
    if (!classOwner) {
      return res.status(404).json({ error: 'Class not found or access denied' });
    }

    const layout = req.body;
    db.prepare('DELETE FROM seating_layout WHERE class_id = ?').run(classId);
    const insert = db.prepare('INSERT INTO seating_layout (class_id, seat_id, student_id) VALUES (?, ?, ?)');
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

router.delete('/classes/:classId/seating', (req, res) => {
  try {
    const teacherId = (req as any).teacherId;
    const classId = req.params.classId;
    
    const classOwner = db.prepare('SELECT id FROM classes WHERE id = ? AND teacher_id = ?').get(classId, teacherId);
    if (!classOwner) {
      return res.status(404).json({ error: 'Class not found or access denied' });
    }

    db.prepare('DELETE FROM seating_layout WHERE class_id = ?').run(classId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear seating layout' });
  }
});

// --- SETTINGS ---
router.get('/settings', (req, res) => {
  try {
    const teacherId = (req as any).teacherId;
    const settings = db.prepare('SELECT key, value FROM admin_settings').all();
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

router.post('/settings', (req, res) => {
  try {
    const { key, value } = req.body;
    if (key === 'adminPassword') {
      const hash = bcrypt.hashSync(value, 10);
      db.prepare('INSERT OR REPLACE INTO admin_settings (key, value) VALUES (?, ?)').run(key, hash);
    } else {
      db.prepare('INSERT OR REPLACE INTO admin_settings (key, value) VALUES (?, ?)').run(key, value);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

export default router;
