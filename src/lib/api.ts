import { ClassData, Student, AttendanceRecord, CalendarEvent, TimetableSlot } from '../store';

const API_BASE = '/api';

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = await response.json();
      if (body?.error) message = body.error;
    } catch { /* ignore JSON parse errors */ }
    throw new Error(message);
  }
  return response.json();
}

export const api = {
  // --- AUTH ---
  login: (username: string, password: string) => fetchApi<{success: boolean, teacherId: string, username: string, name: string, isAdmin: boolean}>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  logout: () => fetchApi<{success: boolean}>('/auth/logout', { method: 'POST' }),
  verifyAuth: () => fetchApi<{authenticated: boolean, teacherId?: string}>('/auth/verify'),
  getMe: () => fetchApi<{id: string, username: string, name: string}>('/auth/me'),
  registerTeacher: (username: string, password: string, name: string) => fetchApi<{success: boolean, id: string, username: string, name: string}>('/teachers/register', { method: 'POST', body: JSON.stringify({ username, password, name }) }),

  // --- CLASSES ---
  getClasses: () => fetchApi<Array<{id: string, teacher_id: string, name: string, owner_name: string, role: string}>>('/classes'),
  createClass: (cls: Partial<ClassData>) => fetchApi<ClassData>('/classes', { method: 'POST', body: JSON.stringify(cls) }),
  updateClass: (id: string, name: string) => fetchApi<{success: boolean}>(`/classes/${id}`, { method: 'PUT', body: JSON.stringify({ name }) }),
  deleteClass: (id: string) => fetchApi<{success: boolean}>(`/classes/${id}`, { method: 'DELETE' }),

  // --- CLASS TEACHERS ---
  getClassTeachers: (classId: string) => fetchApi<Array<{teacher_id: string, role: string, username: string, name: string}>>(`/classes/${classId}/teachers`),
  addTeacherToClass: (classId: string, teacherId: string) => fetchApi<{success: boolean}>(`/classes/${classId}/teachers`, { method: 'POST', body: JSON.stringify({ teacherId }) }),
  removeTeacherFromClass: (classId: string, teacherId: string) => fetchApi<{success: boolean}>(`/classes/${classId}/teachers/${teacherId}`, { method: 'DELETE' }),
  getAllTeachers: () => fetchApi<Array<{id: string, username: string, name: string}>>('/teachers'),

  getStudents: (classId: string, includeArchived?: boolean) => fetchApi<Student[]>(`/classes/${classId}/students${includeArchived ? '?includeArchived=true' : ''}`),
  createStudent: (classId: string, student: Student) => fetchApi<{success: boolean}>(`/classes/${classId}/students`, { method: 'POST', body: JSON.stringify(student) }),
  updateStudent: (studentId: string, data: Partial<Student>) => fetchApi<{success: boolean}>(`/students/${studentId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteStudent: (studentId: string) => fetchApi<{success: boolean}>(`/students/${studentId}`, { method: 'DELETE' }),
  syncStudents: (classId: string, students: Student[]) => fetchApi<{success: boolean, students: Student[]}>(`/classes/${classId}/students/sync`, { method: 'POST', body: JSON.stringify(students) }),

  getRecords: (classId: string) => fetchApi<AttendanceRecord[]>(`/classes/${classId}/records`),
  saveRecords: (records: AttendanceRecord[]) => fetchApi<{success: boolean}>('/records', { method: 'POST', body: JSON.stringify(records) }),

  getDailyNotes: (classId: string) => fetchApi<Record<string, string>>(`/classes/${classId}/daily-notes`),
  saveDailyNote: (classId: string, date: string, note: string) => fetchApi<{success: boolean}>(`/classes/${classId}/daily-notes`, { method: 'POST', body: JSON.stringify({ date, note }) }),

  getEvents: (classId: string) => fetchApi<CalendarEvent[]>(`/classes/${classId}/events`),
  createEvents: (classId: string, events: CalendarEvent[]) => fetchApi<{success: boolean}>(`/classes/${classId}/events`, { method: 'POST', body: JSON.stringify(events) }),
  updateEvent: (eventId: string, data: Partial<CalendarEvent>) => fetchApi<{success: boolean}>(`/events/${eventId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteEvent: (eventId: string) => fetchApi<{success: boolean}>(`/events/${eventId}`, { method: 'DELETE' }),

  getTimetable: (classId: string) => fetchApi<TimetableSlot[]>(`/classes/${classId}/timetable`),
  createTimetableSlot: (classId: string, slot: TimetableSlot) => fetchApi<{success: boolean}>(`/classes/${classId}/timetable`, { method: 'POST', body: JSON.stringify(slot) }),
  updateTimetableSlot: (slotId: string, data: Partial<TimetableSlot>) => fetchApi<{success: boolean}>(`/timetable/${slotId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTimetableSlot: (slotId: string) => fetchApi<{success: boolean}>(`/timetable/${slotId}`, { method: 'DELETE' }),

  getSeating: (classId: string) => fetchApi<Record<string, string>>(`/classes/${classId}/seating`),
  updateSeat: (classId: string, seatId: string, studentId: string | null) => fetchApi<{success: boolean}>(`/classes/${classId}/seating`, { method: 'POST', body: JSON.stringify({ seatId, studentId }) }),
  saveSeatingLayout: (classId: string, layout: Record<string, string>) => fetchApi<{success: boolean}>(`/classes/${classId}/seating`, { method: 'PUT', body: JSON.stringify(layout) }),
  clearSeating: (classId: string) => fetchApi<{success: boolean}>(`/classes/${classId}/seating`, { method: 'DELETE' }),

  getSettings: () => fetchApi<Record<string, string>>('/settings'),
  saveSetting: (key: string, value: string) => fetchApi<{success: boolean}>('/settings', { method: 'POST', body: JSON.stringify({ key, value }) }),

  // --- INVITES (Phase 2.2) ---
  createInvite: (classId: string, role?: string, expiresInHours?: number) => fetchApi<{success: boolean, code: string, inviteUrl: string, role: string, expiresAt: string}>(`/classes/${classId}/invites`, { method: 'POST', body: JSON.stringify({ role, expiresInHours }) }),
  getClassInvites: (classId: string) => fetchApi<Array<{code: string, role: string, created_by: string, created_at: string, expires_at: string, used_by: string | null, used_at: string | null}>>(`/classes/${classId}/invites`),
  deleteInvite: (classId: string, code: string) => fetchApi<{success: boolean}>(`/classes/${classId}/invites/${code}`, { method: 'DELETE' }),
  redeemInvite: (code: string) => fetchApi<{success: boolean, className: string, role: string}>('/invites/redeem', { method: 'POST', body: JSON.stringify({ code }) }),

  // --- SESSIONS (Phase 2.3) ---
  getSessions: () => fetchApi<Array<{id: string, device_name: string, ip_address: string, created_at: string, last_active: string, expires_at: string, is_revoked: number}>>('/sessions'),
  revokeSession: (sessionId: string) => fetchApi<{success: boolean}>('/sessions/revoke', { method: 'POST', body: JSON.stringify({ sessionId }) }),

  // --- ROLE MANAGEMENT ---
  updateTeacherRole: (classId: string, teacherId: string, role: string) => fetchApi<{success: boolean}>(`/classes/${classId}/teachers/${teacherId}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),
};
