export type ClassRole = 'administrator' | 'owner' | 'teacher' | 'assistant';

export interface Session {
  id: string;
  teacher_id: string;
  device_name: string;
  ip_address: string;
  created_at: string;
  last_active: string;
  expires_at: string;
  is_revoked: number;
}

export interface Teacher {
  id: string;
  username: string;
  password_hash: string;
  name: string;
  is_admin: number;
}

export interface ClassTeacher {
  class_id: string;
  role: string;
}

export interface Invite {
  id: string;
  class_id: string;
  code: string;
  role: string;
  created_by: string;
  created_at: string;
  expires_at: string;
  used_by: string | null;
  used_at: string | null;
}

export interface StudentRow {
  id: string;
  class_id?: string;
  name: string;
  roll_number: string;
  parent_name?: string;
  parent_phone?: string;
  is_flagged: number;
}

export interface CalendarEvent {
  id: string;
  class_id: string;
  date: string;
  title: string;
  type: string;
  description?: string;
}

export interface TimetableSlot {
  id: string;
  class_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  subject: string;
  lesson: string;
}

export interface Class {
  id: string;
  teacher_id: string;
  name: string;
}

export interface ClassInfo {
  id: string;
  name: string;
  teacher_id: string;
}

export interface DailyNote {
  date: string;
  note: string;
}

export interface SeatingLayoutRow {
  seat_id: string;
  student_id: string | null;
}

export interface SettingRow {
  key: string;
  value: string;
}

export interface AttendanceRecordRow {
  student_id: string;
  class_id: string;
  date: string;
  status: string;
  reason?: string;
}

export interface AttendanceRecordInput {
  studentId: string;
  classId: string;
  date: string;
  status: string;
  reason?: string;
}

export interface ClassWithRole extends Class {
  owner_name?: string;
  teacher_name?: string;
  role?: ClassRole;
}
