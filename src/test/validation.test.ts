import { describe, it, expect } from 'vitest';
import {
  loginSchema,
  classSchema,
  studentSchema,
  attendanceRecordSchema,
  attendanceRecordsPayloadSchema,
  eventSchema,
  timetableSlotSchema,
  teacherSchema,
  settingSchema,
  dailyNotePayloadSchema,
  seatingSeatUpdatePayloadSchema,
  seatingLayoutPayloadSchema,
  classUpdateSchema,
  classTeacherAddSchema,
  classTeacherRoleUpdateSchema,
  classInviteCreateSchema,
  inviteRedeemSchema,
  sessionRevokeSchema,
  timetableSlotUpdateSchema,
  studentUpdateSchema,
  studentSyncPayloadSchema,
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

describe('attendanceRecordsPayloadSchema', () => {
  it('accepts single attendance record object', () => {
    const result = attendanceRecordsPayloadSchema.safeParse({
      studentId: 'student_123',
      classId: 'class_123',
      date: '2026-04-22',
      status: 'Present',
    });
    expect(result.success).toBe(true);
  });

  it('accepts non-empty attendance record array', () => {
    const result = attendanceRecordsPayloadSchema.safeParse([
      {
        studentId: 'student_123',
        classId: 'class_123',
        date: '2026-04-22',
        status: 'Present',
      },
      {
        studentId: 'student_456',
        classId: 'class_123',
        date: '2026-04-22',
        status: 'Absent',
        reason: 'Sick',
      },
    ]);
    expect(result.success).toBe(true);
  });

  it('rejects empty attendance record array', () => {
    const result = attendanceRecordsPayloadSchema.safeParse([]);
    expect(result.success).toBe(false);
  });

  it('rejects invalid payload shape', () => {
    const result = attendanceRecordsPayloadSchema.safeParse({
      classId: 'class_123',
      date: '2026-04-22',
      status: 'Present',
    });
    expect(result.success).toBe(false);
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

describe('dailyNotePayloadSchema', () => {
  it('validates a correct daily note payload', () => {
    const result = dailyNotePayloadSchema.safeParse({
      date: '2026-05-11',
      note: 'Review fractions and homework reminders',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid date format', () => {
    const result = dailyNotePayloadSchema.safeParse({
      date: '11/05/2026',
      note: 'Some note',
    });
    expect(result.success).toBe(false);
  });

  it('rejects note exceeding max length', () => {
    const result = dailyNotePayloadSchema.safeParse({
      date: '2026-05-11',
      note: 'a'.repeat(5001),
    });
    expect(result.success).toBe(false);
  });

  it('sanitizes null bytes and trims note', () => {
    const result = dailyNotePayloadSchema.safeParse({
      date: '2026-05-11',
      note: '  hello\x00world  ',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.note).toBe('helloworld');
    }
  });
});

describe('seatingSeatUpdatePayloadSchema', () => {
  it('accepts valid seat update payload with student assignment', () => {
    const result = seatingSeatUpdatePayloadSchema.safeParse({
      seatId: 'A1',
      studentId: 'student_123',
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid seat update payload with null student (unassign)', () => {
    const result = seatingSeatUpdatePayloadSchema.safeParse({
      seatId: 'A1',
      studentId: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing seatId', () => {
    const result = seatingSeatUpdatePayloadSchema.safeParse({
      studentId: 'student_123',
    });
    expect(result.success).toBe(false);
  });
});

describe('seatingLayoutPayloadSchema', () => {
  it('accepts valid seating layout map', () => {
    const result = seatingLayoutPayloadSchema.safeParse({
      A1: 'student_123',
      A2: 'student_456',
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-string student id values', () => {
    const result = seatingLayoutPayloadSchema.safeParse({
      A1: 123,
    });
    expect(result.success).toBe(false);
  });

  it('sanitizes keys and values', () => {
    const result = seatingLayoutPayloadSchema.safeParse({
      '  A1\x00  ': '  student_123\x00  ',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ A1: 'student_123' });
    }
  });
});

describe('classUpdateSchema', () => {
  it('accepts valid class update payload', () => {
    const result = classUpdateSchema.safeParse({ name: 'Primary 2A' });
    expect(result.success).toBe(true);
  });

  it('rejects empty class name', () => {
    const result = classUpdateSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });
});

describe('classTeacherAddSchema', () => {
  it('accepts valid teacher id payload', () => {
    const result = classTeacherAddSchema.safeParse({ teacherId: 'teacher_123' });
    expect(result.success).toBe(true);
  });

  it('rejects missing teacher id', () => {
    const result = classTeacherAddSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('classTeacherRoleUpdateSchema', () => {
  it('accepts valid role values', () => {
    for (const role of ['owner', 'teacher', 'assistant']) {
      const result = classTeacherRoleUpdateSchema.safeParse({ role });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid role', () => {
    const result = classTeacherRoleUpdateSchema.safeParse({ role: 'admin' });
    expect(result.success).toBe(false);
  });
});

describe('classInviteCreateSchema', () => {
  it('accepts empty payload (defaults applied by route)', () => {
    const result = classInviteCreateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts valid role and expiry', () => {
    const result = classInviteCreateSchema.safeParse({ role: 'assistant', expiresInHours: 24 });
    expect(result.success).toBe(true);
  });

  it('rejects invalid expiry range', () => {
    const result = classInviteCreateSchema.safeParse({ expiresInHours: 0 });
    expect(result.success).toBe(false);
  });
});

describe('inviteRedeemSchema', () => {
  it('accepts valid invite code', () => {
    const result = inviteRedeemSchema.safeParse({ code: 'inv-1234abcd' });
    expect(result.success).toBe(true);
  });

  it('rejects empty invite code', () => {
    const result = inviteRedeemSchema.safeParse({ code: '' });
    expect(result.success).toBe(false);
  });
});

describe('sessionRevokeSchema', () => {
  it('accepts all keyword', () => {
    const result = sessionRevokeSchema.safeParse({ sessionId: 'all' });
    expect(result.success).toBe(true);
  });

  it('accepts explicit session id', () => {
    const result = sessionRevokeSchema.safeParse({ sessionId: 'sess_123' });
    expect(result.success).toBe(true);
  });

  it('rejects missing session id', () => {
    const result = sessionRevokeSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('timetableSlotUpdateSchema', () => {
  it('accepts valid timetable update payload without id', () => {
    const result = timetableSlotUpdateSchema.safeParse({
      dayOfWeek: 2,
      startTime: '08:00',
      endTime: '09:00',
      subject: 'Science',
      lesson: 'Plants',
    });
    expect(result.success).toBe(true);
  });

  it('ignores unknown id field in update payload', () => {
    const result = timetableSlotUpdateSchema.safeParse({
      id: 'slot_1',
      dayOfWeek: 2,
      startTime: '08:00',
      endTime: '09:00',
      subject: 'Science',
      lesson: 'Plants',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as { id?: string }).id).toBeUndefined();
    }
  });
});

describe('studentUpdateSchema', () => {
  it('accepts partial update payload', () => {
    const result = studentUpdateSchema.safeParse({ name: 'New Name' });
    expect(result.success).toBe(true);
  });

  it('rejects empty payload', () => {
    const result = studentUpdateSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('studentSyncPayloadSchema', () => {
  it('accepts valid sync payload', () => {
    const result = studentSyncPayloadSchema.safeParse({
      students: [
        { id: 's1', name: 'A', rollNumber: '1', isFlagged: false },
        { id: 's2', name: 'B', rollNumber: '2', isFlagged: true, isArchived: false },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects payload with invalid students type', () => {
    const result = studentSyncPayloadSchema.safeParse({ students: 'oops' });
    expect(result.success).toBe(false);
  });
});