import { create } from 'zustand';
import { persist, StateStorage, createJSONStorage } from 'zustand/middleware';

const apiStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      const response = await fetch('/api/data');
      if (!response.ok) return null;
      const data = await response.json();
      return data[name] || null;
    } catch (error) {
      console.error('Failed to fetch state from server', error);
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      const existingRes = await fetch('/api/data');
      const existing = existingRes.ok ? await existingRes.json() : {};
      existing[name] = value;
      await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(existing),
      });
    } catch (error) {
      console.error('Failed to save state to server', error);
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      const existingRes = await fetch('/api/data');
      const existing = existingRes.ok ? await existingRes.json() : {};
      delete existing[name];
      await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(existing),
      });
    } catch (error) {
      console.error('Failed to remove state from server', error);
    }
  },
};

export type AttendanceStatus = 'Present' | 'Absent' | 'Sick' | 'Late';
export type EventType = 'Classwork' | 'Test' | 'Exam' | 'Holiday' | 'Other';

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

export interface TimetableSlot {
  id: string;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
  startTime: string; // e.g., "08:00"
  endTime: string; // e.g., "09:00"
  subject: string;
  lesson: string;
}

export interface ClassData {
  id: string;
  name: string;
  students: Student[];
  records: AttendanceRecord[];
  dailyNotes: Record<string, string>;
  events: CalendarEvent[];
  timetable: TimetableSlot[];
  seatingLayout: Record<string, string>;
}

interface AppState {
  classes: ClassData[];
  currentClassId: string | null;

  students: Student[];
  records: AttendanceRecord[];
  dailyNotes: Record<string, string>;
  events: CalendarEvent[];
  timetable: TimetableSlot[];
  seatingLayout: Record<string, string>; // key: "row-col", value: studentId
  theme: 'light' | 'dark';
  adminPassword?: string;

  addClass: (name: string) => void;
  removeClass: (id: string) => void;
  setCurrentClass: (id: string) => void;
  updateClassName: (id: string, name: string) => void;

  setStudents: (students: Student[]) => void;
  addStudent: (student: Student) => void;
  removeStudent: (id: string) => void;
  updateStudent: (id: string, data: Partial<Student>) => void;
  setRecord: (record: AttendanceRecord) => void;
  setDailyNote: (date: string, note: string) => void;
  addEvent: (event: CalendarEvent) => void;
  addEvents: (events: CalendarEvent[]) => void;
  updateEvent: (id: string, data: Partial<CalendarEvent>) => void;
  removeEvent: (id: string) => void;
  addTimetableSlot: (slot: TimetableSlot) => void;
  updateTimetableSlot: (id: string, data: Partial<TimetableSlot>) => void;
  removeTimetableSlot: (id: string) => void;
  updateSeat: (seatId: string, studentId: string | null) => void;
  setSeatingLayout: (layout: Record<string, string>) => void;
  clearSeatingLayout: () => void;
  toggleTheme: () => void;
  clearData: () => void;
  clearAllData: () => void;
  updateAdminPassword: (password: string) => void;
}

const updateCurrentClass = (state: AppState, updates: Partial<AppState>) => {
  if (!state.currentClassId) return updates;
  return {
    ...updates,
    classes: state.classes.map(c => c.id === state.currentClassId ? { ...c, ...updates } : c)
  };
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      classes: [],
      currentClassId: null,

      students: [],
      records: [],
      dailyNotes: {},
      events: [],
      timetable: [],
      seatingLayout: {},
      theme: 'light',
      adminPassword: 'admin123',

      addClass: (name) => set((state) => {
        const newClass: ClassData = {
          id: `class_${Date.now()}`,
          name,
          students: [],
          records: [],
          dailyNotes: {},
          events: [],
          timetable: [],
          seatingLayout: {},
        };
        const newClasses = [...state.classes, newClass];
        
        return {
          classes: newClasses,
          currentClassId: newClass.id,
          students: newClass.students,
          records: newClass.records,
          dailyNotes: newClass.dailyNotes,
          events: newClass.events,
          timetable: newClass.timetable,
          seatingLayout: newClass.seatingLayout,
        };
      }),

      removeClass: (id) => set((state) => {
        const newClasses = state.classes.filter(c => c.id !== id);
        if (state.currentClassId === id) {
          const nextClass = newClasses[0];
          if (nextClass) {
            return {
              classes: newClasses,
              currentClassId: nextClass.id,
              students: nextClass.students,
              records: nextClass.records,
              dailyNotes: nextClass.dailyNotes,
              events: nextClass.events,
              timetable: nextClass.timetable,
              seatingLayout: nextClass.seatingLayout,
            };
          } else {
            return {
              classes: newClasses,
              currentClassId: null,
              students: [],
              records: [],
              dailyNotes: {},
              events: [],
              timetable: [],
              seatingLayout: {},
            };
          }
        }
        return { classes: newClasses };
      }),

      setCurrentClass: (id) => set((state) => {
        if (state.currentClassId === id) return state;
        
        const targetClass = state.classes.find(c => c.id === id);
        if (!targetClass) return state;
        
        return {
          currentClassId: id,
          students: targetClass.students,
          records: targetClass.records,
          dailyNotes: targetClass.dailyNotes,
          events: targetClass.events,
          timetable: targetClass.timetable,
          seatingLayout: targetClass.seatingLayout,
        };
      }),

      updateClassName: (id, name) => set((state) => ({
        classes: state.classes.map(c => c.id === id ? { ...c, name } : c)
      })),

      setStudents: (students) => set((state) => updateCurrentClass(state, { students })),
      
      addStudent: (student) => set((state) => {
        if (state.students.some(s => s.rollNumber === student.rollNumber && s.name === student.name)) {
          return state;
        }
        return updateCurrentClass(state, { students: [...state.students, student] });
      }),
      
      removeStudent: (id) => set((state) => {
        const newSeating = { ...state.seatingLayout };
        Object.keys(newSeating).forEach(key => {
          if (newSeating[key] === id) {
            delete newSeating[key];
          }
        });
        return updateCurrentClass(state, { 
          students: state.students.filter((s) => s.id !== id),
          seatingLayout: newSeating
        });
      }),
      
      updateStudent: (id, data) => set((state) => updateCurrentClass(state, {
        students: state.students.map((s) => (s.id === id ? { ...s, ...data } : s)),
      })),
      
      setRecord: (record) => set((state) => {
        const existingIndex = state.records.findIndex(
          (r) => r.studentId === record.studentId && r.date === record.date
        );
        if (existingIndex >= 0) {
          const newRecords = [...state.records];
          newRecords[existingIndex] = record;
          return updateCurrentClass(state, { records: newRecords });
        }
        return updateCurrentClass(state, { records: [...state.records, record] });
      }),
      
      setDailyNote: (date, note) => set((state) => updateCurrentClass(state, {
        dailyNotes: { ...state.dailyNotes, [date]: note },
      })),
      
      addEvent: (event) => set((state) => updateCurrentClass(state, { events: [...state.events, event] })),
      
      addEvents: (newEvents) => set((state) => updateCurrentClass(state, { events: [...state.events, ...newEvents] })),
      
      updateEvent: (id, data) => set((state) => updateCurrentClass(state, {
        events: state.events.map((e) => (e.id === id ? { ...e, ...data } : e)),
      })),
      
      removeEvent: (id) => set((state) => updateCurrentClass(state, { events: state.events.filter((e) => e.id !== id) })),
      
      addTimetableSlot: (slot) => set((state) => updateCurrentClass(state, { timetable: [...state.timetable, slot] })),
      
      updateTimetableSlot: (id, data) => set((state) => updateCurrentClass(state, {
        timetable: state.timetable.map((s) => (s.id === id ? { ...s, ...data } : s)),
      })),
      
      removeTimetableSlot: (id) => set((state) => updateCurrentClass(state, { timetable: state.timetable.filter((s) => s.id !== id) })),
      
      updateSeat: (seatId, studentId) => set((state) => {
        const newSeating = { ...state.seatingLayout };
        if (studentId) {
          Object.keys(newSeating).forEach(key => {
            if (newSeating[key] === studentId) {
              delete newSeating[key];
            }
          });
          newSeating[seatId] = studentId;
        } else {
          delete newSeating[seatId];
        }
        return updateCurrentClass(state, { seatingLayout: newSeating });
      }),
      
      setSeatingLayout: (layout) => set((state) => updateCurrentClass(state, { seatingLayout: layout })),
      
      clearSeatingLayout: () => set((state) => updateCurrentClass(state, { seatingLayout: {} })),
      
      toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
      
      clearData: () => set((state) => updateCurrentClass(state, { students: [], records: [], dailyNotes: {}, events: [], timetable: [], seatingLayout: {} })),

      clearAllData: () => set(() => {
        const defaultClass: ClassData = {
          id: 'class_default',
          name: 'Default Class',
          students: [],
          records: [],
          dailyNotes: {},
          events: [],
          timetable: [],
          seatingLayout: {},
        };
        return {
          classes: [defaultClass],
          currentClassId: defaultClass.id,
          students: [],
          records: [],
          dailyNotes: {},
          events: [],
          timetable: [],
          seatingLayout: {},
        };
      }),

      updateAdminPassword: (password) => set(() => ({ adminPassword: password })),
    }),
    {
      name: 'teacher-assistant-storage',
      storage: createJSONStorage(() => apiStorage),
      version: 1,
      migrate: (persistedState: any, version: number) => {
        if (version === 0) {
          const defaultClass = {
            id: 'class_default',
            name: 'Default Class',
            students: persistedState.students || [],
            records: persistedState.records || [],
            dailyNotes: persistedState.dailyNotes || {},
            events: persistedState.events || [],
            timetable: persistedState.timetable || [],
            seatingLayout: persistedState.seatingLayout || {},
          };
          persistedState.classes = [defaultClass];
          persistedState.currentClassId = defaultClass.id;
        }
        return persistedState;
      },
    }
  )
);
