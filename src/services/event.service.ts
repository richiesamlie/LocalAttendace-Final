import { db, isPostgres, pgQuery, pgQueryOne } from './utils';

/**
 * Event Service
 * 
 * Manages class events such as field trips, exams, and special activities
 * with date, title, type, and description tracking.
 */

export const eventService = {
  getByClass(classId: string) {
    if (isPostgres()) {
      return pgQuery<{ id: string; class_id: string; date: string; title: string; type: string; description: string | null }>(
        'SELECT id, class_id, date, title, type, description FROM events WHERE class_id = $1 ORDER BY date DESC',
        [classId]
      );
    }
    return db.stmt.getEventsByClass.all(classId);
  },

  getById(eventId: string, teacherId: string) {
    if (isPostgres()) {
      return pgQueryOne<{ id: string; class_id: string }>(
        `SELECT e.id, e.class_id FROM events e 
         JOIN class_teachers ct ON e.class_id = ct.class_id 
         WHERE e.id = $1 AND ct.teacher_id = $2`,
        [eventId, teacherId]
      );
    }
    return db.stmt.getEventById.get(eventId, teacherId);
  },

  insert(id: string, classId: string, date: string, title: string, type: string, description: string | null) {
    if (isPostgres()) {
      return pgQuery(
        'INSERT INTO events (id, class_id, date, title, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
        [id, classId, date, title, type, description]
      );
    }
    return db.stmt.insertEvent.run(id, classId, date, title, type, description);
  },

  update(data: { date: string; title: string; type: string; description?: string }, eventId: string, teacherId: string) {
    if (isPostgres()) {
      return pgQuery(
        `UPDATE events SET date = $1, title = $2, type = $3, description = $4, updated_at = NOW()
         WHERE id = $5 AND class_id IN (SELECT class_id FROM class_teachers WHERE teacher_id = $6)`,
        [data.date, data.title, data.type, data.description || null, eventId, teacherId]
      );
    }
    return db.stmt.updateEvent.run(data.date, data.title, data.type, data.description || null, eventId, teacherId);
  },

  delete(eventId: string, teacherId: string) {
    if (isPostgres()) {
      return pgQuery(
        `DELETE FROM events WHERE id = $1 AND class_id IN (SELECT class_id FROM class_teachers WHERE teacher_id = $2)`,
        [eventId, teacherId]
      );
    }
    return db.stmt.deleteEvent.run(eventId, teacherId);
  },
};
