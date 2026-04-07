import type { Student } from '../store';

export interface IStudentRepository {
  getAll(classId: string, includeArchived?: boolean): Promise<Student[]>;
  getById(studentId: string): Promise<Student | null>;
  create(classId: string, student: Student): Promise<{ success: boolean }>;
  update(studentId: string, data: Partial<Student>): Promise<{ success: boolean }>;
  delete(studentId: string): Promise<{ success: boolean }>;
  sync(classId: string, students: Student[]): Promise<{ success: boolean; students: Student[] }>;
}
