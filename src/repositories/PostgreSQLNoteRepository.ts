import { query } from './postgres';
import type { INoteRepository } from './INoteRepository';

export class PostgreSQLNoteRepository implements INoteRepository {
  async getAll(classId: string): Promise<Record<string, string>> {
    const rows = await query<{ date: string; note: string }>(
      'SELECT date, note FROM daily_notes WHERE class_id = $1 ORDER BY date DESC',
      [classId]
    );
    const notes: Record<string, string> = {};
    for (const row of rows) {
      if (row.note) notes[row.date] = row.note;
    }
    return notes;
  }

  async save(classId: string, date: string, note: string): Promise<{ success: boolean }> {
    await query(
      'INSERT INTO daily_notes (class_id, date, note) VALUES ($1, $2, $3) ON CONFLICT (class_id, date) DO UPDATE SET note = $3',
      [classId, date, note]
    );
    return { success: true };
  }
}
