export type AttendanceStatus = 'Present' | 'Absent' | 'Sick' | 'Late';
export type EventType = 'Classwork' | 'Test' | 'Exam' | 'Holiday' | 'Other';
export type ClassRole = 'administrator' | 'owner' | 'teacher' | 'assistant';

export interface Student {
  id: string;
  name: string;
  rollNumber: string;
  parentName?: string;
  parentPhone?: string;
  isFlagged?: boolean;
  isArchived?: boolean;
}

export interface AttendanceRecord {
  studentId: string;
  date: string;
  status: AttendanceStatus;
  reason?: string;
}

export interface CalendarEvent {
  id: string;
  date: string;
  title: string;
  type: EventType;
  description?: string;
}

export interface TimetableSlot {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  subject: string;
  lesson: string;
}

export interface ClassData {
  id: string;
  name: string;
  teacher_id?: string;
  owner_name?: string;
  role?: ClassRole;
  students: Student[];
  records: AttendanceRecord[];
  dailyNotes: Record<string, string>;
  events: CalendarEvent[];
  timetable: TimetableSlot[];
  seatingLayout: Record<string, string>;
  loaded?: boolean;
}

export type Theme = 'light' | 'dark';