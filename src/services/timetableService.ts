import { api } from '../lib/api';
import type { TimetableSlot } from '../store';

export const timetableService = {
  async getAll(classId: string): Promise<TimetableSlot[]> {
    return api.getTimetable(classId);
  },

  async create(classId: string, slot: TimetableSlot): Promise<{ success: boolean }> {
    return api.createTimetableSlot(classId, slot);
  },

  async update(slotId: string, data: Partial<TimetableSlot>): Promise<{ success: boolean }> {
    return api.updateTimetableSlot(slotId, data);
  },

  async delete(slotId: string): Promise<{ success: boolean }> {
    return api.deleteTimetableSlot(slotId);
  },
};
