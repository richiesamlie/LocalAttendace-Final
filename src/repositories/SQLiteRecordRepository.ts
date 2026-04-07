import { api } from '../lib/api';
import type { IRecordRepository } from './IRecordRepository';
import type { AttendanceRecord } from '../store';

export class SQLiteRecordRepository implements IRecordRepository {
  async getAll(classId: string): Promise<AttendanceRecord[]> {
    return api.getRecords(classId);
  }

  async save(records: AttendanceRecord[]): Promise<{ success: boolean }> {
    return api.saveRecords(records);
  }
}
