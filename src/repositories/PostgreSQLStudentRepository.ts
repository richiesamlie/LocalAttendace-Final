import { query, queryOne } from './postgres';
import type { IStudentRepository } from './IStudentRepository';
import type { Student } from '../store';

export class PostgreSQLStudentRepository implements IStudentRepository {
  async getAll(classId: string, includeArchived = false): Promise<Student[]> {
    if (includeArchived) {
      return query<Student>(
        'SELECT id, name, roll_number as "rollNumber", parent_name as "parentName", parent_phone as "parentPhone", is_flagged as "isFlagged", is_archived as "isArchived" FROM students WHERE class_id = $1 ORDER BY roll_number, name',
        [classId]
      );
    }
    return query<Student>(
      'SELECT id, name, roll_number as "rollNumber", parent_name as "parentName", parent_phone as "parentPhone", is_flagged as "isFlagged", is_archived as "isArchived" FROM students WHERE class_id = $1 AND is_archived = false ORDER BY roll_number, name',
      [classId]
    );
  }

  async getById(studentId: string): Promise<Student | null> {
    return queryOne<Student>(
      'SELECT id, name, roll_number as "rollNumber", parent_name as "parentName", parent_phone as "parentPhone", is_flagged as "isFlagged", is_archived as "isArchived" FROM students WHERE id = $1',
      [studentId]
    );
  }

  async create(classId: string, student: Student): Promise<{ success: boolean }> {
    await query(
      'INSERT INTO students (id, class_id, name, roll_number, parent_name, parent_phone) VALUES ($1, $2, $3, $4, $5, $6)',
      [student.id, classId, student.name, student.rollNumber, student.parentName, student.parentPhone]
    );
    return { success: true };
  }

  async update(studentId: string, data: Partial<Student>): Promise<{ success: boolean }> {
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (data.name !== undefined) { sets.push(`name = $${idx++}`); values.push(data.name); }
    if (data.rollNumber !== undefined) { sets.push(`roll_number = $${idx++}`); values.push(data.rollNumber); }
    if (data.parentName !== undefined) { sets.push(`parent_name = $${idx++}`); values.push(data.parentName); }
    if (data.parentPhone !== undefined) { sets.push(`parent_phone = $${idx++}`); values.push(data.parentPhone); }
    if (data.isFlagged !== undefined) { sets.push(`is_flagged = $${idx++}`); values.push(data.isFlagged); }
    if (data.isArchived !== undefined) { sets.push(`is_archived = $${idx++}`); values.push(data.isArchived); }

    if (sets.length === 0) return { success: true };

    sets.push(`updated_at = NOW()`);
    values.push(studentId);

    await query(`UPDATE students SET ${sets.join(', ')} WHERE id = $${idx}`, values);
    return { success: true };
  }

  async delete(studentId: string): Promise<{ success: boolean }> {
    await query('DELETE FROM students WHERE id = $1', [studentId]);
    return { success: true };
  }

  async sync(classId: string, students: Student[]): Promise<{ success: boolean; students: Student[] }> {
    await query('DELETE FROM students WHERE class_id = $1', [classId]);
    for (const s of students) {
      await query(
        'INSERT INTO students (id, class_id, name, roll_number, parent_name, parent_phone, is_flagged, is_archived) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [s.id, classId, s.name, s.rollNumber, s.parentName, s.parentPhone, s.isFlagged || false, s.isArchived || false]
      );
    }
    return { success: true, students };
  }
}
