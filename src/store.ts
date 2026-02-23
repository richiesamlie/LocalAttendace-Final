import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AttendanceStatus = 'Present' | 'Absent' | 'Sick' | 'Late';
export type EventType = 'Classwork' | 'Test' | 'Exam' | 'Other';

export interface Student {
  id: string;
  name: string;
  rollNumber: string;
  parentName?: string;
  parentPhone?: string;
  isFlagged?: boolean;
}

export interface AttendanceRecord {
  studentId: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  reason?: string;
}

export interface CalendarEvent {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  type: EventType;
  description?: string;
}

interface AppState {
  students: Student[];
  records: AttendanceRecord[];
  dailyNotes: Record<string, string>;
  events: CalendarEvent[];
  seatingLayout: Record<string, string>; // key: "row-col", value: studentId
  theme: 'light' | 'dark';
  setStudents: (students: Student[]) => void;
  addStudent: (student: Student) => void;
  removeStudent: (id: string) => void;
  updateStudent: (id: string, data: Partial<Student>) => void;
  setRecord: (record: AttendanceRecord) => void;
  setDailyNote: (date: string, note: string) => void;
  addEvent: (event: CalendarEvent) => void;
  removeEvent: (id: string) => void;
  updateSeat: (seatId: string, studentId: string | null) => void;
  setSeatingLayout: (layout: Record<string, string>) => void;
  clearSeatingLayout: () => void;
  toggleTheme: () => void;
  clearData: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      students: [],
      records: [],
      dailyNotes: {},
      events: [],
      seatingLayout: {},
      theme: 'light',
      setStudents: (students) => set({ students }),
      addStudent: (student) => set((state) => {
        // Prevent duplicate roll numbers or rapid double-clicks
        if (state.students.some(s => s.rollNumber === student.rollNumber && s.name === student.name)) {
          return state;
        }
        return { students: [...state.students, student] };
      }),
      removeStudent: (id) => set((state) => {
        // Also remove from seating layout
        const newSeating = { ...state.seatingLayout };
        Object.keys(newSeating).forEach(key => {
          if (newSeating[key] === id) {
            delete newSeating[key];
          }
        });
        return { 
          students: state.students.filter((s) => s.id !== id),
          seatingLayout: newSeating
        };
      }),
      updateStudent: (id, data) =>
        set((state) => ({
          students: state.students.map((s) => (s.id === id ? { ...s, ...data } : s)),
        })),
      setRecord: (record) =>
        set((state) => {
          const existingIndex = state.records.findIndex(
            (r) => r.studentId === record.studentId && r.date === record.date
          );
          if (existingIndex >= 0) {
            const newRecords = [...state.records];
            newRecords[existingIndex] = record;
            return { records: newRecords };
          }
          return { records: [...state.records, record] };
        }),
      setDailyNote: (date, note) =>
        set((state) => ({
          dailyNotes: { ...state.dailyNotes, [date]: note },
        })),
      addEvent: (event) => set((state) => ({ events: [...state.events, event] })),
      removeEvent: (id) => set((state) => ({ events: state.events.filter((e) => e.id !== id) })),
      updateSeat: (seatId, studentId) => set((state) => {
        const newSeating = { ...state.seatingLayout };
        
        // If placing a student, remove them from any other seat first
        if (studentId) {
          Object.keys(newSeating).forEach(key => {
            if (newSeating[key] === studentId) {
              delete newSeating[key];
            }
          });
          newSeating[seatId] = studentId;
        } else {
          // Removing student from seat
          delete newSeating[seatId];
        }
        
        return { seatingLayout: newSeating };
      }),
      setSeatingLayout: (layout) => set({ seatingLayout: layout }),
      clearSeatingLayout: () => set({ seatingLayout: {} }),
      toggleTheme: () =>
        set((state) => ({
          theme: state.theme === 'light' ? 'dark' : 'light',
        })),
      clearData: () => set({ students: [], records: [], dailyNotes: {}, events: [], seatingLayout: {} }),
    }),
    {
      name: 'teacher-assistant-storage',
    }
  )
);
