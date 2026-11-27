import { db, isPostgres, pgQuery, pgTransaction } from './utils';

export interface AttendanceRecordWriteInput {
  classId: string;
  studentId: string;
  date: string;
  status: string;
  reason: string | null;
}

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

  async insertMany(records: AttendanceRecordWriteInput[]) {
    if (records.length === 0) return;
    if (isPostgres()) {
      await pgTransaction(async (client) => {
        for (const r of records) {
          await client.query(
            `INSERT INTO attendance_records (student_id, class_id, date, status, reason) VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (student_id, date) DO UPDATE SET status = $4, reason = $5, updated_at = NOW()`,
            [r.studentId, r.classId, r.date, r.status, r.reason]
          );
        }
      });
      return;
    }

    if (records.length === 1) {
      const [r] = records;
      db.stmt.insertAttendance.run(r.studentId, r.classId, r.date, r.status, r.reason);
      return;
    }

    const runBatch = db.transaction((items: AttendanceRecordWriteInput[]) => {
      for (const r of items) {
        db.stmt.insertAttendance.run(r.studentId, r.classId, r.date, r.status, r.reason);
      }
    });
    runBatch(records);
  },
};
