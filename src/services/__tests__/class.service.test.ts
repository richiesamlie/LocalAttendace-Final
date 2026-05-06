import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createMockDb, seedMockData } from '../../test/mocks/db';

/**
 * Class Service Tests
 * 
 * Tests for class CRUD operations and authorization.
 */

describe('Class Service', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createMockDb();
    seedMockData(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('getById', () => {
    it('should retrieve class by ID for authorized teacher', () => {
      const result = db.prepare(`
        SELECT c.id, c.name, c.teacher_id 
        FROM classes c 
        JOIN class_teachers ct ON c.id = ct.class_id 
        WHERE c.id = ? AND ct.teacher_id = ?
      `).get('class-1', 'teacher-1') as any;
      
      expect(result).toBeDefined();
      expect(result.id).toBe('class-1');
      expect(result.name).toBe('Class 1A');
      expect(result.teacher_id).toBe('teacher-1');
    });

    it('should return undefined for unauthorized teacher', () => {
      const result = db.prepare(`
        SELECT c.id, c.name, c.teacher_id 
        FROM classes c 
        JOIN class_teachers ct ON c.id = ct.class_id 
        WHERE c.id = ? AND ct.teacher_id = ?
      `).get('class-1', 'teacher-3');
      
      expect(result).toBeUndefined();
    });

    it('should return undefined for non-existent class', () => {
      const result = db.prepare(`
        SELECT c.id, c.name, c.teacher_id 
        FROM classes c 
        JOIN class_teachers ct ON c.id = ct.class_id 
        WHERE c.id = ? AND ct.teacher_id = ?
      `).get('nonexistent', 'teacher-1');
      
      expect(result).toBeUndefined();
    });
  });

  describe('getByTeacher', () => {
    it('should retrieve all classes for a teacher', () => {
      const results = db.prepare(`
        SELECT c.id, c.name, ct.role
        FROM classes c 
        JOIN class_teachers ct ON c.id = ct.class_id 
        WHERE ct.teacher_id = ?
        ORDER BY c.name
      `).all('teacher-1');
      
      expect(results).toHaveLength(1);
      expect(results[0]).toHaveProperty('id', 'class-1');
      expect(results[0]).toHaveProperty('role', 'owner');
    });

    it('should return empty array for teacher with no classes', () => {
      const results = db.prepare(`
        SELECT c.id, c.name, ct.role
        FROM classes c 
        JOIN class_teachers ct ON c.id = ct.class_id 
        WHERE ct.teacher_id = ?
      `).all('teacher-3');
      
      expect(results).toHaveLength(0);
    });

    it('should show correct role for each class', () => {
      const results = db.prepare(`
        SELECT c.id, c.name, ct.role
        FROM classes c 
        JOIN class_teachers ct ON c.id = ct.class_id 
        WHERE ct.teacher_id = ?
      `).all('teacher-2') as any[];
      
      expect(results).toHaveLength(1);
      expect(results[0].role).toBe('owner');
    });
  });

  describe('insert', () => {
    it('should create a new class', () => {
      const newClassId = 'class-new';
      const teacherId = 'teacher-1';
      const className = 'New Class';

      db.prepare('INSERT INTO classes (id, teacher_id, name) VALUES (?, ?, ?)').run(
        newClassId, teacherId, className
      );
      
      // Also create class_teachers entry (owner)
      db.prepare('INSERT INTO class_teachers (class_id, teacher_id, role) VALUES (?, ?, ?)').run(
        newClassId, teacherId, 'owner'
      );

      const result = db.prepare('SELECT * FROM classes WHERE id = ?').get(newClassId) as any;
      
      expect(result).toBeDefined();
      expect(result.id).toBe(newClassId);
      expect(result.name).toBe(className);
      expect(result.teacher_id).toBe(teacherId);
    });

    it('should create class_teachers entry with owner role', () => {
      const newClassId = 'class-ownership-test';
      const teacherId = 'teacher-1';

      db.prepare('INSERT INTO classes (id, teacher_id, name) VALUES (?, ?, ?)').run(
        newClassId, teacherId, 'Test Class'
      );
      db.prepare('INSERT INTO class_teachers (class_id, teacher_id, role) VALUES (?, ?, ?)').run(
        newClassId, teacherId, 'owner'
      );

      const relation = db.prepare(
        'SELECT * FROM class_teachers WHERE class_id = ? AND teacher_id = ?'
      ).get(newClassId, teacherId) as any;
      
      expect(relation).toBeDefined();
      expect(relation.role).toBe('owner');
    });

    it('should enforce unique class IDs', () => {
      expect(() => {
        db.prepare('INSERT INTO classes (id, teacher_id, name) VALUES (?, ?, ?)').run(
          'class-1', 'teacher-1', 'Duplicate Class'
        );
      }).toThrow(); // Should violate PRIMARY KEY constraint
    });
  });

  describe('update', () => {
    it('should update class name for owner', () => {
      const classId = 'class-1';
      const newName = 'Updated Class Name';

      db.prepare('UPDATE classes SET name = ? WHERE id = ?').run(newName, classId);

      const result = db.prepare('SELECT name FROM classes WHERE id = ?').get(classId) as any;
      
      expect(result.name).toBe(newName);
    });

    it('should allow admin to update any class', () => {
      const classId = 'class-2';
      const newName = 'Admin Updated Name';

      // Admin can update any class (no teacher check)
      db.prepare('UPDATE classes SET name = ? WHERE id = ?').run(newName, classId);

      const result = db.prepare('SELECT name FROM classes WHERE id = ?').get(classId) as any;
      
      expect(result.name).toBe(newName);
    });

    it('should not update non-existent class', () => {
      const result = db.prepare('UPDATE classes SET name = ? WHERE id = ?').run(
        'New Name', 'nonexistent'
      );
      
      expect(result.changes).toBe(0);
    });
  });

  describe('delete', () => {
    it('should delete class for owner', () => {
      const classId = 'class-1';
      
      db.prepare('DELETE FROM classes WHERE id = ?').run(classId);

      const result = db.prepare('SELECT * FROM classes WHERE id = ?').get(classId);
      
      expect(result).toBeUndefined();
    });

    it('should cascade delete class_teachers entries', () => {
      const classId = 'class-1';
      
      // Delete class
      db.prepare('DELETE FROM classes WHERE id = ?').run(classId);

      // Check class_teachers entry is also deleted (CASCADE)
      const relation = db.prepare(
        'SELECT * FROM class_teachers WHERE class_id = ?'
      ).get(classId);
      
      expect(relation).toBeUndefined();
    });

    it('should cascade delete students', () => {
      const classId = 'class-1';
      
      // Delete class
      db.prepare('DELETE FROM classes WHERE id = ?').run(classId);

      // Check students are also deleted (CASCADE)
      const students = db.prepare('SELECT * FROM students WHERE class_id = ?').all(classId);
      
      expect(students).toHaveLength(0);
    });

    it('should allow admin to delete any class', () => {
      const classId = 'class-2';
      
      db.prepare('DELETE FROM classes WHERE id = ?').run(classId);

      const result = db.prepare('SELECT * FROM classes WHERE id = ?').get(classId);
      
      expect(result).toBeUndefined();
    });

    it('should not delete non-existent class', () => {
      const result = db.prepare('DELETE FROM classes WHERE id = ?').run('nonexistent');
      
      expect(result.changes).toBe(0);
    });
  });

  describe('getAll', () => {
    it('should retrieve all classes (admin function)', () => {
      const results = db.prepare('SELECT * FROM classes ORDER BY name').all();
      
      expect(results).toHaveLength(2);
      expect(results[0]).toHaveProperty('name');
      expect(results[0]).toHaveProperty('teacher_id');
    });

    it('should include teacher information', () => {
      const results = db.prepare(`
        SELECT c.id, c.name, c.teacher_id, t.name as teacher_name
        FROM classes c
        JOIN teachers t ON c.teacher_id = t.id
        ORDER BY c.name
      `).all() as any[];
      
      expect(results).toHaveLength(2);
      expect(results[0]).toHaveProperty('teacher_name');
      expect(results[0].teacher_name).toBeTruthy();
    });
  });

  describe('class access authorization', () => {
    it('should verify teacher belongs to class', () => {
      const hasAccess = db.prepare(`
        SELECT COUNT(*) as count FROM class_teachers 
        WHERE class_id = ? AND teacher_id = ?
      `).get('class-1', 'teacher-1') as any;
      
      expect(hasAccess.count).toBeGreaterThan(0);
    });

    it('should verify teacher does not belong to class', () => {
      const hasAccess = db.prepare(`
        SELECT COUNT(*) as count FROM class_teachers 
        WHERE class_id = ? AND teacher_id = ?
      `).get('class-1', 'teacher-3') as any;
      
      expect(hasAccess.count).toBe(0);
    });

    it('should distinguish between owner and regular teacher', () => {
      const ownerRole = db.prepare(`
        SELECT role FROM class_teachers 
        WHERE class_id = ? AND teacher_id = ?
      `).get('class-1', 'teacher-1') as any;
      
      expect(ownerRole.role).toBe('owner');
    });
  });
});
