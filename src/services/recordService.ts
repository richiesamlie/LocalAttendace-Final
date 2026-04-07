import { api } from '../lib/api';
import type { AttendanceRecord } from '../store';

export const recordService = {
  async getAll(classId: string): Promise<AttendanceRecord[]> {
    return api.getRecords(classId);
  },

  async save(records: AttendanceRecord[]): Promise<{ success: boolean }> {
    return api.saveRecords(records);
  },
};
