export interface INoteRepository {
  getAll(classId: string): Promise<Record<string, string>>;
  save(classId: string, date: string, note: string): Promise<{ success: boolean }>;
}
