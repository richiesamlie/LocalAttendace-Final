import { query, queryOne } from './postgres';
import type { ITimetableRepository } from './ITimetableRepository';
import type { TimetableSlot } from '../store';

export class PostgreSQLTimetableRepository implements ITimetableRepository {
  async getAll(classId: string): Promise<TimetableSlot[]> {
    return query<TimetableSlot>(
      'SELECT id, day_of_week as "dayOfWeek", start_time as "startTime", end_time as "endTime", subject, lesson FROM timetable_slots WHERE class_id = $1 ORDER BY day_of_week, start_time',
      [classId]
    );
  }

  async getById(slotId: string): Promise<TimetableSlot | null> {
    return queryOne<TimetableSlot>(
      'SELECT id, day_of_week as "dayOfWeek", start_time as "startTime", end_time as "endTime", subject, lesson FROM timetable_slots WHERE id = $1',
      [slotId]
    );
  }

  async create(classId: string, slot: TimetableSlot): Promise<{ success: boolean }> {
    await query(
      'INSERT INTO timetable_slots (id, class_id, day_of_week, start_time, end_time, subject, lesson) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [slot.id, classId, slot.dayOfWeek, slot.startTime, slot.endTime, slot.subject, slot.lesson]
    );
    return { success: true };
  }

  async update(slotId: string, data: Partial<TimetableSlot>): Promise<{ success: boolean }> {
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (data.dayOfWeek !== undefined) { sets.push(`day_of_week = $${idx++}`); values.push(data.dayOfWeek); }
    if (data.startTime !== undefined) { sets.push(`start_time = $${idx++}`); values.push(data.startTime); }
    if (data.endTime !== undefined) { sets.push(`end_time = $${idx++}`); values.push(data.endTime); }
    if (data.subject !== undefined) { sets.push(`subject = $${idx++}`); values.push(data.subject); }
    if (data.lesson !== undefined) { sets.push(`lesson = $${idx++}`); values.push(data.lesson); }

    if (sets.length === 0) return { success: true };

    sets.push(`updated_at = NOW()`);
    values.push(slotId);

    await query(`UPDATE timetable_slots SET ${sets.join(', ')} WHERE id = $${idx}`, values);
    return { success: true };
  }

  async delete(slotId: string): Promise<{ success: boolean }> {
    await query('DELETE FROM timetable_slots WHERE id = $1', [slotId]);
    return { success: true };
  }
}
