import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createMockDb, seedMockData } from '../../test/mocks/db';

/**
 * Student Service Tests
 * 
 * Tests for student CRUD operations and authorization.
 */

describe('Student Service', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createMockDb();
    seedMockData(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('getByClass', () => {
    it('should retrieve all students in a class', () => {
      const results = db.prepare(`
        SELECT id, name, roll_number, parent_name, parent_phone, is_flagged, is_archived
        FROM students 
        WHERE class_id = ? AND is_archived = 0
        ORDER BY roll_number, name
      `).all('class-1');
      
      expect(results).toHaveLength(2);
      expect(results[0]).toHaveProperty('name');
      expect(results[0]).toHaveProperty('roll_number');
    });

    it('should exclude archived students by default', () => {
      // Archive a student first
      db.prepare('UPDATE students SET is_archived = 1 WHERE id = ?').run('student-1');
      
      const results = db.prepare(`
        SELECT * FROM students 
        WHERE class_id = ? AND is_archived = 0
      `).all('class-1');
      
      expect(results).toHaveLength(1);
      expect(results[0]).not.toHaveProperty('id', 'student-1');
    });

    it('should include archived students when requested', () => {
      // Archive a student
      db.prepare('UPDATE students SET is_archived = 1 WHERE id = ?').run('student-1');
      
      const results = db.prepare(`
        SELECT * FROM students WHERE class_id = ?
      `).all('class-1');
      
      expect(results).toHaveLength(2);
    });

    it('should return empty array for class with no students', () => {
      // Create new empty class
      db.prepare('INSERT INTO classes (id, teacher_id, name) VALUES (?, ?, ?)').run(
        'class-empty', 'teacher-1', 'Empty Class'
      );
      
      const results = db.prepare('SELECT * FROM students WHERE class_id = ?').all('class-empty');
      
      expect(results).toHaveLength(0);
    });

    it('should order students by roll_number and name', () => {
      const results = db.prepare(`
        SELECT roll_number FROM students 
        WHERE class_id = ? AND is_archived = 0
        ORDER BY roll_number, name
      `).all('class-1') as any[];
      
      expect(results).toHaveLength(2);
      expect(results[0].roll_number).toBe('001');
      expect(results[1].roll_number).toBe('002');
    });
  });

  describe('getById', () => {
    it('should retrieve student by ID with authorization', () => {
      const result = db.prepare(`
        SELECT s.id, s.name, s.class_id 
        FROM students s 
        JOIN class_teachers ct ON s.class_id = ct.class_id 
        WHERE s.id = ? AND ct.teacher_id = ?
      `).get('student-1', 'teacher-1') as any;
      
      expect(result).toBeDefined();
      expect(result.id).toBe('student-1');
      expect(result.name).toBe('Alice Johnson');
    });

    it('should return undefined for unauthorized teacher', () => {
      const result = db.prepare(`
        SELECT s.id FROM students s 
        JOIN class_teachers ct ON s.class_id = ct.class_id 
        WHERE s.id = ? AND ct.teacher_id = ?
      `).get('student-1', 'teacher-3');
      
      expect(result).toBeUndefined();
    });

    it('should return undefined for non-existent student', () => {
      const result = db.prepare(`
        SELECT s.id FROM students s 
        JOIN class_teachers ct ON s.class_id = ct.class_id 
        WHERE s.id = ? AND ct.teacher_id = ?
      `).get('nonexistent', 'teacher-1');
      
      expect(result).toBeUndefined();
    });
  });

  describe('insert', () => {
    it('should create a new student', () => {
      const newStudentId = 'student-new';
      const classId = 'class-1';
      
      db.prepare(`
        INSERT INTO students (id, class_id, name, roll_number, parent_name, parent_phone, is_flagged)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(newStudentId, classId, 'New Student', '003', 'Parent Name', '555-0004', 0);

      const result = db.prepare('SELECT * FROM students WHERE id = ?').get(newStudentId) as any;
      
      expect(result).toBeDefined();
      expect(result.id).toBe(newStudentId);
      expect(result.name).toBe('New Student');
      expect(result.roll_number).toBe('003');
      expect(result.class_id).toBe(classId);
    });

    it('should create student with optional fields null', () => {
      db.prepare(`
        INSERT INTO students (id, class_id, name, roll_number, parent_name, parent_phone, is_flagged)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('student-minimal', 'class-1', 'Minimal Student', '004', null, null, 0);

      const result = db.prepare('SELECT * FROM students WHERE id = ?').get('student-minimal') as any;
      
      expect(result).toBeDefined();
      expect(result.parent_name).toBeNull();
      expect(result.parent_phone).toBeNull();
    });

    it('should enforce foreign key constraint for class_id', () => {
      expect(() => {
        db.prepare(`
          INSERT INTO students (id, class_id, name, roll_number, is_flagged)
          VALUES (?, ?, ?, ?, ?)
        `).run('student-invalid', 'nonexistent-class', 'Invalid', '999', 0);
      }).toThrow(); // Should violate FOREIGN KEY constraint
    });

    it('should enforce unique student IDs', () => {
      expect(() => {
        db.prepare(`
          INSERT INTO students (id, class_id, name, roll_number, is_flagged)
          VALUES (?, ?, ?, ?, ?)
        `).run('student-1', 'class-1', 'Duplicate', '999', 0);
      }).toThrow(); // Should violate PRIMARY KEY constraint
    });

    it('should store is_flagged status correctly', () => {
      db.prepare(`
        INSERT INTO students (id, class_id, name, roll_number, is_flagged)
        VALUES (?, ?, ?, ?, ?)
      `).run('student-flagged', 'class-1', 'Flagged Student', '005', 1);

      const result = db.prepare('SELECT is_flagged FROM students WHERE id = ?').get('student-flagged') as any;
      
      expect(result.is_flagged).toBe(1);
    });
  });

  describe('update', () => {
    it('should update student name', () => {
      const studentId = 'student-1';
      const newName = 'Updated Name';

      db.prepare('UPDATE students SET name = ? WHERE id = ?').run(newName, studentId);

      const result = db.prepare('SELECT name FROM students WHERE id = ?').get(studentId) as any;
      
      expect(result.name).toBe(newName);
    });

    it('should update student roll number', () => {
      const studentId = 'student-1';
      const newRollNumber = '999';

      db.prepare('UPDATE students SET roll_number = ? WHERE id = ?').run(newRollNumber, studentId);

      const result = db.prepare('SELECT roll_number FROM students WHERE id = ?').get(studentId) as any;
      
      expect(result.roll_number).toBe(newRollNumber);
    });

    it('should update parent information', () => {
      const studentId = 'student-1';
      
      db.prepare('UPDATE students SET parent_name = ?, parent_phone = ? WHERE id = ?').run(
        'New Parent', '555-9999', studentId
      );

      const result = db.prepare('SELECT parent_name, parent_phone FROM students WHERE id = ?').get(studentId) as any;
      
      expect(result.parent_name).toBe('New Parent');
      expect(result.parent_phone).toBe('555-9999');
    });

    it('should update flagged status', () => {
      const studentId = 'student-1';
      
      db.prepare('UPDATE students SET is_flagged = ? WHERE id = ?').run(1, studentId);

      const result = db.prepare('SELECT is_flagged FROM students WHERE id = ?').get(studentId) as any;
      
      expect(result.is_flagged).toBe(1);
    });

    it('should allow partial updates', () => {
      const studentId = 'student-1';
      const originalName = db.prepare('SELECT name FROM students WHERE id = ?').get(studentId) as any;
      
      // Update only roll_number, name should remain
      db.prepare('UPDATE students SET roll_number = ? WHERE id = ?').run('888', studentId);

      const result = db.prepare('SELECT name, roll_number FROM students WHERE id = ?').get(studentId) as any;
      
      expect(result.name).toBe(originalName.name); // Unchanged
      expect(result.roll_number).toBe('888'); // Changed
    });
  });

  describe('archive', () => {
    it('should archive a student', () => {
      const studentId = 'student-1';
      
      db.prepare('UPDATE students SET is_archived = 1 WHERE id = ?').run(studentId);

      const result = db.prepare('SELECT is_archived FROM students WHERE id = ?').get(studentId) as any;
      
      expect(result.is_archived).toBe(1);
    });

    it('should keep archived students in database', () => {
      const studentId = 'student-1';
      
      db.prepare('UPDATE students SET is_archived = 1 WHERE id = ?').run(studentId);

      const result = db.prepare('SELECT * FROM students WHERE id = ?').get(studentId);
      
      expect(result).toBeDefined();
    });

    it('should allow unarchiving students', () => {
      const studentId = 'student-1';
      
      // Archive
      db.prepare('UPDATE students SET is_archived = 1 WHERE id = ?').run(studentId);
      
      // Unarchive
      db.prepare('UPDATE students SET is_archived = 0 WHERE id = ?').run(studentId);

      const result = db.prepare('SELECT is_archived FROM students WHERE id = ?').get(studentId) as any;
      
      expect(result.is_archived).toBe(0);
    });
  });

  describe('getBelongsToClass', () => {
    it('should verify student belongs to class', () => {
      const result = db.prepare(`
        SELECT id FROM students WHERE id = ? AND class_id = ?
      `).get('student-1', 'class-1');
      
      expect(result).toBeDefined();
    });

    it('should return undefined for student in different class', () => {
      const result = db.prepare(`
        SELECT id FROM students WHERE id = ? AND class_id = ?
      `).get('student-1', 'class-2');
      
      expect(result).toBeUndefined();
    });

    it('should return undefined for non-existent student', () => {
      const result = db.prepare(`
        SELECT id FROM students WHERE id = ? AND class_id = ?
      `).get('nonexistent', 'class-1');
      
      expect(result).toBeUndefined();
    });
  });

  describe('cascade delete', () => {
    it('should delete students when class is deleted', () => {
      const classId = 'class-1';
      
      // Verify students exist
      const before = db.prepare('SELECT COUNT(*) as count FROM students WHERE class_id = ?').get(classId) as any;
      expect(before.count).toBeGreaterThan(0);
      
      // Delete class
      db.prepare('DELETE FROM classes WHERE id = ?').run(classId);

      // Students should be deleted (CASCADE)
      const after = db.prepare('SELECT COUNT(*) as count FROM students WHERE class_id = ?').get(classId) as any;
      expect(after.count).toBe(0);
    });
  });

  describe('data validation', () => {
    it('should require name field', () => {
      expect(() => {
        db.prepare(`
          INSERT INTO students (id, class_id, roll_number, is_flagged)
          VALUES (?, ?, ?, ?)
        `).run('student-no-name', 'class-1', '999', 0);
      }).toThrow(); // Should fail NOT NULL constraint
    });

    it('should require roll_number field', () => {
      expect(() => {
        db.prepare(`
          INSERT INTO students (id, class_id, name, is_flagged)
          VALUES (?, ?, ?, ?)
        `).run('student-no-roll', 'class-1', 'No Roll', 0);
      }).toThrow(); // Should fail NOT NULL constraint
    });

    it('should handle long names', () => {
      const longName = 'A'.repeat(100);
      
      db.prepare(`
        INSERT INTO students (id, class_id, name, roll_number, is_flagged)
        VALUES (?, ?, ?, ?, ?)
      `).run('student-long', 'class-1', longName, '999', 0);

      const result = db.prepare('SELECT name FROM students WHERE id = ?').get('student-long') as any;
      
      expect(result.name).toBe(longName);
    });

    it('should handle special characters in names', () => {
      const specialName = "O'Brien-Smith";
      
      db.prepare(`
        INSERT INTO students (id, class_id, name, roll_number, is_flagged)
        VALUES (?, ?, ?, ?, ?)
      `).run('student-special', 'class-1', specialName, '999', 0);

      const result = db.prepare('SELECT name FROM students WHERE id = ?').get('student-special') as any;
      
      expect(result.name).toBe(specialName);
    });
  });
});
