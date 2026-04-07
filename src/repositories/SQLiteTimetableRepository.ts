import { api } from '../lib/api';
import type { ITimetableRepository } from './ITimetableRepository';
import type { TimetableSlot } from '../store';

export class SQLiteTimetableRepository implements ITimetableRepository {
  async getAll(classId: string): Promise<TimetableSlot[]> {
    return api.getTimetable(classId);
  }

  async getById(slotId: string): Promise<TimetableSlot | null> {
    return null;
  }

  async create(classId: string, slot: TimetableSlot): Promise<{ success: boolean }> {
    return api.createTimetableSlot(classId, slot);
  }

  async update(slotId: string, data: Partial<TimetableSlot>): Promise<{ success: boolean }> {
    return api.updateTimetableSlot(slotId, data);
  }

  async delete(slotId: string): Promise<{ success: boolean }> {
    return api.deleteTimetableSlot(slotId);
  }
}
