import db from './db';
import { query as pgQuery, queryOne as pgQueryOne } from './src/repositories/postgres';
import type { ClassSummary } from './src/repositories/IClassRepository';

function isPostgres(): boolean {
  return (process.env.DB_TYPE || 'sqlite') === 'postgres';
}

export const teacherService = {
  getByUsername(username: string) {
    if (isPostgres()) {
      return pgQueryOne<{ id: string; username: string; password_hash: string; name: string }>(
        'SELECT id, username, password_hash, name FROM teachers WHERE username = $1',
        [username]
      );
    }
    return db.stmt.getTeacherByUsername.get(username);
  },

  getById(id: string) {
    if (isPostgres()) {
      return pgQueryOne<{ id: string; username: string; name: string }>(
        'SELECT id, username, name FROM teachers WHERE id = $1',
        [id]
      );
    }
    return db.stmt.getTeacherById.get(id);
  },

  updateLastLogin(id: string) {
    if (isPostgres()) {
      return pgQuery('UPDATE teachers SET last_login = NOW() WHERE id = $1', [id]);
    }
    return db.stmt.updateTeacherLastLogin.run(id);
  },

  getAll() {
    if (isPostgres()) {
      return pgQuery<{ id: string; username: string; name: string }>(
        'SELECT id, username, name FROM teachers ORDER BY name'
      );
    }
    return db.stmt.getAllTeachers.all();
  },

  insert(id: string, username: string, hash: string, name: string) {
    if (isPostgres()) {
      return pgQuery(
        'INSERT INTO teachers (id, username, password_hash, name) VALUES ($1, $2, $3, $4)',
        [id, username, hash, name]
      );
    }
    return db.stmt.insertTeacher.run(id, username, hash, name);
  },

  // N12: Updates the actual password_hash in the teachers table.
  updatePassword(teacherId: string, passwordHash: string) {
    if (isPostgres()) {
      return pgQuery('UPDATE teachers SET password_hash = $1 WHERE id = $2', [passwordHash, teacherId]);
    }
    return db.stmt.updateTeacherPassword.run(passwordHash, teacherId);
  },

  // N6: Returns true if the teacher is an owner of at least one class.
  // Owners are considered admins and can register new teachers.
  async isAdmin(teacherId: string): Promise<boolean> {
    if (isPostgres()) {
      const result = await pgQueryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM class_teachers WHERE teacher_id = $1 AND role = 'owner'`,
        [teacherId]
      );
      return result ? Number(result.count) > 0 : false;
    }
    const result = db.stmt.isAdminTeacher.get(teacherId) as { count: number } | undefined;
    return (result?.count || 0) > 0;
  },
};

export const sessionService = {
  insert(sessionId: string, teacherId: string, deviceName: string, ipAddress: string, expiresAt: string) {
    if (isPostgres()) {
      return pgQuery(
        'INSERT INTO user_sessions (id, teacher_id, device_name, ip_address, expires_at) VALUES ($1, $2, $3, $4, $5)',
        [sessionId, teacherId, deviceName, ipAddress, expiresAt]
      );
    }
    return db.stmt.insertSession.run(sessionId, teacherId, deviceName, ipAddress, expiresAt);
  },

  get(sessionId: string) {
    if (isPostgres()) {
      return pgQueryOne<{ is_revoked: number; expires_at: string }>(
        'SELECT is_revoked, expires_at FROM user_sessions WHERE id = $1',
        [sessionId]
      );
    }
    return db.stmt.getSession.get(sessionId);
  },

  updateActivity(sessionId: string) {
    if (isPostgres()) {
      return pgQuery('UPDATE user_sessions SET last_active = NOW() WHERE id = $1', [sessionId]);
    }
    try { db.stmt.updateSessionActivity.run(sessionId); } catch { /* non-critical */ }
  },

  deleteExpired() {
    if (isPostgres()) {
      return pgQuery('DELETE FROM user_sessions WHERE expires_at < NOW()');
    }
    return db.stmt.deleteExpiredSessions.run();
  },

  getByTeacher(teacherId: string) {
    if (isPostgres()) {
      return pgQuery<{ id: string; device_name: string; ip_address: string; created_at: string; last_active: string; expires_at: string; is_revoked: number }>(
        'SELECT id, device_name, ip_address, created_at, last_active, expires_at, is_revoked FROM user_sessions WHERE teacher_id = $1 ORDER BY created_at DESC',
        [teacherId]
      );
    }
    return db.stmt.getSessionsByTeacher.all(teacherId);
  },

  revokeAll(teacherId: string) {
    if (isPostgres()) {
      return pgQuery('UPDATE user_sessions SET is_revoked = true WHERE teacher_id = $1', [teacherId]);
    }
    return db.stmt.revokeAllSessions.run(teacherId);
  },

  revoke(sessionId: string) {
    if (isPostgres()) {
      return pgQuery('UPDATE user_sessions SET is_revoked = true WHERE id = $1', [sessionId]);
    }
    return db.stmt.revokeSession.run(sessionId);
  },
};

export const classService = {
  async getByTeacher(teacherId: string): Promise<ClassSummary[]> {
    if (isPostgres()) {
      return pgQuery<ClassSummary>(
        `SELECT c.id, c.teacher_id, c.name, t.name as owner_name 
         FROM classes c 
         JOIN class_teachers ct ON c.id = ct.class_id 
         JOIN teachers t ON c.teacher_id = t.id 
         WHERE ct.teacher_id = $1 
         ORDER BY c.name`,
        [teacherId]
      );
    }
    return db.stmt.getClassesByTeacher.all(teacherId) as ClassSummary[];
  },

  async getById(id: string, teacherId: string) {
    if (isPostgres()) {
      return pgQueryOne<{ id: string; name: string; teacher_id: string }>(
        `SELECT c.id, c.name, c.teacher_id FROM classes c 
         JOIN class_teachers ct ON c.id = ct.class_id 
         WHERE c.id = $1 AND ct.teacher_id = $2`,
        [id, teacherId]
      );
    }
    return db.stmt.getClassById.get(id, teacherId);
  },

  async getAll() {
    if (isPostgres()) {
      return pgQuery<{ id: string; teacher_id: string; name: string; teacher_name: string }>(
        'SELECT c.id, c.teacher_id, c.name, t.name as teacher_name FROM classes c JOIN teachers t ON c.teacher_id = t.id'
      );
    }
    return db.stmt.getAllClasses.all();
  },

  async insert(id: string, teacherId: string, name: string) {
    if (isPostgres()) {
      await pgQuery(
        'INSERT INTO classes (id, teacher_id, name, owner_name) VALUES ($1, $2, $3, (SELECT name FROM teachers WHERE id = $2))',
        [id, teacherId, name]
      );
      // Also add creator as 'owner' in class_teachers so requireClassAccess works
      await pgQuery(
        'INSERT INTO class_teachers (class_id, teacher_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [id, teacherId, 'owner']
      );
      return;
    }
    // In SQLite: insert class then immediately add creator as owner in class_teachers
    db.stmt.insertClass.run(id, teacherId, name);
    db.stmt.insertClassTeacher.run(id, teacherId, 'owner');
  },

  async update(name: string, id: string, teacherId: string) {
    if (isPostgres()) {
      return pgQuery('UPDATE classes SET name = $1, updated_at = NOW() WHERE id = $2', [name, id]);
    }
    return db.stmt.updateClass.run(name, id, teacherId);
  },

  async delete(id: string, teacherId: string) {
    if (isPostgres()) {
      return pgQuery(
        `DELETE FROM classes WHERE id = $1 AND id IN (SELECT class_id FROM class_teachers WHERE teacher_id = $2 AND role = 'owner')`,
        [id, teacherId]
      );
    }
    return db.stmt.deleteClass.run(id, teacherId);
  },

  async getTeachers(classId: string) {
    if (isPostgres()) {
      return pgQuery<{ teacher_id: string; name: string; role: string }>(
        `SELECT ct.teacher_id, t.name, ct.role FROM class_teachers ct 
         JOIN teachers t ON ct.teacher_id = t.id 
         WHERE ct.class_id = $1`,
        [classId]
      );
    }
    return db.stmt.getClassTeachers.all(classId);
  },

  async isClassTeacher(classId: string, teacherId: string) {
    if (isPostgres()) {
      return pgQueryOne<{ class_id: string; role: string }>(
        'SELECT class_id, role FROM class_teachers WHERE class_id = $1 AND teacher_id = $2',
        [classId, teacherId]
      );
    }
    return db.stmt.isClassTeacher.get(classId, teacherId);
  },

  async addTeacher(classId: string, teacherId: string, role: string) {
    if (isPostgres()) {
      return pgQuery(
        'INSERT INTO class_teachers (class_id, teacher_id, role) VALUES ($1, $2, $3)',
        [classId, teacherId, role]
      );
    }
    return db.stmt.insertClassTeacher.run(classId, teacherId, role);
  },

  async removeTeacher(classId: string, teacherId: string) {
    if (isPostgres()) {
      return pgQuery('DELETE FROM class_teachers WHERE class_id = $1 AND teacher_id = $2', [classId, teacherId]);
    }
    return db.stmt.removeClassTeacher.run(classId, teacherId);
  },

  async updateTeacherRole(role: string, classId: string, teacherId: string) {
    if (isPostgres()) {
      return pgQuery('UPDATE class_teachers SET role = $1 WHERE class_id = $2 AND teacher_id = $3', [role, classId, teacherId]);
    }
    return db.stmt.updateClassTeacherRole.run(role, classId, teacherId);
  },
};

export const studentService = {
  getByClass(classId: string, includeArchived = false) {
    if (isPostgres()) {
      const fields = 'id, name, roll_number, parent_name, parent_phone, is_flagged, is_archived';
      const sql = includeArchived
        ? `SELECT ${fields} FROM students WHERE class_id = $1 ORDER BY roll_number, name`
        : `SELECT ${fields} FROM students WHERE class_id = $1 AND is_archived = false ORDER BY roll_number, name`;
      return pgQuery<{ id: string; name: string; roll_number: string; parent_name: string; parent_phone: string; is_flagged: number; is_archived: number }>(sql, [classId]);
    }
    const stmt = includeArchived ? db.stmt.getStudentsByClassWithArchived : db.stmt.getStudentsByClass;
    return stmt.all(classId);
  },

  getById(studentId: string, teacherId: string) {
    if (isPostgres()) {
      return pgQueryOne<{ id: string; name: string; class_id: string }>(
        `SELECT s.id, s.name, s.class_id FROM students s 
         JOIN class_teachers ct ON s.class_id = ct.class_id 
         WHERE s.id = $1 AND ct.teacher_id = $2`,
        [studentId, teacherId]
      );
    }
    return db.stmt.getStudentById.get(studentId, teacherId);
  },

  insert(id: string, classId: string, name: string, rollNumber: string, parentName: string | null, parentPhone: string | null, isFlagged: number) {
    if (isPostgres()) {
      return pgQuery(
        'INSERT INTO students (id, class_id, name, roll_number, parent_name, parent_phone, is_flagged) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [id, classId, name, rollNumber, parentName, parentPhone, isFlagged]
      );
    }
    return db.stmt.insertStudent.run(id, classId, name, rollNumber, parentName, parentPhone, isFlagged);
  },

  update(data: { name?: string; roll_number?: string; parent_name?: string; parent_phone?: string; is_flagged?: number; is_archived?: number }, studentId: string, teacherId: string) {
    if (isPostgres()) {
      const sets: string[] = [];
      const vals: unknown[] = [];
      let i = 1;
      if (data.name !== undefined) { sets.push(`name = $${i++}`); vals.push(data.name); }
      if (data.roll_number !== undefined) { sets.push(`roll_number = $${i++}`); vals.push(data.roll_number); }
      if (data.parent_name !== undefined) { sets.push(`parent_name = $${i++}`); vals.push(data.parent_name); }
      if (data.parent_phone !== undefined) { sets.push(`parent_phone = $${i++}`); vals.push(data.parent_phone); }
      if (data.is_flagged !== undefined) { sets.push(`is_flagged = $${i++}`); vals.push(data.is_flagged); }
      if (data.is_archived !== undefined) { sets.push(`is_archived = $${i++}`); vals.push(data.is_archived); }
      if (sets.length === 0) return;
      sets.push(`updated_at = NOW()`);
      vals.push(studentId, teacherId);
      return pgQuery(`UPDATE students s SET ${sets.join(', ')} WHERE s.id = $${i} AND s.class_id IN (SELECT class_id FROM class_teachers WHERE teacher_id = $${i + 1})`, vals);
    }
    return db.stmt.updateStudent.run(data.name, data.roll_number, data.parent_name, data.parent_phone, data.is_flagged, data.is_archived, studentId, teacherId);
  },

  archive(studentId: string, teacherId: string) {
    if (isPostgres()) {
      return pgQuery('UPDATE students SET is_archived = 1 WHERE id = $1 AND class_id IN (SELECT class_id FROM class_teachers WHERE teacher_id = $2)', [studentId, teacherId]);
    }
    return db.stmt.archiveStudent.run(studentId, teacherId);
  },

  syncDelete(classId: string) {
    if (isPostgres()) {
      return pgQuery('DELETE FROM students WHERE class_id = $1', [classId]);
    }
    return db.stmt.getStudentsByClassWithArchived.all(classId); // Sync uses different approach in SQLite
  },

  syncInsert(id: string, classId: string, name: string, rollNumber: string, parentName: string | null, parentPhone: string | null, isFlagged: number) {
    if (isPostgres()) {
      return pgQuery(
        'INSERT INTO students (id, class_id, name, roll_number, parent_name, parent_phone, is_flagged) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [id, classId, name, rollNumber, parentName, parentPhone, isFlagged]
      );
    }
    return db.stmt.insertStudent.run(id, classId, name, rollNumber, parentName, parentPhone, isFlagged);
  },

  // N8: Verify that a student belongs to a specific class.
  getBelongsToClass(studentId: string, classId: string) {
    if (isPostgres()) {
      return pgQueryOne<{ id: string }>(
        'SELECT id FROM students WHERE id = $1 AND class_id = $2',
        [studentId, classId]
      );
    }
    return db.stmt.getStudentByClassAndId.get(classId, studentId);
  },
};

export const recordService = {
  getByClass(classId: string) {
    if (isPostgres()) {
      return pgQuery<{ student_id: string; date: string; status: string; reason: string | null }>(
        `SELECT ar.student_id, ar.date, ar.status, ar.reason FROM attendance_records ar
         JOIN students s ON ar.student_id = s.id
         WHERE s.class_id = $1
         ORDER BY ar.date DESC, s.roll_number`,
        [classId]
      );
    }
    return db.stmt.getRecordsByClass.all(classId);
  },

  insert(studentId: string, date: string, status: string, reason: string | null) {
    if (isPostgres()) {
      return pgQuery(
        `INSERT INTO attendance_records (student_id, date, status, reason) VALUES ($1, $2, $3, $4)
         ON CONFLICT (student_id, date) DO UPDATE SET status = $3, reason = $4, updated_at = NOW()`,
        [studentId, date, status, reason]
      );
    }
    return db.stmt.insertAttendance.run(studentId, date, status, reason);
  },
};

export const noteService = {
  getByClass(classId: string) {
    if (isPostgres()) {
      return pgQuery<{ date: string; note: string }>(
        'SELECT date, note FROM daily_notes WHERE class_id = $1',
        [classId]
      );
    }
    return db.stmt.getDailyNotesByClass.all(classId);
  },

  upsert(classId: string, date: string, note: string) {
    if (isPostgres()) {
      return pgQuery(
        `INSERT INTO daily_notes (class_id, date, note) VALUES ($1, $2, $3)
         ON CONFLICT (class_id, date) DO UPDATE SET note = $3, updated_at = NOW()`,
        [classId, date, note]
      );
    }
    return db.stmt.insertDailyNote.run(classId, date, note);
  },
};

export const eventService = {
  getByClass(classId: string) {
    if (isPostgres()) {
      return pgQuery<{ id: string; class_id: string; date: string; title: string; type: string; description: string | null }>(
        'SELECT id, class_id, date, title, type, description FROM events WHERE class_id = $1 ORDER BY date DESC',
        [classId]
      );
    }
    return db.stmt.getEventsByClass.all(classId);
  },

  getById(eventId: string, teacherId: string) {
    if (isPostgres()) {
      return pgQueryOne<{ id: string; class_id: string }>(
        `SELECT e.id, e.class_id FROM events e 
         JOIN class_teachers ct ON e.class_id = ct.class_id 
         WHERE e.id = $1 AND ct.teacher_id = $2`,
        [eventId, teacherId]
      );
    }
    return db.stmt.getEventById.get(eventId, teacherId);
  },

  insert(id: string, classId: string, date: string, title: string, type: string, description: string | null) {
    if (isPostgres()) {
      return pgQuery(
        'INSERT INTO events (id, class_id, date, title, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
        [id, classId, date, title, type, description]
      );
    }
    return db.stmt.insertEvent.run(id, classId, date, title, type, description);
  },

  update(data: { date: string; title: string; type: string; description?: string }, eventId: string, teacherId: string) {
    if (isPostgres()) {
      return pgQuery(
        `UPDATE events SET date = $1, title = $2, type = $3, description = $4, updated_at = NOW()
         WHERE id = $5 AND class_id IN (SELECT class_id FROM class_teachers WHERE teacher_id = $6)`,
        [data.date, data.title, data.type, data.description || null, eventId, teacherId]
      );
    }
    return db.stmt.updateEvent.run(data.date, data.title, data.type, data.description || null, eventId, teacherId);
  },

  delete(eventId: string, teacherId: string) {
    if (isPostgres()) {
      return pgQuery(
        `DELETE FROM events WHERE id = $1 AND class_id IN (SELECT class_id FROM class_teachers WHERE teacher_id = $2)`,
        [eventId, teacherId]
      );
    }
    return db.stmt.deleteEvent.run(eventId, teacherId);
  },
};

export const timetableService = {
  getByClass(classId: string) {
    if (isPostgres()) {
      return pgQuery<{ id: string; class_id: string; day_of_week: number; start_time: string; end_time: string; subject: string; lesson: string }>(
        'SELECT id, class_id, day_of_week, start_time, end_time, subject, lesson FROM timetable_slots WHERE class_id = $1 ORDER BY day_of_week, start_time',
        [classId]
      );
    }
    return db.stmt.getTimetableByClass.all(classId);
  },

  getById(slotId: string, teacherId: string) {
    if (isPostgres()) {
      return pgQueryOne<{ id: string; class_id: string }>(
        `SELECT t.id, t.class_id FROM timetable_slots t 
         JOIN class_teachers ct ON t.class_id = ct.class_id 
         WHERE t.id = $1 AND ct.teacher_id = $2`,
        [slotId, teacherId]
      );
    }
    return db.stmt.getTimetableSlotById.get(slotId, teacherId);
  },

  insert(id: string, classId: string, dayOfWeek: number, startTime: string, endTime: string, subject: string, lesson: string) {
    if (isPostgres()) {
      return pgQuery(
        'INSERT INTO timetable_slots (id, class_id, day_of_week, start_time, end_time, subject, lesson) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [id, classId, dayOfWeek, startTime, endTime, subject, lesson]
      );
    }
    return db.stmt.insertTimetableSlot.run(id, classId, dayOfWeek, startTime, endTime, subject, lesson);
  },

  update(data: { day_of_week: number; start_time: string; end_time: string; subject: string; lesson: string }, slotId: string, teacherId: string) {
    if (isPostgres()) {
      return pgQuery(
        `UPDATE timetable_slots SET day_of_week = $1, start_time = $2, end_time = $3, subject = $4, lesson = $5, updated_at = NOW()
         WHERE id = $6 AND class_id IN (SELECT class_id FROM class_teachers WHERE teacher_id = $7)`,
        [data.day_of_week, data.start_time, data.end_time, data.subject, data.lesson, slotId, teacherId]
      );
    }
    return db.stmt.updateTimetableSlot.run(data.day_of_week, data.start_time, data.end_time, data.subject, data.lesson, slotId, teacherId);
  },

  delete(slotId: string, teacherId: string) {
    if (isPostgres()) {
      return pgQuery(
        `DELETE FROM timetable_slots WHERE id = $1 AND class_id IN (SELECT class_id FROM class_teachers WHERE teacher_id = $2)`,
        [slotId, teacherId]
      );
    }
    return db.stmt.deleteTimetableSlot.run(slotId, teacherId);
  },
};

export const seatingService = {
  getByClass(classId: string) {
    if (isPostgres()) {
      return pgQuery<{ seat_id: string; student_id: string | null }>(
        'SELECT seat_id, student_id FROM seating_layout WHERE class_id = $1',
        [classId]
      );
    }
    return db.stmt.getSeatingByClass.all(classId);
  },

  deleteSeat(classId: string, seatId: string) {
    if (isPostgres()) {
      return pgQuery('DELETE FROM seating_layout WHERE class_id = $1 AND seat_id = $2', [classId, seatId]);
    }
    return db.stmt.deleteSeatingBySeat.run(classId, seatId);
  },

  deleteStudent(classId: string, studentId: string) {
    if (isPostgres()) {
      return pgQuery('DELETE FROM seating_layout WHERE class_id = $1 AND student_id = $2', [classId, studentId]);
    }
    return db.stmt.deleteSeatingByStudent.run(classId, studentId);
  },

  insert(classId: string, seatId: string, studentId: string) {
    if (isPostgres()) {
      return pgQuery(
        `INSERT INTO seating_layout (class_id, seat_id, student_id) VALUES ($1, $2, $3)
         ON CONFLICT (class_id, seat_id) DO UPDATE SET student_id = $3, updated_at = NOW()`,
        [classId, seatId, studentId]
      );
    }
    return db.stmt.insertSeating.run(classId, seatId, studentId);
  },

  clear(classId: string) {
    if (isPostgres()) {
      return pgQuery('DELETE FROM seating_layout WHERE class_id = $1', [classId]);
    }
    return db.stmt.clearSeatingByClass.run(classId);
  },

  // N4: Atomically replace the entire seating layout using a SQLite transaction.
  // Without a transaction, a failure mid-loop leaves the chart partially cleared.
  async saveLayout(classId: string, layout: Record<string, string>) {
    if (isPostgres()) {
      // PostgreSQL: run sequentially (pgQuery doesn't expose native transactions here)
      await pgQuery('DELETE FROM seating_layout WHERE class_id = $1', [classId]);
      for (const [seatId, studentId] of Object.entries(layout)) {
        if (studentId) {
          await pgQuery(
            `INSERT INTO seating_layout (class_id, seat_id, student_id) VALUES ($1, $2, $3)
             ON CONFLICT (class_id, seat_id) DO UPDATE SET student_id = $3, updated_at = NOW()`,
            [classId, seatId, studentId]
          );
        }
      }
      return;
    }
    // SQLite: use a transaction so clear + inserts are atomic
    const txn = (db as any).transaction((cls: string, lay: Record<string, string>) => {
      db.stmt.clearSeatingByClass.run(cls);
      for (const [seatId, studentId] of Object.entries(lay)) {
        if (studentId) db.stmt.insertSeating.run(cls, seatId, studentId);
      }
    });
    txn(classId, layout);
  },
};

export const settingService = {
  getAll() {
    if (isPostgres()) {
      return pgQuery<{ key: string; value: string }>('SELECT key, value FROM admin_settings');
    }
    return db.stmt.getSettings.all();
  },

  set(key: string, value: string) {
    if (isPostgres()) {
      return pgQuery(
        'INSERT INTO admin_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
        [key, value]
      );
    }
    return db.stmt.upsertSetting.run(key, value);
  },
};

export const inviteService = {
  getByClass(classId: string) {
    if (isPostgres()) {
      return pgQuery<{ code: string; role: string; created_by: string; created_at: string; expires_at: string | null; used_by: string | null }>(
        'SELECT code, role, created_by, created_at, expires_at, used_by, used_at FROM invite_codes WHERE class_id = $1 AND used_by IS NULL ORDER BY created_at DESC',
        [classId]
      );
    }
    return db.stmt.getClassInviteCodes.all(classId);
  },

  getByCode(code: string) {
    if (isPostgres()) {
      return pgQueryOne<{ code: string; class_id: string; role: string; expires_at: string; used_by: string | null }>(
        'SELECT code, class_id, role, expires_at, used_by FROM invite_codes WHERE code = $1',
        [code]
      );
    }
    return db.stmt.getInviteCode.get(code);
  },

  insert(code: string, classId: string, role: string, createdBy: string, expiresAt: string | null) {
    if (isPostgres()) {
      return pgQuery(
        'INSERT INTO invite_codes (code, class_id, role, created_by, expires_at) VALUES ($1, $2, $3, $4, $5)',
        [code, classId, role, createdBy, expiresAt]
      );
    }
    return db.stmt.insertInviteCode.run(code, classId, role, createdBy, expiresAt);
  },

  delete(code: string) {
    if (isPostgres()) {
      return pgQuery('DELETE FROM invite_codes WHERE code = $1', [code]);
    }
    return db.stmt.deleteInviteCode.run(code);
  },

  use(teacherId: string, code: string) {
    if (isPostgres()) {
      return pgQuery('UPDATE invite_codes SET used_by = $1, used_at = NOW() WHERE code = $2', [teacherId, code]);
    }
    return db.stmt.useInviteCode.run(teacherId, code);
  },

  deleteExpired() {
    if (isPostgres()) {
      return pgQuery('DELETE FROM invite_codes WHERE expires_at < NOW()');
    }
    return db.stmt.deleteExpiredInviteCodes.run();
  },
};