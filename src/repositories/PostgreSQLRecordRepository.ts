import { query } from './postgres';
import type { IRecordRepository } from './IRecordRepository';
import type { AttendanceRecord } from '../store';

export class PostgreSQLRecordRepository implements IRecordRepository {
  async getAll(classId: string): Promise<AttendanceRecord[]> {
    return query<AttendanceRecord>(
      `SELECT ar.student_id as "studentId", ar.date, ar.status, ar.reason 
       FROM attendance_records ar
       JOIN students s ON ar.student_id = s.id
       WHERE s.class_id = $1
       ORDER BY ar.date DESC, s.roll_number`,
      [classId]
    );
  }

  async save(records: AttendanceRecord[]): Promise<{ success: boolean }> {
    for (const r of records) {
      await query(
        `INSERT INTO attendance_records (student_id, date, status, reason) 
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (student_id, date) DO UPDATE SET status = $3, reason = $4, updated_at = NOW()`,
        [r.studentId, r.date, r.status, r.reason || null]
      );
    }
    return { success: true };
  }
}
