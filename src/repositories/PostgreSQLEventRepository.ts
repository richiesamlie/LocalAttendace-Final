import { query, queryOne } from './postgres';
import type { IEventRepository } from './IEventRepository';
import type { CalendarEvent } from '../store';

export class PostgreSQLEventRepository implements IEventRepository {
  async getAll(classId: string): Promise<CalendarEvent[]> {
    return query<CalendarEvent>(
      'SELECT id, date, title, type, description FROM events WHERE class_id = $1 ORDER BY date DESC',
      [classId]
    );
  }

  async getById(eventId: string): Promise<CalendarEvent | null> {
    return queryOne<CalendarEvent>(
      'SELECT id, date, title, type, description FROM events WHERE id = $1',
      [eventId]
    );
  }

  async create(classId: string, events: CalendarEvent[]): Promise<{ success: boolean }> {
    for (const e of events) {
      await query(
        'INSERT INTO events (id, class_id, date, title, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
        [e.id, classId, e.date, e.title, e.type, e.description || null]
      );
    }
    return { success: true };
  }

  async update(eventId: string, data: Partial<CalendarEvent>): Promise<{ success: boolean }> {
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (data.date !== undefined) { sets.push(`date = $${idx++}`); values.push(data.date); }
    if (data.title !== undefined) { sets.push(`title = $${idx++}`); values.push(data.title); }
    if (data.type !== undefined) { sets.push(`type = $${idx++}`); values.push(data.type); }
    if (data.description !== undefined) { sets.push(`description = $${idx++}`); values.push(data.description); }

    if (sets.length === 0) return { success: true };

    sets.push(`updated_at = NOW()`);
    values.push(eventId);

    await query(`UPDATE events SET ${sets.join(', ')} WHERE id = $${idx}`, values);
    return { success: true };
  }

  async delete(eventId: string): Promise<{ success: boolean }> {
    await query('DELETE FROM events WHERE id = $1', [eventId]);
    return { success: true };
  }
}
