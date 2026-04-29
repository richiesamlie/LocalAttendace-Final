import { db, isPostgres, pgQuery, pgQueryOne } from './utils';

/**
 * Student Service
 * 
 * Manages student records including creation, updates, archival,
 * and parent contact information.
 */

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
    // SQLite: build a dynamic SET clause to avoid NULLing fields not included in the partial update
    const setClauses: string[] = [];
    const vals: unknown[] = [];
    if (data.name !== undefined) { setClauses.push('name = ?'); vals.push(data.name); }
    if (data.roll_number !== undefined) { setClauses.push('roll_number = ?'); vals.push(data.roll_number); }
    if (data.parent_name !== undefined) { setClauses.push('parent_name = ?'); vals.push(data.parent_name); }
    if (data.parent_phone !== undefined) { setClauses.push('parent_phone = ?'); vals.push(data.parent_phone); }
    if (data.is_flagged !== undefined) { setClauses.push('is_flagged = ?'); vals.push(data.is_flagged); }
    if (data.is_archived !== undefined) { setClauses.push('is_archived = ?'); vals.push(data.is_archived); }
    if (setClauses.length === 0) return;
    vals.push(studentId, teacherId);
    return db.prepare(
      `UPDATE students SET ${setClauses.join(', ')} WHERE id = ? AND class_id IN (SELECT class_id FROM class_teachers WHERE teacher_id = ?)`
    ).run(...vals);
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
