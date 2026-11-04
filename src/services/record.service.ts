import { db, isPostgres, pgQuery } from './utils';

/**
 * Record Service
 * 
 * Manages attendance records for students including status tracking
 * and reason documentation.
 */

export const recordService = {
  getByClass(classId: string, startDate?: string, endDate?: string) {
    if (isPostgres()) {
      if (startDate && endDate) {
        return pgQuery<{ student_id: string; date: string; status: string; reason: string | null }>(
          `SELECT ar.student_id, ar.date, ar.status, ar.reason FROM attendance_records ar
           JOIN students s ON ar.student_id = s.id
           WHERE s.class_id = $1 AND ar.date >= $2 AND ar.date <= $3
           ORDER BY ar.date DESC, s.roll_number`,
          [classId, startDate, endDate]
        );
      }
      return pgQuery<{ student_id: string; date: string; status: string; reason: string | null }>(
        `SELECT ar.student_id, ar.date, ar.status, ar.reason FROM attendance_records ar
         JOIN students s ON ar.student_id = s.id
         WHERE s.class_id = $1
         ORDER BY ar.date DESC, s.roll_number`,
        [classId]
      );
    }
    if (startDate && endDate) {
      return db.stmt.getRecordsByClassAndDateRange.all(classId, startDate, endDate);
    }
    return db.stmt.getRecordsByClass.all(classId);
  },

  insert(classId: string, studentId: string, date: string, status: string, reason: string | null) {
    if (isPostgres()) {
      return pgQuery(
        `INSERT INTO attendance_records (student_id, class_id, date, status, reason) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (student_id, date) DO UPDATE SET status = $4, reason = $5, updated_at = NOW()`,
        [studentId, classId, date, status, reason]
      );
    }
    return db.stmt.insertAttendance.run(studentId, classId, date, status, reason);
  },
};
