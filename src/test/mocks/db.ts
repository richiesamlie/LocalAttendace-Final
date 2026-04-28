/**
 * Database Mock Utilities for Testing
 * 
 * Provides mock database instances and helper functions for tests.
 * 
 * Usage:
 *   import { createMockDb, seedMockData } from './mocks/db';
 *   
 *   beforeEach(() => {
 *     db = createMockDb();
 *     seedMockData(db);
 *   });
 */

import Database from 'better-sqlite3';
import type { Teacher, Class, Student } from '../../types/db';

/**
 * Creates an in-memory SQLite database for testing
 */
export function createMockDb(): Database.Database {
  // TODO: Create in-memory database
  // TODO: Run schema initialization
  // TODO: Return database instance
  throw new Error('Not implemented');
}

/**
 * Seeds mock database with test data
 */
export function seedMockData(db: Database.Database): void {
  // TODO: Insert mock teachers
  // TODO: Insert mock classes
  // TODO: Insert mock students
  // TODO: Insert mock class_teachers relationships
  throw new Error('Not implemented');
}

/**
 * Mock data fixtures
 */
export const mockTeachers: Partial<Teacher>[] = [
  {
    id: 'teacher-1',
    username: 'admin',
    name: 'Admin Teacher',
    is_admin: 1,
  },
  {
    id: 'teacher-2',
    username: 'teacher1',
    name: 'John Smith',
    is_admin: 0,
  },
];

export const mockClasses: Partial<Class>[] = [
  {
    id: 'class-1',
    name: 'Class 1A',
    grade: '1',
    section: 'A',
  },
];

export const mockStudents: Partial<Student>[] = [
  {
    id: 'student-1',
    name: 'Alice Johnson',
    student_id: 'S001',
    class_id: 'class-1',
  },
  {
    id: 'student-2',
    name: 'Bob Williams',
    student_id: 'S002',
    class_id: 'class-1',
  },
];
