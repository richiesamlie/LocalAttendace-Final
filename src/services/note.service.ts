import { db, isPostgres, pgQuery } from './utils';

/**
 * Note Service
 * 
 * Manages daily notes for classes, allowing teachers to record
 * important information for specific dates.
 */

export const noteService = {
  getByClass(classId: string) {
    if (isPostgres()) {
      return pgQuery<{ date: string; note: string }>(
        'SELECT date, note FROM daily_notes WHERE class_id = $1',
        [classId]
      );
    }
    return db.stmt.getDailyNotesByClass.all(classId);
  },

  upsert(classId: string, date: string, note: string) {
    if (isPostgres()) {
      return pgQuery(
        `INSERT INTO daily_notes (class_id, date, note) VALUES ($1, $2, $3)
         ON CONFLICT (class_id, date) DO UPDATE SET note = $3, updated_at = NOW()`,
        [classId, date, note]
      );
    }
    return db.stmt.insertDailyNote.run(classId, date, note);
  },
};
