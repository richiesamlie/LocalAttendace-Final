import { create } from 'zustand';
import { api } from './lib/api';
import toast from 'react-hot-toast';

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
  dayOfWeek: number; 
  startTime: string; 
  endTime: string; 
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
  isInitialized: boolean;
  classes: ClassData[];
  currentClassId: string | null;

  students: Student[];
  records: AttendanceRecord[];
  dailyNotes: Record<string, string>;
  events: CalendarEvent[];
  timetable: TimetableSlot[];
  seatingLayout: Record<string, string>; 
  theme: 'light' | 'dark';
  adminPassword?: string;

  initializeStore: () => Promise<void>;

  addClass: (name: string) => Promise<void>;
  removeClass: (id: string) => Promise<void>;
  setCurrentClass: (id: string) => void;
  updateClassName: (id: string, name: string) => Promise<void>;

  setStudents: (students: Student[]) => Promise<void>;
  addStudent: (student: Student) => Promise<void>;
  removeStudent: (id: string) => Promise<void>;
  updateStudent: (id: string, data: Partial<Student>) => Promise<void>;
  setRecord: (record: AttendanceRecord) => Promise<void>;
  setDailyNote: (date: string, note: string) => Promise<void>;
  addEvent: (event: CalendarEvent) => Promise<void>;
  addEvents: (events: CalendarEvent[]) => Promise<void>;
  updateEvent: (id: string, data: Partial<CalendarEvent>) => Promise<void>;
  removeEvent: (id: string) => Promise<void>;
  addTimetableSlot: (slot: TimetableSlot) => Promise<void>;
  updateTimetableSlot: (id: string, data: Partial<TimetableSlot>) => Promise<void>;
  removeTimetableSlot: (id: string) => Promise<void>;
  updateSeat: (seatId: string, studentId: string | null) => Promise<void>;
  setSeatingLayout: (layout: Record<string, string>) => Promise<void>;
  clearSeatingLayout: () => Promise<void>;
  toggleTheme: () => Promise<void>;
  clearData: () => Promise<void>;
  clearAllData: () => Promise<void>;
  updateAdminPassword: (password: string) => Promise<void>;
  setRecordForClass: (classId: string, record: AttendanceRecord) => Promise<void>;
}

const updateCurrentClass = (state: AppState, updates: Partial<AppState>) => {
  let targetClassId = state.currentClassId;
  let newClasses = [...state.classes];

  if (!targetClassId) {
    if (newClasses.length === 0) {
      return state; // Should not happen after init
    }
    targetClassId = newClasses[0].id;
  }

  return {
    ...updates,
    currentClassId: targetClassId,
    classes: newClasses.map(c => c.id === targetClassId ? { ...c, ...updates } : c)
  };
};

export const useStore = create<AppState>()((set, get) => ({
  isInitialized: false,
  classes: [],
  currentClassId: null,

  students: [],
  records: [],
  dailyNotes: {},
  events: [],
  timetable: [],
  seatingLayout: {},
  theme: 'light',
  adminPassword: '',

  initializeStore: async () => {
    try {
      let classesData = await api.getClasses();
      const settings = await api.getSettings();
      
      if (classesData.length === 0) {
        const defaultClassId = `class_${Date.now()}`;
        await api.createClass({ id: defaultClassId, name: 'My First Class' });
        classesData = await api.getClasses();
      }
      
      // Populate full nested structure for the client
      for (const cls of classesData) {
        cls.students = await api.getStudents(cls.id);
        cls.records = await api.getRecords(cls.id);
        cls.events = await api.getEvents(cls.id);
        cls.timetable = await api.getTimetable(cls.id);
        cls.dailyNotes = await api.getDailyNotes(cls.id);
        cls.seatingLayout = await api.getSeating(cls.id);
      }

      const defaultClassId = classesData.length > 0 ? classesData[0].id : null;
      const initialClass = classesData.find(c => c.id === defaultClassId);

      set({
        isInitialized: true,
        classes: classesData,
        currentClassId: defaultClassId,
        students: initialClass?.students || [],
        records: initialClass?.records || [],
        dailyNotes: initialClass?.dailyNotes || {},
        events: initialClass?.events || [],
        timetable: initialClass?.timetable || [],
        seatingLayout: initialClass?.seatingLayout || {},
        theme: (settings.theme as 'light'|'dark') || 'light',
        adminPassword: settings.adminPassword || 'admin123',
      });
    } catch (error) {
      console.error('Failed to initialize store from API', error);
      set({ isInitialized: true });
    }
  },

  addClass: async (name) => {
    try {
      const newClassId = `class_${Date.now()}`;
      await api.createClass({ id: newClassId, name });
      
      set((state) => {
        const newClass: ClassData = {
          id: newClassId,
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
      });
      toast.success('Class created');
    } catch (error) {
      toast.error('Failed to create class');
    }
  },

  removeClass: async (id) => {
    try {
      await api.deleteClass(id);
      set((state) => {
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
      });
      toast.success('Class deleted');
    } catch (error) {
      toast.error('Failed to delete class');
    }
  },

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

  updateClassName: async (id, name) => {
    try {
      await api.updateClass(id, name);
      set((state) => ({
        classes: state.classes.map(c => c.id === id ? { ...c, name } : c)
      }));
    } catch (error) {
      toast.error('Failed to rename class');
    }
  },

  setStudents: async (students) => {
    const classId = get().currentClassId;
    if (!classId) return;
    try {
      const res = await api.syncStudents(classId, students);
      set((state) => updateCurrentClass(state, { students: res.students }));
      toast.success('Students synced');
    } catch (error) {
      console.error('Failed to sync students', error);
      toast.error('Failed to sync students with database');
      set((state) => updateCurrentClass(state, { students }));
    }
  },
  
  addStudent: async (student) => {
    const state = get();
    if (!state.currentClassId) return;
    if (state.students.some(s => s.rollNumber === student.rollNumber && s.name === student.name)) return;
    
    try {
      await api.createStudent(state.currentClassId, student);
      set((state) => updateCurrentClass(state, { students: [...state.students, student] }));
      toast.success('Student added');
    } catch (error) {
      toast.error('Failed to add student');
    }
  },
  
  removeStudent: async (id) => {
    try {
      await api.deleteStudent(id);
      const state = get();
      if (state.currentClassId) {
        // Also clear seating for this student in DB? The DB has ON DELETE CASCADE, so it's automatic.
      }
      set((state) => {
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
      });
      toast.success('Student removed');
    } catch (error) {
      toast.error('Failed to remove student');
    }
  },
  
  updateStudent: async (id, data) => {
    try {
      await api.updateStudent(id, data);
      set((state) => updateCurrentClass(state, {
        students: state.students.map((s) => (s.id === id ? { ...s, ...data } : s)),
      }));
    } catch (error) {
      toast.error('Failed to update student');
    }
  },
  
  setRecord: async (record) => {
    const classId = get().currentClassId;
    if (!classId) return;
    try {
      await api.saveRecords([{ ...record, classId } as any]);
      
      set((state) => {
        const existingIndex = state.records.findIndex(
          (r) => r.studentId === record.studentId && r.date === record.date
        );
        if (existingIndex >= 0) {
          const newRecords = [...state.records];
          newRecords[existingIndex] = record;
          return updateCurrentClass(state, { records: newRecords });
        }
        return updateCurrentClass(state, { records: [...state.records, record] });
      });
    } catch (error) {
      toast.error('Failed to save attendance record');
    }
  },
  
  setDailyNote: async (date, note) => {
    const classId = get().currentClassId;
    if (!classId) return;
    try {
      await api.saveDailyNote(classId, date, note);
      set((state) => updateCurrentClass(state, {
        dailyNotes: { ...state.dailyNotes, [date]: note },
      }));
    } catch (error) {
      toast.error('Failed to save daily note');
    }
  },
  
  addEvent: async (event) => {
    const classId = get().currentClassId;
    if (!classId) return;
    try {
      await api.createEvents(classId, [event]);
      set((state) => updateCurrentClass(state, { events: [...state.events, event] }));
      toast.success('Event added');
    } catch (error) {
      toast.error('Failed to add event');
    }
  },
  
  addEvents: async (newEvents) => {
    const classId = get().currentClassId;
    if (!classId) return;
    try {
      await api.createEvents(classId, newEvents);
      set((state) => updateCurrentClass(state, { events: [...state.events, ...newEvents] }));
    } catch (error) {
      toast.error('Failed to import events');
    }
  },
  
  updateEvent: async (id, data) => {
    try {
      await api.updateEvent(id, data);
      set((state) => updateCurrentClass(state, {
        events: state.events.map((e) => (e.id === id ? { ...e, ...data } : e)),
      }));
    } catch (error) {
      toast.error('Failed to update event');
    }
  },
  
  removeEvent: async (id) => {
    try {
      await api.deleteEvent(id);
      set((state) => updateCurrentClass(state, { events: state.events.filter((e) => e.id !== id) }));
      toast.success('Event removed');
    } catch (error) {
      toast.error('Failed to remove event');
    }
  },
  
  addTimetableSlot: async (slot) => {
    const classId = get().currentClassId;
    if (!classId) return;
    try {
      await api.createTimetableSlot(classId, slot);
      set((state) => updateCurrentClass(state, { timetable: [...state.timetable, slot] }));
    } catch (error) {
      toast.error('Failed to add timetable slot');
    }
  },
  
  updateTimetableSlot: async (id, data) => {
    try {
      await api.updateTimetableSlot(id, data);
      set((state) => updateCurrentClass(state, {
        timetable: state.timetable.map((s) => (s.id === id ? { ...s, ...data } : s)),
      }));
    } catch (error) {
      toast.error('Failed to update timetable slot');
    }
  },
  
  removeTimetableSlot: async (id) => {
    try {
      await api.deleteTimetableSlot(id);
      set((state) => updateCurrentClass(state, { timetable: state.timetable.filter((s) => s.id !== id) }));
    } catch (error) {
      toast.error('Failed to remove timetable slot');
    }
  },
  
  updateSeat: async (seatId, studentId) => {
    const classId = get().currentClassId;
    if (!classId) return;
    try {
      await api.updateSeat(classId, seatId, studentId);
      
      set((state) => {
        const newSeating = { ...state.seatingLayout };
        if (studentId === null) {
          delete newSeating[seatId];
        } else {
          Object.keys(newSeating).forEach(key => {
            if (newSeating[key] === studentId) {
              delete newSeating[key];
            }
          });
          newSeating[seatId] = studentId;
        }
        return updateCurrentClass(state, { seatingLayout: newSeating });
      });
    } catch (error) {
      toast.error('Failed to update seating chart');
    }
  },
  
  setSeatingLayout: async (layout) => {
    const classId = get().currentClassId;
    if (!classId) return;
    try {
      await api.saveSeatingLayout(classId, layout);
      set((state) => updateCurrentClass(state, { seatingLayout: layout }));
      toast.success('Seating layout saved');
    } catch (error) {
      toast.error('Failed to save layout');
    }
  },
  
  clearSeatingLayout: async () => {
    const classId = get().currentClassId;
    if (!classId) return;
    try {
      await api.clearSeating(classId);
      set((state) => updateCurrentClass(state, { seatingLayout: {} }));
    } catch (error) {
      toast.error('Failed to clear seating');
    }
  },
  
  toggleTheme: async () => {
    const newTheme = get().theme === 'light' ? 'dark' : 'light';
    await api.saveSetting('theme', newTheme);
    set({ theme: newTheme });
  },
  
  clearData: async () => {
    // This function in the UI clears the data for the current class.
    const classId = get().currentClassId;
    if (!classId) return;
    
    try {
      // In SQLite, deleting the class cascades.
      await api.deleteClass(classId);
      await api.createClass({ id: classId, name: get().classes.find(c => c.id === classId)?.name || 'Class' });

      set((state) => updateCurrentClass(state, { students: [], records: [], dailyNotes: {}, events: [], timetable: [], seatingLayout: {} }));
      toast.success('Class data cleared');
    } catch (error) {
      toast.error('Failed to clear class data');
    }
  },

  clearAllData: async () => {
    try {
      // Drop all classes from DB...
      const classes = get().classes;
      for (const c of classes) {
        await api.deleteClass(c.id);
      }
      
      const defaultClassId = 'class_default';
      await api.createClass({ id: defaultClassId, name: 'Default Class' });

      set(() => {
        const defaultClass: ClassData = {
          id: defaultClassId,
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
      });
      toast.success('All data cleared successfully');
    } catch (error) {
      toast.error('Failed to clear all data');
    }
  },

  updateAdminPassword: async (password) => {
    try {
      await api.saveSetting('adminPassword', password);
      set(() => ({ adminPassword: password }));
      toast.success('Admin password updated');
    } catch (error) {
      toast.error('Failed to update admin password');
    }
  },
  
  setRecordForClass: async (classId, record) => {
    try {
      await api.saveRecords([{ ...record, classId } as any]);
      
      set((state) => {
        const newClasses = state.classes.map(c => {
          if (c.id === classId) {
            const existingIndex = c.records.findIndex(
              (r) => r.studentId === record.studentId && r.date === record.date
            );
            let newRecords = [...c.records];
            if (existingIndex >= 0) {
              newRecords[existingIndex] = record;
            } else {
              newRecords.push(record);
            }
            return { ...c, records: newRecords };
          }
          return c;
        });

        if (state.currentClassId === classId) {
          const targetClass = newClasses.find(c => c.id === classId);
          return { classes: newClasses, records: targetClass?.records || [] };
        }

        return { classes: newClasses };
      });
    } catch (error) {
      toast.error('Failed to update record for class');
    }
  },
}));
