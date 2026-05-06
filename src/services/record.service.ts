import { db, isPostgres, pgQuery } from './utils';

/**
 * Record Service
 * 
 * Manages attendance records for students including status tracking
 * and reason documentation.
 */

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

  insert(classId: string, studentId: string, date: string, status: string, reason: string | null) {
    if (isPostgres()) {
      return pgQuery(
        `INSERT INTO attendance_records (student_id, date, status, reason) VALUES ($1, $2, $3, $4)
         ON CONFLICT (student_id, date) DO UPDATE SET status = $3, reason = $4, updated_at = NOW()`,
        [studentId, date, status, reason]
      );
    }
    return db.stmt.insertAttendance.run(studentId, classId, date, status, reason);
  },
};
