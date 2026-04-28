import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createMockDb, seedMockData } from '../../test/mocks/db';

/**
 * Event Service Tests
 * 
 * Tests for calendar event management.
 */

describe('Event Service', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createMockDb();
    seedMockData(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('getByClass', () => {
    it('should retrieve all events for a class', () => {
      const classId = 'class-1';
      
      // Insert test events
      db.prepare('INSERT INTO events (id, class_id, date, title, type, description) VALUES (?, ?, ?, ?, ?, ?)').run(
        'event-1', classId, '2024-01-15', 'Math Test', 'test', 'Chapter 1-3'
      );
      db.prepare('INSERT INTO events (id, class_id, date, title, type, description) VALUES (?, ?, ?, ?, ?, ?)').run(
        'event-2', classId, '2024-01-20', 'Field Trip', 'trip', 'Science Museum'
      );

      const results = db.prepare('SELECT id, class_id, date, title, type, description FROM events WHERE class_id = ? ORDER BY date DESC').all(classId);
      
      expect(results).toHaveLength(2);
    });

    it('should return empty array for class with no events', () => {
      const results = db.prepare('SELECT * FROM events WHERE class_id = ?').all('class-empty');
      
      expect(results).toHaveLength(0);
    });

    it('should order events by date DESC', () => {
      const classId = 'class-1';
      
      db.prepare('INSERT INTO events (id, class_id, date, title, type) VALUES (?, ?, ?, ?, ?)').run(
        'event-old', classId, '2024-01-15', 'Old Event', 'test'
      );
      db.prepare('INSERT INTO events (id, class_id, date, title, type) VALUES (?, ?, ?, ?, ?)').run(
        'event-new', classId, '2024-01-20', 'New Event', 'test'
      );

      const results = db.prepare('SELECT id FROM events WHERE class_id = ? ORDER BY date DESC').all(classId) as any[];
      
      expect(results[0].id).toBe('event-new');
      expect(results[1].id).toBe('event-old');
    });
  });

  describe('getById', () => {
    it('should retrieve event by ID with authorization', () => {
      const eventId = 'event-test';
      const classId = 'class-1';
      const teacherId = 'teacher-1';
      
      db.prepare('INSERT INTO events (id, class_id, date, title, type) VALUES (?, ?, ?, ?, ?)').run(
        eventId, classId, '2024-01-15', 'Test Event', 'test'
      );

      const result = db.prepare(`
        SELECT e.id, e.class_id 
        FROM events e 
        JOIN class_teachers ct ON e.class_id = ct.class_id 
        WHERE e.id = ? AND ct.teacher_id = ?
      `).get(eventId, teacherId);
      
      expect(result).toBeDefined();
    });

    it('should return undefined for unauthorized teacher', () => {
      const eventId = 'event-test';
      
      db.prepare('INSERT INTO events (id, class_id, date, title, type) VALUES (?, ?, ?, ?, ?)').run(
        eventId, 'class-1', '2024-01-15', 'Test Event', 'test'
      );

      const result = db.prepare(`
        SELECT e.id 
        FROM events e 
        JOIN class_teachers ct ON e.class_id = ct.class_id 
        WHERE e.id = ? AND ct.teacher_id = ?
      `).get(eventId, 'teacher-3');
      
      expect(result).toBeUndefined();
    });

    it('should return undefined for non-existent event', () => {
      const result = db.prepare(`
        SELECT e.id 
        FROM events e 
        JOIN class_teachers ct ON e.class_id = ct.class_id 
        WHERE e.id = ? AND ct.teacher_id = ?
      `).get('nonexistent', 'teacher-1');
      
      expect(result).toBeUndefined();
    });
  });

  describe('insert', () => {
    it('should create a new event', () => {
      const eventId = 'event-new';
      const classId = 'class-1';
      
      db.prepare('INSERT INTO events (id, class_id, date, title, type, description) VALUES (?, ?, ?, ?, ?, ?)').run(
        eventId, classId, '2024-01-15', 'New Event', 'test', 'Description'
      );

      const result = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId) as any;
      
      expect(result).toBeDefined();
      expect(result.id).toBe(eventId);
      expect(result.title).toBe('New Event');
      expect(result.type).toBe('test');
    });

    it('should create event with null description', () => {
      db.prepare('INSERT INTO events (id, class_id, date, title, type, description) VALUES (?, ?, ?, ?, ?, ?)').run(
        'event-null', 'class-1', '2024-01-15', 'Event', 'test', null
      );

      const result = db.prepare('SELECT description FROM events WHERE id = ?').get('event-null') as any;
      
      expect(result.description).toBeNull();
    });

    it('should enforce foreign key constraint for class_id', () => {
      expect(() => {
        db.prepare('INSERT INTO events (id, class_id, date, title, type) VALUES (?, ?, ?, ?, ?)').run(
          'event-invalid', 'nonexistent-class', '2024-01-15', 'Event', 'test'
        );
      }).toThrow(); // Should violate FOREIGN KEY constraint
    });

    it('should enforce unique event IDs', () => {
      const eventId = 'event-duplicate';
      
      db.prepare('INSERT INTO events (id, class_id, date, title, type) VALUES (?, ?, ?, ?, ?)').run(
        eventId, 'class-1', '2024-01-15', 'Event 1', 'test'
      );
      
      expect(() => {
        db.prepare('INSERT INTO events (id, class_id, date, title, type) VALUES (?, ?, ?, ?, ?)').run(
          eventId, 'class-1', '2024-01-16', 'Event 2', 'assignment'
        );
      }).toThrow(); // Should violate PRIMARY KEY constraint
    });

    it('should support different event types', () => {
      const types = ['test', 'assignment', 'trip', 'holiday', 'meeting'];
      
      types.forEach((type, idx) => {
        db.prepare('INSERT INTO events (id, class_id, date, title, type) VALUES (?, ?, ?, ?, ?)').run(
          `event-${type}`, 'class-1', `2024-01-${15 + idx}`, `Event ${type}`, type
        );
      });

      const results = db.prepare('SELECT DISTINCT type FROM events ORDER BY type').all() as any[];
      
      expect(results.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('update', () => {
    it('should update event title', () => {
      const eventId = 'event-update';
      
      db.prepare('INSERT INTO events (id, class_id, date, title, type) VALUES (?, ?, ?, ?, ?)').run(
        eventId, 'class-1', '2024-01-15', 'Original Title', 'test'
      );
      
      db.prepare('UPDATE events SET title = ? WHERE id = ?').run('Updated Title', eventId);

      const result = db.prepare('SELECT title FROM events WHERE id = ?').get(eventId) as any;
      
      expect(result.title).toBe('Updated Title');
    });

    it('should update event date', () => {
      const eventId = 'event-update-date';
      
      db.prepare('INSERT INTO events (id, class_id, date, title, type) VALUES (?, ?, ?, ?, ?)').run(
        eventId, 'class-1', '2024-01-15', 'Event', 'test'
      );
      
      db.prepare('UPDATE events SET date = ? WHERE id = ?').run('2024-01-20', eventId);

      const result = db.prepare('SELECT date FROM events WHERE id = ?').get(eventId) as any;
      
      expect(result.date).toBe('2024-01-20');
    });

    it('should update event type', () => {
      const eventId = 'event-update-type';
      
      db.prepare('INSERT INTO events (id, class_id, date, title, type) VALUES (?, ?, ?, ?, ?)').run(
        eventId, 'class-1', '2024-01-15', 'Event', 'test'
      );
      
      db.prepare('UPDATE events SET type = ? WHERE id = ?').run('assignment', eventId);

      const result = db.prepare('SELECT type FROM events WHERE id = ?').get(eventId) as any;
      
      expect(result.type).toBe('assignment');
    });

    it('should update event description', () => {
      const eventId = 'event-update-desc';
      
      db.prepare('INSERT INTO events (id, class_id, date, title, type, description) VALUES (?, ?, ?, ?, ?, ?)').run(
        eventId, 'class-1', '2024-01-15', 'Event', 'test', 'Original'
      );
      
      db.prepare('UPDATE events SET description = ? WHERE id = ?').run('Updated description', eventId);

      const result = db.prepare('SELECT description FROM events WHERE id = ?').get(eventId) as any;
      
      expect(result.description).toBe('Updated description');
    });

    it('should respect authorization on update', () => {
      const eventId = 'event-auth';
      const classId = 'class-1';
      
      db.prepare('INSERT INTO events (id, class_id, date, title, type) VALUES (?, ?, ?, ?, ?)').run(
        eventId, classId, '2024-01-15', 'Event', 'test'
      );

      // Update should only work if teacher has access to the class
      const result = db.prepare(`
        UPDATE events 
        SET title = ? 
        WHERE id = ? AND class_id IN (SELECT class_id FROM class_teachers WHERE teacher_id = ?)
      `).run('New Title', eventId, 'teacher-1');
      
      expect(result.changes).toBe(1);
    });
  });

  describe('delete', () => {
    it('should delete an event', () => {
      const eventId = 'event-delete';
      
      db.prepare('INSERT INTO events (id, class_id, date, title, type) VALUES (?, ?, ?, ?, ?)').run(
        eventId, 'class-1', '2024-01-15', 'Event', 'test'
      );
      
      db.prepare('DELETE FROM events WHERE id = ?').run(eventId);

      const result = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
      
      expect(result).toBeUndefined();
    });

    it('should respect authorization on delete', () => {
      const eventId = 'event-auth-delete';
      
      db.prepare('INSERT INTO events (id, class_id, date, title, type) VALUES (?, ?, ?, ?, ?)').run(
        eventId, 'class-1', '2024-01-15', 'Event', 'test'
      );

      // Delete should only work if teacher has access to the class
      const result = db.prepare(`
        DELETE FROM events 
        WHERE id = ? AND class_id IN (SELECT class_id FROM class_teachers WHERE teacher_id = ?)
      `).run(eventId, 'teacher-1');
      
      expect(result.changes).toBe(1);
    });

    it('should not allow unauthorized teacher to delete', () => {
      const eventId = 'event-unauth-delete';
      
      db.prepare('INSERT INTO events (id, class_id, date, title, type) VALUES (?, ?, ?, ?, ?)').run(
        eventId, 'class-1', '2024-01-15', 'Event', 'test'
      );

      const result = db.prepare(`
        DELETE FROM events 
        WHERE id = ? AND class_id IN (SELECT class_id FROM class_teachers WHERE teacher_id = ?)
      `).run(eventId, 'teacher-3');
      
      expect(result.changes).toBe(0);
    });
  });

  describe('cascade delete', () => {
    it('should delete events when class is deleted', () => {
      const classId = 'class-1';
      
      // Insert event
      db.prepare('INSERT INTO events (id, class_id, date, title, type) VALUES (?, ?, ?, ?, ?)').run(
        'event-cascade', classId, '2024-01-15', 'Event', 'test'
      );
      
      // Verify event exists
      const before = db.prepare('SELECT COUNT(*) as count FROM events WHERE class_id = ?').get(classId) as any;
      expect(before.count).toBe(1);
      
      // Delete class
      db.prepare('DELETE FROM classes WHERE id = ?').run(classId);

      // Events should be deleted (CASCADE)
      const after = db.prepare('SELECT COUNT(*) as count FROM events WHERE class_id = ?').get(classId) as any;
      expect(after.count).toBe(0);
    });
  });

  describe('data integrity', () => {
    it('should require class_id', () => {
      expect(() => {
        db.prepare('INSERT INTO events (id, date, title, type) VALUES (?, ?, ?, ?)').run(
          'event-no-class', '2024-01-15', 'Event', 'test'
        );
      }).toThrow(); // Should fail NOT NULL constraint
    });

    it('should require date', () => {
      expect(() => {
        db.prepare('INSERT INTO events (id, class_id, title, type) VALUES (?, ?, ?, ?)').run(
          'event-no-date', 'class-1', 'Event', 'test'
        );
      }).toThrow(); // Should fail NOT NULL constraint
    });

    it('should require title', () => {
      expect(() => {
        db.prepare('INSERT INTO events (id, class_id, date, type) VALUES (?, ?, ?, ?)').run(
          'event-no-title', 'class-1', '2024-01-15', 'test'
        );
      }).toThrow(); // Should fail NOT NULL constraint
    });

    it('should require type', () => {
      expect(() => {
        db.prepare('INSERT INTO events (id, class_id, date, title) VALUES (?, ?, ?, ?)').run(
          'event-no-type', 'class-1', '2024-01-15', 'Event'
        );
      }).toThrow(); // Should fail NOT NULL constraint
    });

    it('should handle long titles', () => {
      const longTitle = 'A'.repeat(200);
      
      db.prepare('INSERT INTO events (id, class_id, date, title, type) VALUES (?, ?, ?, ?, ?)').run(
        'event-long', 'class-1', '2024-01-15', longTitle, 'test'
      );

      const result = db.prepare('SELECT title FROM events WHERE id = ?').get('event-long') as any;
      
      expect(result.title).toBe(longTitle);
    });

    it('should handle long descriptions', () => {
      const longDesc = 'A'.repeat(1000);
      
      db.prepare('INSERT INTO events (id, class_id, date, title, type, description) VALUES (?, ?, ?, ?, ?, ?)').run(
        'event-long-desc', 'class-1', '2024-01-15', 'Event', 'test', longDesc
      );

      const result = db.prepare('SELECT description FROM events WHERE id = ?').get('event-long-desc') as any;
      
      expect(result.description).toBe(longDesc);
    });

    it('should handle special characters', () => {
      const specialTitle = "Test's \"Event\" with line\nbreaks";
      
      db.prepare('INSERT INTO events (id, class_id, date, title, type) VALUES (?, ?, ?, ?, ?)').run(
        'event-special', 'class-1', '2024-01-15', specialTitle, 'test'
      );

      const result = db.prepare('SELECT title FROM events WHERE id = ?').get('event-special') as any;
      
      expect(result.title).toBe(specialTitle);
    });
  });

  describe('query patterns', () => {
    it('should support date range queries', () => {
      const classId = 'class-1';
      
      db.prepare('INSERT INTO events (id, class_id, date, title, type) VALUES (?, ?, ?, ?, ?)').run(
        'event-1', classId, '2024-01-15', 'Event 1', 'test'
      );
      db.prepare('INSERT INTO events (id, class_id, date, title, type) VALUES (?, ?, ?, ?, ?)').run(
        'event-2', classId, '2024-01-16', 'Event 2', 'test'
      );
      db.prepare('INSERT INTO events (id, class_id, date, title, type) VALUES (?, ?, ?, ?, ?)').run(
        'event-3', classId, '2024-01-20', 'Event 3', 'test'
      );

      const results = db.prepare(`
        SELECT COUNT(*) as count FROM events 
        WHERE class_id = ? AND date BETWEEN ? AND ?
      `).get(classId, '2024-01-15', '2024-01-17') as any;
      
      expect(results.count).toBe(2);
    });

    it('should support filtering by event type', () => {
      const classId = 'class-1';
      
      db.prepare('INSERT INTO events (id, class_id, date, title, type) VALUES (?, ?, ?, ?, ?)').run(
        'event-test', classId, '2024-01-15', 'Test', 'test'
      );
      db.prepare('INSERT INTO events (id, class_id, date, title, type) VALUES (?, ?, ?, ?, ?)').run(
        'event-trip', classId, '2024-01-16', 'Trip', 'trip'
      );

      const results = db.prepare('SELECT COUNT(*) as count FROM events WHERE class_id = ? AND type = ?').get(
        classId, 'test'
      ) as any;
      
      expect(results.count).toBe(1);
    });

    it('should support searching events by keyword', () => {
      const classId = 'class-1';
      
      db.prepare('INSERT INTO events (id, class_id, date, title, type) VALUES (?, ?, ?, ?, ?)').run(
        'event-math', classId, '2024-01-15', 'Math Test Chapter 5', 'test'
      );
      db.prepare('INSERT INTO events (id, class_id, date, title, type) VALUES (?, ?, ?, ?, ?)').run(
        'event-science', classId, '2024-01-16', 'Science Project', 'assignment'
      );

      const results = db.prepare(`
        SELECT * FROM events WHERE class_id = ? AND title LIKE ?
      `).all(classId, '%Math%');
      
      expect(results).toHaveLength(1);
    });

    it('should support upcoming events query', () => {
      const classId = 'class-1';
      const today = '2024-01-16';
      
      db.prepare('INSERT INTO events (id, class_id, date, title, type) VALUES (?, ?, ?, ?, ?)').run(
        'event-past', classId, '2024-01-10', 'Past Event', 'test'
      );
      db.prepare('INSERT INTO events (id, class_id, date, title, type) VALUES (?, ?, ?, ?, ?)').run(
        'event-future', classId, '2024-01-20', 'Future Event', 'test'
      );

      const results = db.prepare(`
        SELECT COUNT(*) as count FROM events WHERE class_id = ? AND date >= ?
      `).get(classId, today) as any;
      
      expect(results.count).toBe(1);
    });
  });
});
