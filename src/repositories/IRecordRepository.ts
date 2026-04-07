import type { AttendanceRecord } from '../store';

export interface IRecordRepository {
  getAll(classId: string): Promise<AttendanceRecord[]>;
  save(records: AttendanceRecord[]): Promise<{ success: boolean }>;
}
