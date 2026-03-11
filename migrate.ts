import fs from 'fs/promises';
import path from 'path';
import db from './db';

const DATA_FILE = path.join(process.cwd(), 'database.json');

async function migrate() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf-8');
    const parsedData = JSON.parse(data);
    
    console.log('Starting migration...');

    // Migrate Admin Settings
    if (parsedData.adminPassword) {
      db.prepare('INSERT OR REPLACE INTO admin_settings (key, value) VALUES (?, ?)')
        .run('adminPassword', parsedData.adminPassword);
    }

    const classes = parsedData.classes || [];

    const insertClass = db.prepare('INSERT OR IGNORE INTO classes (id, name) VALUES (?, ?)');
    const insertStudent = db.prepare('INSERT OR IGNORE INTO students (id, class_id, name, roll_number, parent_name, parent_phone, is_flagged) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const insertRecord = db.prepare('INSERT OR IGNORE INTO attendance_records (student_id, class_id, date, status, reason) VALUES (?, ?, ?, ?, ?)');
    const insertDailyNote = db.prepare('INSERT OR IGNORE INTO daily_notes (class_id, date, note) VALUES (?, ?, ?)');
    const insertEvent = db.prepare('INSERT OR IGNORE INTO events (id, class_id, date, title, type, description) VALUES (?, ?, ?, ?, ?, ?)');
    const insertTimetableSlot = db.prepare('INSERT OR IGNORE INTO timetable_slots (id, class_id, day_of_week, start_time, end_time, subject, lesson) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const insertSeatingLayout = db.prepare('INSERT OR IGNORE INTO seating_layout (class_id, seat_id, student_id) VALUES (?, ?, ?)');

    const transaction = db.transaction(() => {
      for (const cls of classes) {
        // Insert Class
        insertClass.run(cls.id, cls.name);

        // Insert Students
        for (const student of cls.students || []) {
          insertStudent.run(
            student.id,
            cls.id,
            student.name,
            student.rollNumber,
            student.parentName || null,
            student.parentPhone || null,
            student.isFlagged ? 1 : 0
          );
        }

        // Insert Attendance Records
        for (const record of cls.records || []) {
          insertRecord.run(
            record.studentId,
            cls.id,
            record.date,
            record.status,
            record.reason || null
          );
        }

        // Insert Daily Notes
        const notes = cls.dailyNotes || {};
        for (const [date, note] of Object.entries(notes)) {
          insertDailyNote.run(cls.id, date, note as string);
        }

        // Insert Events
        for (const event of cls.events || []) {
          insertEvent.run(
            event.id,
            cls.id,
            event.date,
            event.title,
            event.type,
            event.description || null
          );
        }

        // Insert Timetable Slots
        for (const slot of cls.timetable || []) {
          insertTimetableSlot.run(
            slot.id,
            cls.id,
            slot.dayOfWeek,
            slot.startTime,
            slot.endTime,
            slot.subject,
            slot.lesson
          );
        }

        // Insert Seating Layout
        const layout = cls.seatingLayout || {};
        for (const [seatId, studentId] of Object.entries(layout)) {
          insertSeatingLayout.run(cls.id, seatId, studentId as string);
        }
      }
    });

    transaction();
    console.log('Migration completed successfully!');

  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.log('No database.json found. Skipping migration.');
    } else {
      console.error('Migration failed:', error);
    }
  }
}

migrate();
