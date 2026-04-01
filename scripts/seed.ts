import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import path from 'path';
import fs from 'fs';

const DB_FILE = path.join(process.cwd(), 'database.sqlite');

// Sample data
const SAMPLE_TEACHERS = [
  { username: 'demo', password: 'demo123', name: 'Demo Teacher' },
  { username: 'john.doe', password: 'teacher123', name: 'John Doe' },
];

const SAMPLE_CLASSES = [
  { id: 'class_1', name: 'Grade 5A' },
  { id: 'class_2', name: 'Grade 5B' },
];

const SAMPLE_STUDENTS_5A = [
  { name: 'Alice Anderson', roll_number: '501' },
  { name: 'Bob Brown', roll_number: '502' },
  { name: 'Charlie Chen', roll_number: '503' },
  { name: 'Diana Davis', roll_number: '504' },
  { name: 'Eve Evans', roll_number: '505' },
  { name: 'Frank Foster', roll_number: '506' },
  { name: 'Grace Green', roll_number: '507' },
  { name: 'Henry Harris', roll_number: '508' },
  { name: 'Ivy Irving', roll_number: '509' },
  { name: 'Jack Johnson', roll_number: '510' },
];

const SAMPLE_STUDENTS_5B = [
  { name: 'Karen King', roll_number: '520' },
  { name: 'Leo Lewis', roll_number: '521' },
  { name: 'Mary Miller', roll_number: '522' },
  { name: 'Noah Nelson', roll_number: '523' },
  { name: 'Olivia Owens', roll_number: '524' },
];

const SAMPLE_TIMETABLE = [
  { day_of_week: 1, start_time: '08:00', end_time: '09:00', subject: 'Math', lesson: 'Algebra Basics' },
  { day_of_week: 1, start_time: '09:00', end_time: '10:00', subject: 'English', lesson: 'Reading Comprehension' },
  { day_of_week: 1, start_time: '10:30', end_time: '11:30', subject: 'Science', lesson: 'Introduction to Plants' },
  { day_of_week: 2, start_time: '08:00', end_time: '09:00', subject: 'English', lesson: 'Grammar Review' },
  { day_of_week: 2, start_time: '09:00', end_time: '10:00', subject: 'Math', lesson: 'Fractions' },
  { day_of_week: 2, start_time: '10:30', end_time: '11:30', subject: 'Art', lesson: 'Watercolor Techniques' },
  { day_of_week: 3, start_time: '08:00', end_time: '09:00', subject: 'Science', lesson: 'The Solar System' },
  { day_of_week: 3, start_time: '09:00', end_time: '10:00', subject: 'Math', lesson: 'Geometry Shapes' },
  { day_of_week: 3, start_time: '10:30', end_time: '11:30', subject: 'PE', lesson: 'Team Sports' },
  { day_of_week: 4, start_time: '08:00', end_time: '09:00', subject: 'History', lesson: 'Ancient Civilizations' },
  { day_of_week: 4, start_time: '09:00', end_time: '10:00', subject: 'English', lesson: 'Creative Writing' },
  { day_of_week: 4, start_time: '10:30', end_time: '11:30', subject: 'Math', lesson: 'Word Problems' },
  { day_of_week: 5, start_time: '08:00', end_time: '09:00', subject: 'Music', lesson: 'Introduction to Rhythm' },
  { day_of_week: 5, start_time: '09:00', end_time: '10:00', subject: 'Science', lesson: 'Experiments' },
  { day_of_week: 5, start_time: '10:30', end_time: '11:30', subject: 'English', lesson: 'Spelling Test' },
];

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function getRecentDates(days: number): string[] {
  const dates: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

async function seed() {
  console.log('[SEED] Seeding database...\n');

  if (!fs.existsSync(DB_FILE)) {
    console.error('[SEED] Database not found. Please run the app first to initialize the database.');
    process.exit(1);
  }

  const db = new Database(DB_FILE);
  db.pragma('foreign_keys = ON');

  // Clear existing sample data (keep admin user)
  console.log('Clearing existing sample data...');
  db.prepare("DELETE FROM class_teachers WHERE class_id LIKE 'class_%'").run();
  db.prepare("DELETE FROM timetable_slots WHERE class_id LIKE 'class_%'").run();
  db.prepare("DELETE FROM attendance_records WHERE student_id LIKE 'student_%'").run();
  db.prepare("DELETE FROM students WHERE id LIKE 'student_%'").run();
  db.prepare("DELETE FROM events WHERE class_id LIKE 'class_%'").run();
  db.prepare("DELETE FROM classes WHERE id LIKE 'class_%'").run();
  db.prepare("DELETE FROM teachers WHERE id LIKE 'teacher_%'").run();

  // Insert teachers
  console.log('Creating teachers...');
  for (const teacher of SAMPLE_TEACHERS) {
    const id = generateId('teacher');
    const hash = bcrypt.hashSync(teacher.password, 10);
    db.prepare('INSERT INTO teachers (id, username, password_hash, name) VALUES (?, ?, ?, ?)')
      .run(id, teacher.username, hash, teacher.name);
    console.log(`  ✓ ${teacher.name} (${teacher.username})`);
  }

  // Get demo teacher ID
  const demoTeacher = db.prepare("SELECT id FROM teachers WHERE username = 'demo'").get() as { id: string };
  const demoTeacherId = demoTeacher?.id;

  if (!demoTeacherId) {
    console.error('[SEED] Failed to create demo teacher');
    process.exit(1);
  }

  // Insert classes
  console.log('\nCreating classes...');
  for (const cls of SAMPLE_CLASSES) {
    db.prepare('INSERT INTO classes (id, teacher_id, name) VALUES (?, ?, ?)')
      .run(cls.id, demoTeacherId, cls.name);
    db.prepare("INSERT INTO class_teachers (class_id, teacher_id, role) VALUES (?, ?, 'owner')")
      .run(cls.id, demoTeacherId);
    console.log(`  ✓ ${cls.name}`);
  }

  // Insert students for 5A
  console.log('\nAdding students to Grade 5A...');
  for (const student of SAMPLE_STUDENTS_5A) {
    const id = generateId('student');
    db.prepare('INSERT INTO students (id, class_id, name, roll_number, parent_name, parent_phone, is_flagged) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, 'class_1', student.name, student.roll_number, 'Parent of ' + student.name.split(' ')[0], '555-' + Math.floor(1000 + Math.random() * 9000), 0);
  }
  console.log(`  ✓ ${SAMPLE_STUDENTS_5A.length} students added`);

  // Insert students for 5B
  console.log('\nAdding students to Grade 5B...');
  for (const student of SAMPLE_STUDENTS_5B) {
    const id = generateId('student');
    db.prepare('INSERT INTO students (id, class_id, name, roll_number, parent_name, parent_phone, is_flagged) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, 'class_2', student.name, student.roll_number, 'Parent of ' + student.name.split(' ')[0], '555-' + Math.floor(1000 + Math.random() * 9000), 0);
  }
  console.log(`  ✓ ${SAMPLE_STUDENTS_5B.length} students added`);

  // Flag a couple students
  const flaggedStudents = db.prepare("SELECT id FROM students WHERE class_id = 'class_1' LIMIT 2").all() as { id: string }[];
  for (const student of flaggedStudents) {
    db.prepare('UPDATE students SET is_flagged = 1 WHERE id = ?').run(student.id);
  }
  console.log(`  ✓ 2 students flagged for attention`);

  // Insert timetable
  console.log('\nCreating timetable...');
  for (const slot of SAMPLE_TIMETABLE) {
    const id = generateId('slot');
    db.prepare('INSERT INTO timetable_slots (id, class_id, day_of_week, start_time, end_time, subject, lesson) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, 'class_1', slot.day_of_week, slot.start_time, slot.end_time, slot.subject, slot.lesson);
  }
  console.log(`  ✓ ${SAMPLE_TIMETABLE.length} timetable slots created`);

  // Add some attendance records
  console.log('\nGenerating attendance records...');
  const students = db.prepare("SELECT id FROM students WHERE class_id = 'class_1'").all() as { id: string }[];
  const dates = getRecentDates(5);
  const statuses = ['present', 'present', 'present', 'absent', 'sick', 'late'];

  for (const date of dates) {
    for (const student of students) {
      if (Math.random() > 0.9) continue; // Skip some students randomly
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const reason = status !== 'present' ? 'Sample reason' : null;
      db.prepare('INSERT OR REPLACE INTO attendance_records (student_id, class_id, date, status, reason) VALUES (?, ?, ?, ?, ?)')
        .run(student.id, 'class_1', date, status, reason);
    }
  }
  console.log(`  ✓ Attendance records for last 5 days`);

  // Add some events
  console.log('\nAdding events...');
  const today = new Date();
  const events = [
    { title: 'Parent-Teacher Meeting', type: 'meeting', days: 3 },
    { title: 'Science Quiz', type: 'test', days: 5 },
    { title: 'Field Trip', type: 'event', days: 10 },
    { title: 'Math Midterm', type: 'exam', days: 14 },
  ];

  for (const evt of events) {
    const date = new Date(today);
    date.setDate(date.getDate() + evt.days);
    const id = generateId('event');
    db.prepare('INSERT INTO events (id, class_id, date, title, type, description) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, 'class_1', date.toISOString().split('T')[0], evt.title, evt.type, `Sample ${evt.type} event`);
  }
  console.log(`  ✓ ${events.length} events scheduled`);

  db.close();

  console.log('\n[SEED] Seeding complete!');
  console.log('\nLogin with:');
  console.log('  Username: demo');
  console.log('  Password: demo123');
  console.log('\nOr use the default admin account:');
  console.log('  Username: admin');
  console.log('  Password: teacher123');
}

seed().catch((err) => {
  console.error('[SEED] Seed failed:', err);
  process.exit(1);
});
