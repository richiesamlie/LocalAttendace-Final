import { describe, it, expect } from 'vitest';
import {
  loginSchema,
  classSchema,
  studentSchema,
  attendanceRecordSchema,
  eventSchema,
  timetableSlotSchema,
  teacherSchema,
  settingSchema,
} from '../lib/validation';

describe('loginSchema', () => {
  it('validates valid login credentials', () => {
    const result = loginSchema.safeParse({ username: 'admin', password: 'password123' });
    expect(result.success).toBe(true);
  });

  it('rejects empty username', () => {
    const result = loginSchema.safeParse({ username: '', password: 'password123' });
    expect(result.success).toBe(false);
  });

  it('rejects empty password', () => {
    const result = loginSchema.safeParse({ username: 'admin', password: '' });
    expect(result.success).toBe(false);
  });

  it('trims whitespace from username', () => {
    const result = loginSchema.safeParse({ username: '  admin  ', password: 'password123' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.username).toBe('admin');
    }
  });

  it('strips null bytes', () => {
    const result = loginSchema.safeParse({ username: 'admin\x00', password: 'password123' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.username).toBe('admin');
    }
  });
});

describe('classSchema', () => {
  it('validates valid class data', () => {
    const result = classSchema.safeParse({ id: 'class_123', name: 'Math Class' });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = classSchema.safeParse({ id: 'class_123', name: '' });
    expect(result.success).toBe(false);
  });

  it('trims whitespace from name', () => {
    const result = classSchema.safeParse({ id: 'class_123', name: '  Math Class  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Math Class');
    }
  });
});

describe('studentSchema', () => {
  it('validates valid student data', () => {
    const result = studentSchema.safeParse({
      id: 'student_123',
      name: 'John Doe',
      rollNumber: '001',
    });
    expect(result.success).toBe(true);
  });

  it('applies default isFlagged to false', () => {
    const result = studentSchema.safeParse({
      id: 'student_123',
      name: 'John Doe',
      rollNumber: '001',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isFlagged).toBe(false);
    }
  });

  it('rejects empty name', () => {
    const result = studentSchema.safeParse({
      id: 'student_123',
      name: '',
      rollNumber: '001',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty rollNumber', () => {
    const result = studentSchema.safeParse({
      id: 'student_123',
      name: 'John Doe',
      rollNumber: '',
    });
    expect(result.success).toBe(false);
  });

  it('accepts optional parentName', () => {
    const result = studentSchema.safeParse({
      id: 'student_123',
      name: 'John Doe',
      rollNumber: '001',
      parentName: 'Jane Doe',
    });
    expect(result.success).toBe(true);
  });

  it('accepts null parentName', () => {
    const result = studentSchema.safeParse({
      id: 'student_123',
      name: 'John Doe',
      rollNumber: '001',
      parentName: null,
    });
    expect(result.success).toBe(true);
  });

  it('accepts isFlagged true', () => {
    const result = studentSchema.safeParse({
      id: 'student_123',
      name: 'John Doe',
      rollNumber: '001',
      isFlagged: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isFlagged).toBe(true);
    }
  });
});

describe('attendanceRecordSchema', () => {
  it('validates valid attendance record', () => {
    const result = attendanceRecordSchema.safeParse({
      studentId: 'student_123',
      classId: 'class_123',
      date: '2026-04-22',
      status: 'Present',
    });
    expect(result.success).toBe(true);
  });

  it('accepts optional reason', () => {
    const result = attendanceRecordSchema.safeParse({
      studentId: 'student_123',
      classId: 'class_123',
      date: '2026-04-22',
      status: 'Absent',
      reason: 'Sick day',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid date format', () => {
    const result = attendanceRecordSchema.safeParse({
      studentId: 'student_123',
      classId: 'class_123',
      date: '04-22-2026',
      status: 'Present',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid status', () => {
    const result = attendanceRecordSchema.safeParse({
      studentId: 'student_123',
      classId: 'class_123',
      date: '2026-04-22',
      status: 'InvalidStatus',
    });
    expect(result.success).toBe(false);
  });

  it('accepts all valid statuses', () => {
    const statuses = ['Present', 'Absent', 'Sick', 'Late'];
    for (const status of statuses) {
      const result = attendanceRecordSchema.safeParse({
        studentId: 'student_123',
        classId: 'class_123',
        date: '2026-04-22',
        status,
      });
      expect(result.success).toBe(true);
    }
  });
});

describe('eventSchema', () => {
  it('validates valid event data', () => {
    const result = eventSchema.safeParse({
      id: 'event_123',
      date: '2026-04-22',
      title: 'Math Test',
      type: 'Test',
    });
    expect(result.success).toBe(true);
  });

  it('accepts optional description', () => {
    const result = eventSchema.safeParse({
      id: 'event_123',
      date: '2026-04-22',
      title: 'Math Test',
      type: 'Test',
      description: 'Chapter 5 assessment',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid date format', () => {
    const result = eventSchema.safeParse({
      id: 'event_123',
      date: 'April 22, 2026',
      title: 'Math Test',
      type: 'Test',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid event type', () => {
    const result = eventSchema.safeParse({
      id: 'event_123',
      date: '2026-04-22',
      title: 'Math Test',
      type: 'InvalidType',
    });
    expect(result.success).toBe(false);
  });

  it('accepts all valid event types', () => {
    const types = ['Classwork', 'Test', 'Exam', 'Holiday', 'Other'];
    for (const type of types) {
      const result = eventSchema.safeParse({
        id: 'event_123',
        date: '2026-04-22',
        title: 'Event',
        type,
      });
      expect(result.success).toBe(true);
    }
  });
});

describe('timetableSlotSchema', () => {
  it('validates valid timetable slot', () => {
    const result = timetableSlotSchema.safeParse({
      id: 'slot_123',
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '10:00',
      subject: 'Mathematics',
      lesson: 'Algebra',
    });
    expect(result.success).toBe(true);
  });

  it('rejects dayOfWeek out of range (negative)', () => {
    const result = timetableSlotSchema.safeParse({
      id: 'slot_123',
      dayOfWeek: -1,
      startTime: '09:00',
      endTime: '10:00',
      subject: 'Mathematics',
      lesson: 'Algebra',
    });
    expect(result.success).toBe(false);
  });

  it('rejects dayOfWeek out of range (>6)', () => {
    const result = timetableSlotSchema.safeParse({
      id: 'slot_123',
      dayOfWeek: 7,
      startTime: '09:00',
      endTime: '10:00',
      subject: 'Mathematics',
      lesson: 'Algebra',
    });
    expect(result.success).toBe(false);
  });

  it('accepts dayOfWeek 0-6', () => {
    for (let day = 0; day <= 6; day++) {
      const result = timetableSlotSchema.safeParse({
        id: 'slot_123',
        dayOfWeek: day,
        startTime: '09:00',
        endTime: '10:00',
        subject: 'Mathematics',
        lesson: 'Algebra',
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid time format', () => {
    const result = timetableSlotSchema.safeParse({
      id: 'slot_123',
      dayOfWeek: 1,
      startTime: '9:00 AM',
      endTime: '10:00',
      subject: 'Mathematics',
      lesson: 'Algebra',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty subject', () => {
    const result = timetableSlotSchema.safeParse({
      id: 'slot_123',
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '10:00',
      subject: '',
      lesson: 'Algebra',
    });
    expect(result.success).toBe(false);
  });
});

describe('teacherSchema', () => {
  it('validates valid teacher data', () => {
    const result = teacherSchema.safeParse({
      username: 'teacher1',
      password: 'password123',
      name: 'John Smith',
    });
    expect(result.success).toBe(true);
  });

  it('rejects password shorter than 4 characters', () => {
    const result = teacherSchema.safeParse({
      username: 'teacher1',
      password: 'abc',
      name: 'John Smith',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty name', () => {
    const result = teacherSchema.safeParse({
      username: 'teacher1',
      password: 'password123',
      name: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('settingSchema', () => {
  it('validates valid setting', () => {
    const result = settingSchema.safeParse({
      key: 'theme',
      value: 'dark',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty key', () => {
    const result = settingSchema.safeParse({
      key: '',
      value: 'dark',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty value', () => {
    const result = settingSchema.safeParse({
      key: 'theme',
      value: '',
    });
    expect(result.success).toBe(false);
  });
});