import { db, isPostgres, pgQuery, pgQueryOne } from './utils';
import { teacherService } from './teacher.service';

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

  async getById(eventId: string, teacherId: string) {
    if (isPostgres()) {
      const direct = await pgQueryOne<{ id: string; class_id: string; date: string; title: string; type: string; description: string | null }>(
        `SELECT e.id, e.class_id, e.date, e.title, e.type, e.description FROM events e 
         JOIN class_teachers ct ON e.class_id = ct.class_id 
         WHERE e.id = $1 AND ct.teacher_id = $2`,
        [eventId, teacherId]
      );
      if (direct) return direct;
      if (await teacherService.getIsAdmin(teacherId)) {
        return pgQueryOne<{ id: string; class_id: string; date: string; title: string; type: string; description: string | null }>(
          `SELECT e.id, e.class_id, e.date, e.title, e.type, e.description FROM events e
           JOIN classes c ON e.class_id = c.id
           JOIN teachers t ON t.id = $2
           WHERE e.id = $1 AND COALESCE(c.school_id, 'school_default') = COALESCE(t.school_id, 'school_default')`,
          [eventId, teacherId]
        );
      }
      return null;
    }
    const direct = db.stmt.getEventById.get(eventId, teacherId);
    if (direct) return direct;
    if (await teacherService.getIsAdmin(teacherId)) {
      return db.prepare(
        `SELECT e.id, e.class_id, e.date, e.title, e.type, e.description FROM events e
         JOIN classes c ON e.class_id = c.id
         JOIN teachers t ON t.id = ?
         WHERE e.id = ? AND COALESCE(c.school_id, 'school_default') = COALESCE(t.school_id, 'school_default')`
      ).get(teacherId, eventId);
    }
    return undefined;
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

  async update(data: { date: string; title: string; type: string; description?: string }, eventId: string, teacherId: string) {
    const isAdmin = await teacherService.getIsAdmin(teacherId);
    if (isPostgres()) {
      if (isAdmin) {
        return pgQuery(
          `UPDATE events SET date = $1, title = $2, type = $3, description = $4, updated_at = NOW()
           WHERE id = $5 AND class_id IN (SELECT c.id FROM classes c JOIN teachers t ON t.id = $6 WHERE COALESCE(c.school_id, 'school_default') = COALESCE(t.school_id, 'school_default'))`,
          [data.date, data.title, data.type, data.description || null, eventId, teacherId]
        );
      }
      return pgQuery(
        `UPDATE events SET date = $1, title = $2, type = $3, description = $4, updated_at = NOW()
         WHERE id = $5 AND class_id IN (SELECT class_id FROM class_teachers WHERE teacher_id = $6)`,
        [data.date, data.title, data.type, data.description || null, eventId, teacherId]
      );
    }
    if (isAdmin) {
      return db.prepare(
        `UPDATE events SET date = ?, title = ?, type = ?, description = ?
         WHERE id = ? AND class_id IN (SELECT c.id FROM classes c JOIN teachers t ON t.id = ? WHERE COALESCE(c.school_id, 'school_default') = COALESCE(t.school_id, 'school_default'))`
      ).run(data.date, data.title, data.type, data.description || null, eventId, teacherId);
    }
    return db.stmt.updateEvent.run(data.date, data.title, data.type, data.description || null, eventId, teacherId);
  },

  async delete(eventId: string, teacherId: string) {
    const isAdmin = await teacherService.getIsAdmin(teacherId);
    if (isPostgres()) {
      if (isAdmin) {
        return pgQuery(
          `DELETE FROM events WHERE id = $1 AND class_id IN (SELECT c.id FROM classes c JOIN teachers t ON t.id = $2 WHERE COALESCE(c.school_id, 'school_default') = COALESCE(t.school_id, 'school_default'))`,
          [eventId, teacherId]
        );
      }
      return pgQuery(
        `DELETE FROM events WHERE id = $1 AND class_id IN (SELECT class_id FROM class_teachers WHERE teacher_id = $2)`,
        [eventId, teacherId]
      );
    }
    if (isAdmin) {
      return db.prepare(
        `DELETE FROM events WHERE id = ? AND class_id IN (SELECT c.id FROM classes c JOIN teachers t ON t.id = ? WHERE COALESCE(c.school_id, 'school_default') = COALESCE(t.school_id, 'school_default'))`
      ).run(eventId, teacherId);
    }
    return db.stmt.deleteEvent.run(eventId, teacherId);
  },
};
