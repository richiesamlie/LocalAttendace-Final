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

// Rate limiter: 5 attempts per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
});

// Initialize default admin password if not exists
const initAdmin = () => {
  const existing = db.prepare('SELECT value FROM admin_settings WHERE key = ?').get('adminPassword') as { value: string } | undefined;
  if (!existing) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO admin_settings (key, value) VALUES (?, ?)').run('adminPassword', hash);
  } else {
    // If the existing password is NOT hashed (legacy from migration), hash it now
    if (!existing.value.startsWith('$2b$')) {
       const hash = bcrypt.hashSync(existing.value || 'admin123', 10);
       db.prepare('UPDATE admin_settings SET value = ? WHERE key = ?').run(hash, 'adminPassword');
    }
  }
};
initAdmin();

// --- AUTHENTICATION ---
router.post('/auth/login', authLimiter, (req, res) => {
  const { password } = req.body;
  const adminRow = db.prepare('SELECT value FROM admin_settings WHERE key = ?').get('adminPassword') as { value: string } | undefined;
  
  if (!adminRow) {
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  const isValid = bcrypt.compareSync(password, adminRow.value);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
  // This app always runs over plain HTTP (local or LAN), never HTTPS.
  // Using secure:true would cause browsers to silently drop the cookie on HTTP.
  // sameSite:'lax' is safe and works for both local and network (internal site) access.
  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
  res.json({ success: true });
});

router.post('/auth/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.json({ success: true });
});

router.get('/auth/verify', (req, res) => {
  const token = req.cookies?.auth_token;
  if (!token) return res.status(401).json({ authenticated: false });

  try {
    jwt.verify(token, JWT_SECRET);
    res.json({ authenticated: true });
  } catch (err) {
    res.status(401).json({ authenticated: false });
  }
});

// Lightweight Health Ping for Wi-Fi Indicator
router.get('/health', (req, res) => {
  res.json({ ok: true, timestamp: Date.now() });
});

// Auth Middleware for protecting routes
const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.cookies?.auth_token;
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Apply auth middleware to all routes below this point
router.use(requireAuth);

// --- DATABASE BACKUP & RESTORE ---
router.get('/database/backup', (req, res) => {
  const DB_FILE = path.join(process.cwd(), 'database.sqlite');
  const dateStr = new Date().toISOString().split('T')[0];
  res.download(DB_FILE, `LocalAttendance_Backup_${dateStr}.sqlite`);
});

router.post('/database/restore', express.raw({ type: '*/*', limit: '100mb' }), (req, res) => {
  try {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ error: 'No database file provided' });
    }

    // Write to a temporary file first to validate it's a valid SQLite DB
    const tempFile = path.join(process.cwd(), `temp_restore_${Date.now()}.sqlite`);
    fs.writeFileSync(tempFile, req.body);

    const Database = require('better-sqlite3');
    try {
      const testDb = new Database(tempFile, { fileMustExist: true });
      testDb.prepare('SELECT 1 FROM admin_settings').get();
      testDb.close();
      fs.unlinkSync(tempFile);
    } catch (e) {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
      return res.status(400).json({ error: 'Uploaded file is not a valid Attendance Database' });
    }

    // Apply the real restore via the db.ts proxy
    (db as any).restore(req.body);
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to restore database:', error);
    res.status(500).json({ error: 'Internal server error during database restore' });
  }
});

// --- CLASSES ---
router.get('/classes', (req, res) => {
  try {
    const classes = db.prepare('SELECT * FROM classes').all();
    res.json(classes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
});

router.post('/classes', (req, res) => {
  try {
    const { id, name } = req.body;
    db.prepare('INSERT INTO classes (id, name) VALUES (?, ?)').run(id, name);
    res.json({ id, name });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create class' });
  }
});

router.put('/classes/:id', (req, res) => {
  try {
    const { name } = req.body;
    db.prepare('UPDATE classes SET name = ? WHERE id = ?').run(name, req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update class' });
  }
});

router.delete('/classes/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM classes WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete class' });
  }
});

// --- STUDENTS ---
router.get('/classes/:classId/students', (req, res) => {
  try {
    const includeArchived = req.query.includeArchived === 'true';
    const query = includeArchived 
      ? 'SELECT * FROM students WHERE class_id = ?' 
      : 'SELECT * FROM students WHERE class_id = ? AND is_archived = 0';
    const students = db.prepare(query).all(req.params.classId);
    // map snake_case to camelCase
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
    const { id, name, rollNumber, parentName, parentPhone, isFlagged } = req.body;
    db.prepare('INSERT INTO students (id, class_id, name, roll_number, parent_name, parent_phone, is_flagged) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, req.params.classId, name, rollNumber, parentName || null, parentPhone || null, isFlagged ? 1 : 0);
    res.json({ success: true });
  } catch (error) {
    console.error('SQLite Error:', error);
    res.status(500).json({ error: 'Failed to create student' });
  }
});

router.put('/students/:id', (req, res) => {
  try {
    const { name, rollNumber, parentName, parentPhone, isFlagged, isArchived } = req.body;
    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
    
    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (rollNumber !== undefined) { updates.push('roll_number = ?'); values.push(rollNumber); }
    if (parentName !== undefined) { updates.push('parent_name = ?'); values.push(parentName); }
    if (parentPhone !== undefined) { updates.push('parent_phone = ?'); values.push(parentPhone); }
    if (isFlagged !== undefined) { updates.push('is_flagged = ?'); values.push(isFlagged ? 1 : 0); }
    if (isArchived !== undefined) { updates.push('is_archived = ?'); values.push(isArchived ? 1 : 0); }
    
    if (updates.length > 0) {
      values.push(req.params.id);
      db.prepare(`UPDATE students SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update student' });
  }
});

router.delete('/students/:id', (req, res) => {
  try {
    db.prepare('UPDATE students SET is_archived = 1 WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete student' });
  }
});

router.post('/classes/:classId/students/sync', (req, res) => {
  try {
    const importedStudents = Array.isArray(req.body) ? req.body : [];
    const syncedStudents: any[] = [];
    
    const transaction = db.transaction((stds) => {
      const existingRows = db.prepare('SELECT id, roll_number FROM students WHERE class_id = ?').all(req.params.classId) as any[];
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
          insert.run(s.id, req.params.classId, s.name, s.rollNumber, s.parentName || null, s.parentPhone || null, s.isFlagged ? 1 : 0);
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
    const records = db.prepare('SELECT * FROM attendance_records WHERE class_id = ?').all(req.params.classId);
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
    // Array or single object
    const records = Array.isArray(req.body) ? req.body : [req.body];
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
    const notes = db.prepare('SELECT date, note FROM daily_notes WHERE class_id = ?').all(req.params.classId);
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
    const { date, note } = req.body;
    db.prepare('INSERT OR REPLACE INTO daily_notes (class_id, date, note) VALUES (?, ?, ?)').run(req.params.classId, date, note);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save daily note' });
  }
});

// --- EVENTS ---
router.get('/classes/:classId/events', (req, res) => {
  try {
    const events = db.prepare('SELECT * FROM events WHERE class_id = ?').all(req.params.classId);
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

router.post('/classes/:classId/events', (req, res) => {
  try {
    const events = Array.isArray(req.body) ? req.body : [req.body];
    const insert = db.prepare('INSERT INTO events (id, class_id, date, title, type, description) VALUES (?, ?, ?, ?, ?, ?)');
    const transaction = db.transaction((evts) => {
      for (const e of evts) {
        insert.run(e.id, req.params.classId, e.date, e.title, e.type, e.description || null);
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
      values.push(req.params.id);
      db.prepare(`UPDATE events SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update event' });
  }
});

router.delete('/events/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// --- TIMETABLE SLOTS ---
router.get('/classes/:classId/timetable', (req, res) => {
  try {
    const slots = db.prepare('SELECT * FROM timetable_slots WHERE class_id = ?').all(req.params.classId);
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
    const { id, dayOfWeek, startTime, endTime, subject, lesson } = req.body;
    db.prepare('INSERT INTO timetable_slots (id, class_id, day_of_week, start_time, end_time, subject, lesson) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, req.params.classId, dayOfWeek, startTime, endTime, subject, lesson);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create timetable slot' });
  }
});

router.put('/timetable/:id', (req, res) => {
  try {
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
      values.push(req.params.id);
      db.prepare(`UPDATE timetable_slots SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update timetable slot' });
  }
});

router.delete('/timetable/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM timetable_slots WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete timetable slot' });
  }
});

// --- SEATING LAYOUT ---
router.get('/classes/:classId/seating', (req, res) => {
  try {
    const layout = db.prepare('SELECT seat_id, student_id FROM seating_layout WHERE class_id = ?').all(req.params.classId);
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
    const { seatId, studentId } = req.body; // if studentId is null, should delete it
    if (studentId === null) {
      db.prepare('DELETE FROM seating_layout WHERE class_id = ? AND seat_id = ?').run(req.params.classId, seatId);
    } else {
      // First delete from other seats
      db.prepare('DELETE FROM seating_layout WHERE class_id = ? AND student_id = ?').run(req.params.classId, studentId);
      db.prepare('INSERT OR REPLACE INTO seating_layout (class_id, seat_id, student_id) VALUES (?, ?, ?)')
        .run(req.params.classId, seatId, studentId);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update seat' });
  }
});

router.put('/classes/:classId/seating', (req, res) => {
  try {
    const layout = req.body; // expecting object: { [seatId]: studentId }
    db.prepare('DELETE FROM seating_layout WHERE class_id = ?').run(req.params.classId);
    const insert = db.prepare('INSERT INTO seating_layout (class_id, seat_id, student_id) VALUES (?, ?, ?)');
    const transaction = db.transaction((lay) => {
      for (const [seatId, studentId] of Object.entries(lay)) {
        insert.run(req.params.classId, seatId, studentId as string);
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
    db.prepare('DELETE FROM seating_layout WHERE class_id = ?').run(req.params.classId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear seating layout' });
  }
});

// --- SETTINGS ---
router.get('/settings', (req, res) => {
  try {
    const settings = db.prepare('SELECT key, value FROM admin_settings').all();
    const response: Record<string, string> = {};
    for (const row of settings as any) {
      if (row.key !== 'adminPassword') { // Don't send password hash to client
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
