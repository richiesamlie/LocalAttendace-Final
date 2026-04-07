import { api } from '../lib/api';
import type { IClassRepository, ClassSummary } from './IClassRepository';

export class SQLiteClassRepository implements IClassRepository {
  async getAll(): Promise<ClassSummary[]> {
    return api.getClasses() as Promise<ClassSummary[]>;
  }

  async getById(id: string): Promise<ClassSummary | null> {
    const classes = await this.getAll();
    return classes.find(c => c.id === id) ?? null;
  }

  async create(cls: { id: string; name: string }): Promise<ClassSummary> {
    const result = await api.createClass(cls) as unknown as ClassSummary;
    return result;
  }

  async update(id: string, name: string): Promise<{ success: boolean }> {
    return api.updateClass(id, name);
  }

  async delete(id: string): Promise<{ success: boolean }> {
    return api.deleteClass(id);
  }
}
