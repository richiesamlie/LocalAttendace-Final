import { api } from '../lib/api';
import type { Student } from '../store';

export const studentService = {
  async getAll(classId: string, includeArchived = false): Promise<Student[]> {
    return api.getStudents(classId, includeArchived);
  },

  async create(classId: string, student: Student): Promise<{ success: boolean }> {
    return api.createStudent(classId, student);
  },

  async update(studentId: string, data: Partial<Student>): Promise<{ success: boolean }> {
    return api.updateStudent(studentId, data);
  },

  async delete(studentId: string): Promise<{ success: boolean }> {
    return api.deleteStudent(studentId);
  },

  async sync(classId: string, students: Student[]): Promise<{ success: boolean; students: Student[] }> {
    return api.syncStudents(classId, students);
  },
};
