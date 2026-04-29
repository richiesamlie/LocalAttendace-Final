import { db, isPostgres, pgQuery, pgQueryOne } from './utils';

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

  getById(slotId: string, teacherId: string) {
    if (isPostgres()) {
      return pgQueryOne<{ id: string; class_id: string }>(
        `SELECT t.id, t.class_id FROM timetable_slots t 
         JOIN class_teachers ct ON t.class_id = ct.class_id 
         WHERE t.id = $1 AND ct.teacher_id = $2`,
        [slotId, teacherId]
      );
    }
    return db.stmt.getTimetableSlotById.get(slotId, teacherId);
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

  update(data: { day_of_week: number; start_time: string; end_time: string; subject: string; lesson: string }, slotId: string, teacherId: string) {
    if (isPostgres()) {
      return pgQuery(
        `UPDATE timetable_slots SET day_of_week = $1, start_time = $2, end_time = $3, subject = $4, lesson = $5, updated_at = NOW()
         WHERE id = $6 AND class_id IN (SELECT class_id FROM class_teachers WHERE teacher_id = $7)`,
        [data.day_of_week, data.start_time, data.end_time, data.subject, data.lesson, slotId, teacherId]
      );
    }
    return db.stmt.updateTimetableSlot.run(data.day_of_week, data.start_time, data.end_time, data.subject, data.lesson, slotId, teacherId);
  },

  delete(slotId: string, teacherId: string) {
    if (isPostgres()) {
      return pgQuery(
        `DELETE FROM timetable_slots WHERE id = $1 AND class_id IN (SELECT class_id FROM class_teachers WHERE teacher_id = $2)`,
        [slotId, teacherId]
      );
    }
    return db.stmt.deleteTimetableSlot.run(slotId, teacherId);
  },
};
