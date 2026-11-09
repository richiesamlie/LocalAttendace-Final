import { db, isPostgres, pgQuery, pgQueryOne } from './utils';
import { teacherService } from './teacher.service';

/**
 * Timetable Service
 * 
 * Manages class schedules with time slots for different subjects
 * organized by day of week.
 */

export const timetableService = {
  getByClass(classId: string) {
    if (isPostgres()) {
      return pgQuery<{ id: string; class_id: string; day_of_week: number; start_time: string; end_time: string; subject: string; lesson: string }>(
        'SELECT id, class_id, day_of_week, start_time, end_time, subject, lesson FROM timetable_slots WHERE class_id = $1 ORDER BY day_of_week, start_time',
        [classId]
      );
    }
    return db.stmt.getTimetableByClass.all(classId);
  },

  async getById(slotId: string, teacherId: string) {
    if (isPostgres()) {
      const direct = await pgQueryOne<{ id: string; class_id: string; day_of_week: number; start_time: string; end_time: string; subject: string; lesson: string }>(
        `SELECT t.id, t.class_id, t.day_of_week, t.start_time, t.end_time, t.subject, t.lesson FROM timetable_slots t 
         JOIN class_teachers ct ON t.class_id = ct.class_id 
         WHERE t.id = $1 AND ct.teacher_id = $2`,
        [slotId, teacherId]
      );
      if (direct) return direct;
      if (await teacherService.getIsAdmin(teacherId)) {
        return pgQueryOne<{ id: string; class_id: string; day_of_week: number; start_time: string; end_time: string; subject: string; lesson: string }>(
          `SELECT t.id, t.class_id, t.day_of_week, t.start_time, t.end_time, t.subject, t.lesson FROM timetable_slots t
           JOIN classes c ON t.class_id = c.id
           JOIN teachers tr ON tr.id = $2
           WHERE t.id = $1 AND COALESCE(c.school_id, 'school_default') = COALESCE(tr.school_id, 'school_default')`,
          [slotId, teacherId]
        );
      }
      return null;
    }
    const direct = db.stmt.getTimetableSlotById.get(slotId, teacherId);
    if (direct) return direct;
    if (await teacherService.getIsAdmin(teacherId)) {
      return db.prepare(
        `SELECT t.id, t.class_id, t.day_of_week, t.start_time, t.end_time, t.subject, t.lesson FROM timetable_slots t
         JOIN classes c ON t.class_id = c.id
         JOIN teachers tr ON tr.id = ?
         WHERE t.id = ? AND COALESCE(c.school_id, 'school_default') = COALESCE(tr.school_id, 'school_default')`
      ).get(teacherId, slotId);
    }
    return undefined;
  },

  insert(id: string, classId: string, dayOfWeek: number, startTime: string, endTime: string, subject: string, lesson: string) {
    if (isPostgres()) {
      return pgQuery(
        'INSERT INTO timetable_slots (id, class_id, day_of_week, start_time, end_time, subject, lesson) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [id, classId, dayOfWeek, startTime, endTime, subject, lesson]
      );
    }
    return db.stmt.insertTimetableSlot.run(id, classId, dayOfWeek, startTime, endTime, subject, lesson);
  },

  async update(data: { day_of_week: number; start_time: string; end_time: string; subject: string; lesson: string }, slotId: string, teacherId: string) {
    const isAdmin = await teacherService.getIsAdmin(teacherId);
    if (isPostgres()) {
      if (isAdmin) {
        return pgQuery(
          `UPDATE timetable_slots SET day_of_week = $1, start_time = $2, end_time = $3, subject = $4, lesson = $5, updated_at = NOW()
           WHERE id = $6 AND class_id IN (SELECT c.id FROM classes c JOIN teachers t ON t.id = $7 WHERE COALESCE(c.school_id, 'school_default') = COALESCE(t.school_id, 'school_default'))`,
          [data.day_of_week, data.start_time, data.end_time, data.subject, data.lesson, slotId, teacherId]
        );
      }
      return pgQuery(
        `UPDATE timetable_slots SET day_of_week = $1, start_time = $2, end_time = $3, subject = $4, lesson = $5, updated_at = NOW()
         WHERE id = $6 AND class_id IN (SELECT class_id FROM class_teachers WHERE teacher_id = $7)`,
        [data.day_of_week, data.start_time, data.end_time, data.subject, data.lesson, slotId, teacherId]
      );
    }
    if (isAdmin) {
      return db.prepare(
        `UPDATE timetable_slots SET day_of_week = ?, start_time = ?, end_time = ?, subject = ?, lesson = ?
         WHERE id = ? AND class_id IN (SELECT c.id FROM classes c JOIN teachers t ON t.id = ? WHERE COALESCE(c.school_id, 'school_default') = COALESCE(t.school_id, 'school_default'))`
      ).run(data.day_of_week, data.start_time, data.end_time, data.subject, data.lesson, slotId, teacherId);
    }
    return db.stmt.updateTimetableSlot.run(data.day_of_week, data.start_time, data.end_time, data.subject, data.lesson, slotId, teacherId);
  },

  async delete(slotId: string, teacherId: string) {
    const isAdmin = await teacherService.getIsAdmin(teacherId);
    if (isPostgres()) {
      if (isAdmin) {
        return pgQuery(
          `DELETE FROM timetable_slots WHERE id = $1 AND class_id IN (SELECT c.id FROM classes c JOIN teachers t ON t.id = $2 WHERE COALESCE(c.school_id, 'school_default') = COALESCE(t.school_id, 'school_default'))`,
          [slotId, teacherId]
        );
      }
      return pgQuery(
        `DELETE FROM timetable_slots WHERE id = $1 AND class_id IN (SELECT class_id FROM class_teachers WHERE teacher_id = $2)`,
        [slotId, teacherId]
      );
    }
    if (isAdmin) {
      return db.prepare(
        `DELETE FROM timetable_slots WHERE id = ? AND class_id IN (SELECT c.id FROM classes c JOIN teachers t ON t.id = ? WHERE COALESCE(c.school_id, 'school_default') = COALESCE(t.school_id, 'school_default'))`
      ).run(slotId, teacherId);
    }
    return db.stmt.deleteTimetableSlot.run(slotId, teacherId);
  },
};
