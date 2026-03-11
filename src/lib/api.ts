import { ClassData, Student, AttendanceRecord, CalendarEvent, TimetableSlot } from '../store';

const API_BASE = '/api';

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }
  return response.json();
}

export const api = {
  // --- AUTH ---
  login: (password: string) => fetchApi<{success: boolean}>('/auth/login', { method: 'POST', body: JSON.stringify({ password }) }),
  logout: () => fetchApi<{success: boolean}>('/auth/logout', { method: 'POST' }),
  verifyAuth: () => fetchApi<{authenticated: boolean}>('/auth/verify'),

  // --- CLASSES ---
  getClasses: () => fetchApi<ClassData[]>('/classes'),
  createClass: (cls: Partial<ClassData>) => fetchApi<ClassData>('/classes', { method: 'POST', body: JSON.stringify(cls) }),
  updateClass: (id: string, name: string) => fetchApi<{success: boolean}>(`/classes/${id}`, { method: 'PUT', body: JSON.stringify({ name }) }),
  deleteClass: (id: string) => fetchApi<{success: boolean}>(`/classes/${id}`, { method: 'DELETE' }),

  getStudents: (classId: string) => fetchApi<Student[]>(`/classes/${classId}/students`),
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
};
