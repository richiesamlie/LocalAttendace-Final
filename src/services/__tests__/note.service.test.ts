import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createMockDb, seedMockData } from '../../test/mocks/db';

/**
 * Note Service Tests
 * 
 * Tests for daily notes management.
 */

describe('Note Service', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createMockDb();
    seedMockData(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('getByClass', () => {
    it('should retrieve all notes for a class', () => {
      const classId = 'class-1';
      
      // Insert test notes
      db.prepare('INSERT INTO daily_notes (class_id, date, note) VALUES (?, ?, ?)').run(
        classId, '2024-01-15', 'Test note 1'
      );
      db.prepare('INSERT INTO daily_notes (class_id, date, note) VALUES (?, ?, ?)').run(
        classId, '2024-01-16', 'Test note 2'
      );

      const results = db.prepare('SELECT date, note FROM daily_notes WHERE class_id = ?').all(classId);
      
      expect(results).toHaveLength(2);
    });

    it('should return empty array for class with no notes', () => {
      const results = db.prepare('SELECT * FROM daily_notes WHERE class_id = ?').all('class-empty');
      
      expect(results).toHaveLength(0);
    });
  });

  describe('upsert', () => {
    it('should insert a new note', () => {
      const classId = 'class-1';
      const date = '2024-01-15';
      const note = 'New daily note';
      
      db.prepare('INSERT INTO daily_notes (class_id, date, note) VALUES (?, ?, ?)').run(
        classId, date, note
      );

      const result = db.prepare('SELECT * FROM daily_notes WHERE class_id = ? AND date = ?').get(classId, date) as any;
      
      expect(result).toBeDefined();
      expect(result.note).toBe(note);
    });

    it('should update existing note (upsert behavior)', () => {
      const classId = 'class-1';
      const date = '2024-01-15';
      
      // Insert initial note
      db.prepare('INSERT INTO daily_notes (class_id, date, note) VALUES (?, ?, ?)').run(
        classId, date, 'Original note'
      );
      
      // Update the same note
      db.prepare(`
        INSERT INTO daily_notes (class_id, date, note) 
        VALUES (?, ?, ?)
        ON CONFLICT (class_id, date) DO UPDATE SET note = excluded.note
      `).run(classId, date, 'Updated note');

      const result = db.prepare('SELECT note FROM daily_notes WHERE class_id = ? AND date = ?').get(classId, date) as any;
      
      expect(result.note).toBe('Updated note');
    });

    it('should enforce foreign key constraint for class_id', () => {
      expect(() => {
        db.prepare('INSERT INTO daily_notes (class_id, date, note) VALUES (?, ?, ?)').run(
          'nonexistent-class', '2024-01-15', 'Note'
        );
      }).toThrow(); // Should violate FOREIGN KEY constraint
    });

    it('should enforce unique (class_id, date) constraint', () => {
      const classId = 'class-1';
      const date = '2024-01-15';
      
      // Insert first note
      db.prepare('INSERT INTO daily_notes (class_id, date, note) VALUES (?, ?, ?)').run(
        classId, date, 'Note 1'
      );
      
      // Attempt duplicate insert (without upsert)
      expect(() => {
        db.prepare('INSERT INTO daily_notes (class_id, date, note) VALUES (?, ?, ?)').run(
          classId, date, 'Note 2'
        );
      }).toThrow(); // Should violate UNIQUE constraint
    });

    it('should handle long notes', () => {
      const longNote = 'A'.repeat(2000);
      
      db.prepare('INSERT INTO daily_notes (class_id, date, note) VALUES (?, ?, ?)').run(
        'class-1', '2024-01-15', longNote
      );

      const result = db.prepare('SELECT note FROM daily_notes WHERE class_id = ? AND date = ?').get(
        'class-1', '2024-01-15'
      ) as any;
      
      expect(result.note).toBe(longNote);
    });

    it('should handle special characters in notes', () => {
      const specialNote = "Test note with 'quotes' and \"double quotes\" and line\nbreaks";
      
      db.prepare('INSERT INTO daily_notes (class_id, date, note) VALUES (?, ?, ?)').run(
        'class-1', '2024-01-15', specialNote
      );

      const result = db.prepare('SELECT note FROM daily_notes WHERE class_id = ? AND date = ?').get(
        'class-1', '2024-01-15'
      ) as any;
      
      expect(result.note).toBe(specialNote);
    });

    it('should allow different notes for different classes on same date', () => {
      const date = '2024-01-15';
      
      db.prepare('INSERT INTO daily_notes (class_id, date, note) VALUES (?, ?, ?)').run(
        'class-1', date, 'Class 1 note'
      );
      db.prepare('INSERT INTO daily_notes (class_id, date, note) VALUES (?, ?, ?)').run(
        'class-2', date, 'Class 2 note'
      );

      const results = db.prepare('SELECT * FROM daily_notes WHERE date = ?').all(date);
      
      expect(results).toHaveLength(2);
    });
  });

  describe('cascade delete', () => {
    it('should delete notes when class is deleted', () => {
      const classId = 'class-1';
      
      // Insert note
      db.prepare('INSERT INTO daily_notes (class_id, date, note) VALUES (?, ?, ?)').run(
        classId, '2024-01-15', 'Test note'
      );
      
      // Verify note exists
      const before = db.prepare('SELECT COUNT(*) as count FROM daily_notes WHERE class_id = ?').get(classId) as any;
      expect(before.count).toBe(1);
      
      // Delete class
      db.prepare('DELETE FROM classes WHERE id = ?').run(classId);

      // Notes should be deleted (CASCADE)
      const after = db.prepare('SELECT COUNT(*) as count FROM daily_notes WHERE class_id = ?').get(classId) as any;
      expect(after.count).toBe(0);
    });
  });

  describe('data integrity', () => {
    it('should require class_id', () => {
      expect(() => {
        db.prepare('INSERT INTO daily_notes (date, note) VALUES (?, ?)').run(
          '2024-01-15', 'Note'
        );
      }).toThrow(); // Should fail NOT NULL constraint
    });

    it('should require date', () => {
      expect(() => {
        db.prepare('INSERT INTO daily_notes (class_id, note) VALUES (?, ?)').run(
          'class-1', 'Note'
        );
      }).toThrow(); // Should fail NOT NULL constraint
    });

    it('should require note', () => {
      expect(() => {
        db.prepare('INSERT INTO daily_notes (class_id, date) VALUES (?, ?)').run(
          'class-1', '2024-01-15'
        );
      }).toThrow(); // Should fail NOT NULL constraint
    });

    it('should store date in correct format', () => {
      const date = '2024-01-15';
      
      db.prepare('INSERT INTO daily_notes (class_id, date, note) VALUES (?, ?, ?)').run(
        'class-1', date, 'Note'
      );

      const result = db.prepare('SELECT date FROM daily_notes WHERE class_id = ? AND date = ?').get(
        'class-1', date
      ) as any;
      
      expect(result.date).toBe(date);
    });
  });

  describe('query patterns', () => {
    it('should support date range queries', () => {
      const classId = 'class-1';
      
      db.prepare('INSERT INTO daily_notes (class_id, date, note) VALUES (?, ?, ?)').run(
        classId, '2024-01-15', 'Note 1'
      );
      db.prepare('INSERT INTO daily_notes (class_id, date, note) VALUES (?, ?, ?)').run(
        classId, '2024-01-16', 'Note 2'
      );
      db.prepare('INSERT INTO daily_notes (class_id, date, note) VALUES (?, ?, ?)').run(
        classId, '2024-01-17', 'Note 3'
      );

      const results = db.prepare(`
        SELECT COUNT(*) as count FROM daily_notes 
        WHERE class_id = ? AND date BETWEEN ? AND ?
      `).get(classId, '2024-01-15', '2024-01-16') as any;
      
      expect(results.count).toBe(2);
    });

    it('should support ordering by date', () => {
      const classId = 'class-1';
      
      db.prepare('INSERT INTO daily_notes (class_id, date, note) VALUES (?, ?, ?)').run(
        classId, '2024-01-16', 'Note 2'
      );
      db.prepare('INSERT INTO daily_notes (class_id, date, note) VALUES (?, ?, ?)').run(
        classId, '2024-01-15', 'Note 1'
      );

      const results = db.prepare(`
        SELECT date FROM daily_notes WHERE class_id = ? ORDER BY date ASC
      `).all(classId) as any[];
      
      expect(results[0].date).toBe('2024-01-15');
      expect(results[1].date).toBe('2024-01-16');
    });

    it('should support searching notes by keyword', () => {
      const classId = 'class-1';
      
      db.prepare('INSERT INTO daily_notes (class_id, date, note) VALUES (?, ?, ?)').run(
        classId, '2024-01-15', 'Math test today'
      );
      db.prepare('INSERT INTO daily_notes (class_id, date, note) VALUES (?, ?, ?)').run(
        classId, '2024-01-16', 'Science project due'
      );

      const results = db.prepare(`
        SELECT * FROM daily_notes WHERE class_id = ? AND note LIKE ?
      `).all(classId, '%test%');
      
      expect(results).toHaveLength(1);
    });
  });
});
