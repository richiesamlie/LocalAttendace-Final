import { query, queryOne } from './postgres';
import type { IClassRepository, ClassSummary } from './IClassRepository';

export class PostgreSQLClassRepository implements IClassRepository {
  async getAll(): Promise<ClassSummary[]> {
    return query<ClassSummary>(
      'SELECT id, teacher_id, name, owner_name FROM classes ORDER BY name'
    );
  }

  async getById(id: string): Promise<ClassSummary | null> {
    return queryOne<ClassSummary>(
      'SELECT id, teacher_id, name, owner_name FROM classes WHERE id = $1',
      [id]
    );
  }

  async create(cls: { id: string; name: string }): Promise<ClassSummary> {
    const result = await query<ClassSummary>(
      'INSERT INTO classes (id, name, teacher_id, owner_name) VALUES ($1, $2, $3, $4) RETURNING id, teacher_id, name, owner_name',
      [cls.id, cls.name, cls.id, 'Administrator']
    );
    return result[0];
  }

  async update(id: string, name: string): Promise<{ success: boolean }> {
    await query('UPDATE classes SET name = $1, updated_at = NOW() WHERE id = $2', [name, id]);
    return { success: true };
  }

  async delete(id: string): Promise<{ success: boolean }> {
    await query('DELETE FROM classes WHERE id = $1', [id]);
    return { success: true };
  }
}
