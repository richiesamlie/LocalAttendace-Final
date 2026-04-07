export interface ClassSummary {
  id: string;
  teacher_id: string;
  name: string;
  owner_name: string;
}

export interface IClassRepository {
  getAll(): Promise<ClassSummary[]>;
  getById(id: string): Promise<ClassSummary | null>;
  create(cls: { id: string; name: string }): Promise<ClassSummary>;
  update(id: string, name: string): Promise<{ success: boolean }>;
  delete(id: string): Promise<{ success: boolean }>;
}
