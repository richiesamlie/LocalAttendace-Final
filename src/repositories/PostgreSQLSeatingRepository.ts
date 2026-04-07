import { query } from './postgres';
import type { ISeatingRepository } from './ISeatingRepository';

export class PostgreSQLSeatingRepository implements ISeatingRepository {
  async getAll(classId: string): Promise<Record<string, string>> {
    const rows = await query<{ seat_id: string; student_id: string }>(
      'SELECT seat_id, student_id FROM seating_layout WHERE class_id = $1',
      [classId]
    );
    const layout: Record<string, string> = {};
    for (const row of rows) {
      if (row.student_id) layout[row.seat_id] = row.student_id;
    }
    return layout;
  }

  async updateSeat(classId: string, seatId: string, studentId: string | null): Promise<{ success: boolean }> {
    if (studentId) {
      await query(
        'INSERT INTO seating_layout (class_id, seat_id, student_id) VALUES ($1, $2, $3) ON CONFLICT (class_id, seat_id) DO UPDATE SET student_id = $3',
        [classId, seatId, studentId]
      );
    } else {
      await query('DELETE FROM seating_layout WHERE class_id = $1 AND seat_id = $2', [classId, seatId]);
    }
    return { success: true };
  }

  async saveLayout(classId: string, layout: Record<string, string>): Promise<{ success: boolean }> {
    await query('DELETE FROM seating_layout WHERE class_id = $1', [classId]);
    for (const [seatId, studentId] of Object.entries(layout)) {
      if (studentId) {
        await query(
          'INSERT INTO seating_layout (class_id, seat_id, student_id) VALUES ($1, $2, $3)',
          [classId, seatId, studentId]
        );
      }
    }
    return { success: true };
  }

  async clear(classId: string): Promise<{ success: boolean }> {
    await query('DELETE FROM seating_layout WHERE class_id = $1', [classId]);
    return { success: true };
  }
}
