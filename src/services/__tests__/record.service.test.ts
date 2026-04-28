import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createMockDb, seedMockData } from '../../test/mocks/db';

/**
 * Record Service Tests
 * 
 * Tests for attendance record operations.
 */

describe('Record Service', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createMockDb();
    seedMockData(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('getByClass', () => {
    it('should retrieve attendance records for a class', () => {
      // Insert test records first
      const classId = 'class-1';
      db.prepare(`
        INSERT INTO attendance_records (student_id, class_id, date, status, reason)
        VALUES (?, ?, ?, ?, ?)
      `).run('student-1', classId, '2024-01-15', 'present', null);
      
      const results = db.prepare(`
        SELECT ar.student_id, ar.date, ar.status, ar.reason 
        FROM attendance_records ar
        JOIN students s ON ar.student_id = s.id
        WHERE s.class_id = ?
        ORDER BY ar.date DESC, s.roll_number
      `).all(classId);
      
      expect(results).toHaveLength(1);
      expect(results[0]).toHaveProperty('student_id', 'student-1');
      expect(results[0]).toHaveProperty('status', 'present');
    });

    it('should return empty array for class with no records', () => {
      // Create new class without records
      db.prepare('INSERT INTO classes (id, teacher_id, name) VALUES (?, ?, ?)').run(
        'class-empty', 'teacher-1', 'Empty Class'
      );
      
      const results = db.prepare(`
        SELECT ar.* FROM attendance_records ar
        JOIN students s ON ar.student_id = s.id
        WHERE s.class_id = ?
      `).all('class-empty');
      
      expect(results).toHaveLength(0);
    });

    it('should order records by date DESC and roll_number', () => {
      const classId = 'class-1';
      
      // Insert multiple records
      db.prepare(`
        INSERT INTO attendance_records (student_id, class_id, date, status)
        VALUES (?, ?, ?, ?)
      `).run('student-1', classId, '2024-01-15', 'present');
      
      db.prepare(`
        INSERT INTO attendance_records (student_id, class_id, date, status)
        VALUES (?, ?, ?, ?)
      `).run('student-2', classId, '2024-01-16', 'absent');
      
      const results = db.prepare(`
        SELECT ar.date, s.roll_number
        FROM attendance_records ar
        JOIN students s ON ar.student_id = s.id
        WHERE s.class_id = ?
        ORDER BY ar.date DESC, s.roll_number
      `).all(classId) as any[];
      
      expect(results).toHaveLength(2);
      expect(results[0].date).toBe('2024-01-16'); // Most recent first
      expect(results[1].date).toBe('2024-01-15');
    });

    it('should include reason field for absences', () => {
      db.prepare(`
        INSERT INTO attendance_records (student_id, class_id, date, status, reason)
        VALUES (?, ?, ?, ?, ?)
      `).run('student-1', 'class-1', '2024-01-15', 'absent', 'Doctor appointment');
      
      const result = db.prepare(`
        SELECT ar.reason FROM attendance_records ar
        WHERE ar.student_id = ? AND ar.date = ?
      `).get('student-1', '2024-01-15') as any;
      
      expect(result.reason).toBe('Doctor appointment');
    });

    it('should handle multiple students with same date', () => {
      const date = '2024-01-15';
      const classId = 'class-1';
      
      db.prepare(`
        INSERT INTO attendance_records (student_id, class_id, date, status)
        VALUES (?, ?, ?, ?)
      `).run('student-1', classId, date, 'present');
      
      db.prepare(`
        INSERT INTO attendance_records (student_id, class_id, date, status)
        VALUES (?, ?, ?, ?)
      `).run('student-2', classId, date, 'absent');
      
      const results = db.prepare(`
        SELECT ar.student_id, ar.status
        FROM attendance_records ar
        JOIN students s ON ar.student_id = s.id
        WHERE s.class_id = ? AND ar.date = ?
        ORDER BY s.roll_number
      `).all('class-1', date);
      
      expect(results).toHaveLength(2);
    });
  });

  describe('insert', () => {
    it('should insert a new attendance record', () => {
      const studentId = 'student-1';
      const classId = 'class-1';
      const date = '2024-01-15';
      const status = 'present';
      
      db.prepare(`
        INSERT INTO attendance_records (student_id, class_id, date, status, reason)
        VALUES (?, ?, ?, ?, ?)
      `).run(studentId, classId, date, status, null);

      const result = db.prepare(`
        SELECT * FROM attendance_records WHERE student_id = ? AND date = ?
      `).get(studentId, date) as any;
      
      expect(result).toBeDefined();
      expect(result.student_id).toBe(studentId);
      expect(result.status).toBe(status);
      expect(result.date).toBe(date);
    });

    it('should insert record with reason for absence', () => {
      const reason = 'Sick leave';
      
      db.prepare(`
        INSERT INTO attendance_records (student_id, class_id, date, status, reason)
        VALUES (?, ?, ?, ?, ?)
      `).run('student-1', 'class-1', '2024-01-15', 'absent', reason);

      const result = db.prepare(`
        SELECT reason FROM attendance_records WHERE student_id = ? AND date = ?
      `).get('student-1', '2024-01-15') as any;
      
      expect(result.reason).toBe(reason);
    });

    it('should update existing record (upsert behavior)', () => {
      const studentId = 'student-1';
      const classId = 'class-1';
      const date = '2024-01-15';
      
      // Insert initial record
      db.prepare(`
        INSERT INTO attendance_records (student_id, class_id, date, status, reason)
        VALUES (?, ?, ?, ?, ?)
      `).run(studentId, classId, date, 'present', null);
      
      // Update the same record (simulating upsert)
      db.prepare(`
        INSERT INTO attendance_records (student_id, class_id, date, status, reason)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (student_id, date) DO UPDATE SET status = excluded.status, reason = excluded.reason
      `).run(studentId, classId, date, 'absent', 'Changed status');

      const result = db.prepare(`
        SELECT status, reason FROM attendance_records WHERE student_id = ? AND date = ?
      `).get(studentId, date) as any;
      
      expect(result.status).toBe('absent');
      expect(result.reason).toBe('Changed status');
    });

    it('should enforce foreign key constraint for student_id', () => {
      expect(() => {
        db.prepare(`
          INSERT INTO attendance_records (student_id, class_id, date, status)
          VALUES (?, ?, ?, ?)
        `).run('nonexistent-student', 'class-1', '2024-01-15', 'present');
      }).toThrow(); // Should violate FOREIGN KEY constraint
    });

    it('should handle all status types', () => {
      const statuses = ['present', 'absent', 'late', 'excused'];
      const classId = 'class-1';
      
      statuses.forEach((status, idx) => {
        db.prepare(`
          INSERT INTO attendance_records (student_id, class_id, date, status)
          VALUES (?, ?, ?, ?)
        `).run('student-1', classId, `2024-01-${15 + idx}`, status);
      });

      const results = db.prepare(`
        SELECT DISTINCT status FROM attendance_records WHERE student_id = ?
        ORDER BY status
      `).all('student-1') as any[];
      
      expect(results).toHaveLength(4);
    });

    it('should store date in correct format', () => {
      const date = '2024-01-15';
      const classId = 'class-1';
      
      db.prepare(`
        INSERT INTO attendance_records (student_id, class_id, date, status)
        VALUES (?, ?, ?, ?)
      `).run('student-1', classId, date, 'present');

      const result = db.prepare(`
        SELECT date FROM attendance_records WHERE student_id = ? AND date = ?
      `).get('student-1', date) as any;
      
      expect(result.date).toBe(date);
    });

    it('should allow null reason', () => {
      db.prepare(`
        INSERT INTO attendance_records (student_id, class_id, date, status, reason)
        VALUES (?, ?, ?, ?, ?)
      `).run('student-1', 'class-1', '2024-01-15', 'present', null);

      const result = db.prepare(`
        SELECT reason FROM attendance_records WHERE student_id = ? AND date = ?
      `).get('student-1', '2024-01-15') as any;
      
      expect(result.reason).toBeNull();
    });
  });

  describe('unique constraint', () => {
    it('should prevent duplicate records for same student and date', () => {
      const studentId = 'student-1';
      const classId = 'class-1';
      const date = '2024-01-15';
      
      // Insert first record
      db.prepare(`
        INSERT INTO attendance_records (student_id, class_id, date, status)
        VALUES (?, ?, ?, ?)
      `).run(studentId, classId, date, 'present');
      
      // Attempt duplicate insert (without upsert)
      expect(() => {
        db.prepare(`
          INSERT INTO attendance_records (student_id, class_id, date, status)
          VALUES (?, ?, ?, ?)
        `).run(studentId, classId, date, 'absent');
      }).toThrow(); // Should violate UNIQUE constraint (student_id, date)
    });
  });

  describe('cascade delete', () => {
    it('should delete records when student is deleted', () => {
      const studentId = 'student-1';
      const classId = 'class-1';
      
      // Insert record
      db.prepare(`
        INSERT INTO attendance_records (student_id, class_id, date, status)
        VALUES (?, ?, ?, ?)
      `).run(studentId, classId, '2024-01-15', 'present');
      
      // Verify record exists
      const before = db.prepare(`
        SELECT COUNT(*) as count FROM attendance_records WHERE student_id = ?
      `).get(studentId) as any;
      expect(before.count).toBe(1);
      
      // Delete student
      db.prepare('DELETE FROM students WHERE id = ?').run(studentId);

      // Records should be deleted (CASCADE)
      const after = db.prepare(`
        SELECT COUNT(*) as count FROM attendance_records WHERE student_id = ?
      `).get(studentId) as any;
      expect(after.count).toBe(0);
    });

    it('should delete records when class is deleted', () => {
      const classId = 'class-1';
      const studentId = 'student-1';
      
      // Insert record
      db.prepare(`
        INSERT INTO attendance_records (student_id, class_id, date, status)
        VALUES (?, ?, ?, ?)
      `).run(studentId, classId, '2024-01-15', 'present');
      
      // Verify record exists
      const before = db.prepare(`
        SELECT COUNT(*) as count FROM attendance_records ar
        JOIN students s ON ar.student_id = s.id
        WHERE s.class_id = ?
      `).get(classId) as any;
      expect(before.count).toBeGreaterThan(0);
      
      // Delete class (should cascade to students, then to records)
      db.prepare('DELETE FROM classes WHERE id = ?').run(classId);

      // Records should be deleted (CASCADE through students)
      const after = db.prepare(`
        SELECT COUNT(*) as count FROM attendance_records WHERE student_id = ?
      `).get(studentId) as any;
      expect(after.count).toBe(0);
    });
  });

  describe('data integrity', () => {
    it('should require student_id', () => {
      expect(() => {
        db.prepare(`
          INSERT INTO attendance_records (class_id, date, status)
          VALUES (?, ?, ?)
        `).run('class-1', '2024-01-15', 'present');
      }).toThrow(); // Should fail NOT NULL constraint
    });

    it('should require date', () => {
      expect(() => {
        db.prepare(`
          INSERT INTO attendance_records (student_id, class_id, status)
          VALUES (?, ?, ?)
        `).run('student-1', 'class-1', 'present');
      }).toThrow(); // Should fail NOT NULL constraint
    });

    it('should require status', () => {
      expect(() => {
        db.prepare(`
          INSERT INTO attendance_records (student_id, class_id, date)
          VALUES (?, ?, ?)
        `).run('student-1', 'class-1', '2024-01-15');
      }).toThrow(); // Should fail NOT NULL constraint
    });

    it('should handle long reason text', () => {
      const longReason = 'A'.repeat(500);
      const classId = 'class-1';
      
      db.prepare(`
        INSERT INTO attendance_records (student_id, class_id, date, status, reason)
        VALUES (?, ?, ?, ?, ?)
      `).run('student-1', classId, '2024-01-15', 'absent', longReason);

      const result = db.prepare(`
        SELECT reason FROM attendance_records WHERE student_id = ? AND date = ?
      `).get('student-1', '2024-01-15') as any;
      
      expect(result.reason).toBe(longReason);
    });
  });

  describe('reporting queries', () => {
    it('should support date range queries', () => {
      const classId = 'class-1';
      // Insert records across multiple dates
      db.prepare(`
        INSERT INTO attendance_records (student_id, class_id, date, status)
        VALUES (?, ?, ?, ?)
      `).run('student-1', classId, '2024-01-15', 'present');
      
      db.prepare(`
        INSERT INTO attendance_records (student_id, class_id, date, status)
        VALUES (?, ?, ?, ?)
      `).run('student-1', classId, '2024-01-16', 'absent');
      
      db.prepare(`
        INSERT INTO attendance_records (student_id, class_id, date, status)
        VALUES (?, ?, ?, ?)
      `).run('student-1', classId, '2024-01-17', 'present');

      const results = db.prepare(`
        SELECT COUNT(*) as count FROM attendance_records 
        WHERE student_id = ? AND date BETWEEN ? AND ?
      `).get('student-1', '2024-01-15', '2024-01-16') as any;
      
      expect(results.count).toBe(2);
    });

    it('should support status-based filtering', () => {
      const classId = 'class-1';
      db.prepare(`
        INSERT INTO attendance_records (student_id, class_id, date, status)
        VALUES (?, ?, ?, ?)
      `).run('student-1', classId, '2024-01-15', 'present');
      
      db.prepare(`
        INSERT INTO attendance_records (student_id, class_id, date, status)
        VALUES (?, ?, ?, ?)
      `).run('student-1', classId, '2024-01-16', 'absent');

      const absentCount = db.prepare(`
        SELECT COUNT(*) as count FROM attendance_records 
        WHERE student_id = ? AND status = ?
      `).get('student-1', 'absent') as any;
      
      expect(absentCount.count).toBe(1);
    });

    it('should support student aggregation by class', () => {
      const date = '2024-01-15';
      const classId = 'class-1';
      
      db.prepare(`
        INSERT INTO attendance_records (student_id, class_id, date, status)
        VALUES (?, ?, ?, ?)
      `).run('student-1', classId, date, 'present');
      
      db.prepare(`
        INSERT INTO attendance_records (student_id, class_id, date, status)
        VALUES (?, ?, ?, ?)
      `).run('student-2', classId, date, 'absent');

      const results = db.prepare(`
        SELECT s.class_id, COUNT(*) as total
        FROM attendance_records ar
        JOIN students s ON ar.student_id = s.id
        WHERE ar.date = ?
        GROUP BY s.class_id
      `).all(date);
      
      expect(results).toHaveLength(1); // All test students are in class-1
    });
  });
});
