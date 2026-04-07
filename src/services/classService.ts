import { api } from '../lib/api';
import type { ClassData } from '../store';

export interface ClassSummary {
  id: string;
  teacher_id: string;
  name: string;
  owner_name: string;
}

export const classService = {
  async getAll(): Promise<ClassSummary[]> {
    return api.getClasses() as Promise<ClassSummary[]>;
  },

  async create(cls: Partial<ClassData>): Promise<ClassData> {
    return api.createClass(cls);
  },

  async update(id: string, name: string): Promise<{ success: boolean }> {
    return api.updateClass(id, name);
  },

  async delete(id: string): Promise<{ success: boolean }> {
    return api.deleteClass(id);
  },
};
