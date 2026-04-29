import { db, isPostgres, pgQuery, pgTransaction } from './utils';

/**
 * Seating Service
 * 
 * Manages classroom seating arrangements with atomic layout updates
 * to ensure consistency across seat and student assignments.
 */

export const seatingService = {
  getByClass(classId: string) {
    if (isPostgres()) {
      return pgQuery<{ seat_id: string; student_id: string | null }>(
        'SELECT seat_id, student_id FROM seating_layout WHERE class_id = $1',
        [classId]
      );
    }
    return db.stmt.getSeatingByClass.all(classId);
  },

  deleteSeat(classId: string, seatId: string) {
    if (isPostgres()) {
      return pgQuery('DELETE FROM seating_layout WHERE class_id = $1 AND seat_id = $2', [classId, seatId]);
    }
    return db.stmt.deleteSeatingBySeat.run(classId, seatId);
  },

  deleteStudent(classId: string, studentId: string) {
    if (isPostgres()) {
      return pgQuery('DELETE FROM seating_layout WHERE class_id = $1 AND student_id = $2', [classId, studentId]);
    }
    return db.stmt.deleteSeatingByStudent.run(classId, studentId);
  },

  insert(classId: string, seatId: string, studentId: string) {
    if (isPostgres()) {
      return pgQuery(
        `INSERT INTO seating_layout (class_id, seat_id, student_id) VALUES ($1, $2, $3)
         ON CONFLICT (class_id, seat_id) DO UPDATE SET student_id = $3, updated_at = NOW()`,
        [classId, seatId, studentId]
      );
    }
    return db.stmt.insertSeating.run(classId, seatId, studentId);
  },

  clear(classId: string) {
    if (isPostgres()) {
      return pgQuery('DELETE FROM seating_layout WHERE class_id = $1', [classId]);
    }
    return db.stmt.clearSeatingByClass.run(classId);
  },

  // N4: Atomically replace the entire seating layout.
  // Uses SQLite transactions locally, and PostgreSQL transactions (`pgTransaction`) when deployed,
  // ensuring that a failure mid-loop correctly rolls back the operation instead of leaving partial state.
  async saveLayout(classId: string, layout: Record<string, string>) {
    if (isPostgres()) {
      return pgTransaction(async (client) => {
        await client.query('DELETE FROM seating_layout WHERE class_id = $1', [classId]);
        for (const [seatId, studentId] of Object.entries(layout)) {
          if (studentId) {
            await client.query(
              `INSERT INTO seating_layout (class_id, seat_id, student_id) VALUES ($1, $2, $3)
               ON CONFLICT (class_id, seat_id) DO UPDATE SET student_id = $3, updated_at = NOW()`,
              [classId, seatId, studentId]
            );
          }
        }
      });
    }

    // SQLite: db.transaction ensures the loop is atomic
    const tx = (db as any).transaction(() => {
      db.stmt.clearSeatingByClass.run(classId);
      for (const [seatId, studentId] of Object.entries(layout)) {
        if (studentId) {
          db.stmt.insertSeating.run(classId, seatId, studentId);
        }
      }
    });
    tx();
  },
};
