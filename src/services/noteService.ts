import { api } from '../lib/api';

export const noteService = {
  async getAll(classId: string): Promise<Record<string, string>> {
    return api.getDailyNotes(classId);
  },

  async save(classId: string, date: string, note: string): Promise<{ success: boolean }> {
    return api.saveDailyNote(classId, date, note);
  },
};
