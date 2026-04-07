import { api } from '../lib/api';
import type { ISeatingRepository } from './ISeatingRepository';

export class SQLiteSeatingRepository implements ISeatingRepository {
  async getAll(classId: string): Promise<Record<string, string>> {
    return api.getSeating(classId);
  }

  async updateSeat(classId: string, seatId: string, studentId: string | null): Promise<{ success: boolean }> {
    return api.updateSeat(classId, seatId, studentId);
  }

  async saveLayout(classId: string, layout: Record<string, string>): Promise<{ success: boolean }> {
    return api.saveSeatingLayout(classId, layout);
  }

  async clear(classId: string): Promise<{ success: boolean }> {
    return api.clearSeating(classId);
  }
}
