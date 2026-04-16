import { create } from 'zustand';
import { shallow } from 'zustand/shallow';
import { api } from './lib/api';
import toast from 'react-hot-toast';

// Default class constant — must match db.ts DEFAULTS
const DEFAULT_CLASS_NAME = 'My First Class';

export type AttendanceStatus = 'Present' | 'Absent' | 'Sick' | 'Late';
export type EventType = 'Classwork' | 'Test' | 'Exam' | 'Holiday' | 'Other';

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
  teacher_id?: string;
  owner_name?: string;
  role?: string; // 'administrator' | 'owner' | 'teacher' | 'assistant'
  students: Student[];
  records: AttendanceRecord[];
  dailyNotes: Record<string, string>;
  events: CalendarEvent[];
  timetable: TimetableSlot[];
  seatingLayout: Record<string, string>;
  loaded?: boolean;
}

interface AppState {
  isInitialized: boolean;
  isAuthenticated: boolean;
  teacherId: string | null;
  teacherName: string | null;
  isAdmin: boolean;
  classes: ClassData[];
  currentClassId: string | null;

  students: Student[];
  records: AttendanceRecord[];
  isLoading: boolean;
  dailyNotes: Record<string, string>;
  events: CalendarEvent[];
  timetable: TimetableSlot[];
  seatingLayout: Record<string, string>; 
  theme: 'light' | 'dark';

  setAuth: (teacherId: string, teacherName: string, isAdmin?: boolean) => void;
  clearAuth: () => void;

  initializeStore: () => Promise<void>;
  loadClassData: (classId: string) => Promise<void>;
  reloadClassData: (classId: string) => Promise<void>;

  addClass: (name: string) => Promise<void>;
  removeClass: (id: string) => Promise<void>;
  setCurrentClass: (id: string) => void;
  updateClassName: (id: string, name: string) => Promise<void>;

  setStudents: (students: Student[]) => Promise<void>;
  addStudent: (student: Student) => Promise<void>;
  removeStudent: (id: string) => Promise<void>;
  updateStudent: (id: string, data: Partial<Student>) => Promise<void>;
  setRecord: (record: AttendanceRecord) => Promise<void>;
  markAllPresent: (date: string) => Promise<void>;
  undoLastAttendance: () => Promise<void>;
  lastAttendanceChange: AttendanceRecord | null;
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
  isAuthenticated: false,
  teacherId: null,
  teacherName: null,
  isAdmin: false,
  classes: [],
  currentClassId: null,

  students: [],
  records: [],
  isLoading: false,
  dailyNotes: {},
  events: [],
  timetable: [],
  seatingLayout: {},
  theme: 'light',
  lastAttendanceChange: null,

  setAuth: (teacherId, teacherName, isAdmin = false) => set({ isAuthenticated: true, teacherId, teacherName, isAdmin }),
  clearAuth: () => set({ isAuthenticated: false, teacherId: null, teacherName: null, isAdmin: false, isInitialized: false, classes: [], currentClassId: null, students: [], records: [], dailyNotes: {}, events: [], timetable: [], seatingLayout: {} }),

  initializeStore: async () => {
    try {
      set({ isLoading: true });
      const [classesData, settings] = await Promise.all([
        api.getClasses(),
        api.getSettings(),
      ]);

      // Never auto-create a default class here.
      // If classesData is genuinely empty (new user), the UI will show an empty state
      // with a "Create your first class" prompt. Auto-creating here was dangerous because
      // a temporary auth failure (401) could also return an empty array, causing a new
      // empty class to be created and making all existing data appear to vanish.

      // Eagerly load only the first/default class; other classes are lazy-loaded on switch
      if (classesData.length > 0) {
        const first = classesData[0] as unknown as ClassData;
        const [students, records, events, timetable, dailyNotes, seatingLayout] =
          await Promise.all([
            api.getStudents(first.id, false),
            api.getRecords(first.id),
            api.getEvents(first.id),
            api.getTimetable(first.id),
            api.getDailyNotes(first.id),
            api.getSeating(first.id),
          ]);
        first.students = students;
        first.records = records;
        first.events = events;
        first.timetable = timetable;
        first.dailyNotes = dailyNotes;
        first.seatingLayout = seatingLayout;
        first.loaded = true;
      }

      const defaultClassId = classesData.length > 0 ? classesData[0].id : null;
      const initialClass = classesData.find(c => c.id === defaultClassId) as unknown as ClassData | undefined;

      set({
        isInitialized: true,
        classes: classesData as unknown as ClassData[],
        currentClassId: defaultClassId,
        students: initialClass?.students || [],
        records: initialClass?.records || [],
        isLoading: false,
        dailyNotes: initialClass?.dailyNotes || {},
        events: initialClass?.events || [],
        timetable: initialClass?.timetable || [],
        seatingLayout: initialClass?.seatingLayout || {},
        theme: (settings.theme as 'light'|'dark') || 'light',
      });
    } catch (error) {
      console.error('Failed to initialize store from API', error);
      set({ isInitialized: true, isLoading: false });
    }
  },

  loadClassData: async (classId: string) => {
    const state = get();
    const cls = state.classes.find(c => c.id === classId);
    if (!cls || cls.loaded) return;

    try {
      const [students, records, events, timetable, dailyNotes, seatingLayout] = await Promise.all([
        api.getStudents(classId, false),
        api.getRecords(classId),
        api.getEvents(classId),
        api.getTimetable(classId),
        api.getDailyNotes(classId),
        api.getSeating(classId),
      ]);

      set((state) => ({
        classes: state.classes.map(c =>
          c.id === classId ? { ...c, students, records, events, timetable, dailyNotes, seatingLayout, loaded: true } : c
        ),
      }));
    } catch (error) {
      console.error(`Failed to load class data for ${classId}`, error);
    }
  },

  reloadClassData: async (classId: string) => {
    try {
      const [students, records, events, timetable, dailyNotes, seatingLayout] = await Promise.all([
        api.getStudents(classId, false),
        api.getRecords(classId),
        api.getEvents(classId),
        api.getTimetable(classId),
        api.getDailyNotes(classId),
        api.getSeating(classId),
      ]);

      set((state) => {
        const updatedClasses = state.classes.map(c =>
          c.id === classId ? { ...c, students, records, events, timetable, dailyNotes, seatingLayout, loaded: true } : c
        );
        const isCurrentClass = state.currentClassId === classId;
        return {
          classes: updatedClasses,
          ...(isCurrentClass ? {
            students,
            records,
            events,
            timetable,
            dailyNotes,
            seatingLayout,
          } : {}),
        };
      });
    } catch (error) {
      console.error(`Failed to reload class data for ${classId}`, error);
    }
  },

  addClass: async (name) => {
    try {
      const newClassId = `class_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
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
          loaded: true, // new class has no data to fetch
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

  setCurrentClass: async (id) => {
    const state = get();
    if (state.currentClassId === id) return;
    const targetClass = state.classes.find(c => c.id === id);
    if (!targetClass) return;

    if (!targetClass.loaded) {
      set({ isLoading: true });
      await get().loadClassData(id);
    }

    const updated = get().classes.find(c => c.id === id)!;
    set({
      currentClassId: id,
      students: updated.students,
      records: updated.records,
      dailyNotes: updated.dailyNotes,
      events: updated.events,
      timetable: updated.timetable,
      seatingLayout: updated.seatingLayout,
      isLoading: false,
    });
  },

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
          students: state.students.map((s) => s.id === id ? { ...s, isArchived: true } : s),
          seatingLayout: newSeating
        });
      });
      toast.success('Student archived');
    } catch (error) {
      toast.error('Failed to archive student');
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
      // Store the previous state for undo
      const existingRecord = get().records.find(
        (r) => r.studentId === record.studentId && r.date === record.date
      );
      
      await api.saveRecords([{ ...record, classId } as any]);
      
      set((state) => {
        const existingIndex = state.records.findIndex(
          (r) => r.studentId === record.studentId && r.date === record.date
        );
        let newRecords: AttendanceRecord[];
        if (existingIndex >= 0) {
          newRecords = [...state.records];
          newRecords[existingIndex] = record;
        } else {
          newRecords = [...state.records, record];
        }
        return {
          ...updateCurrentClass(state, { records: newRecords }),
          lastAttendanceChange: existingRecord || null,
        };
      });
    } catch (error) {
      toast.error('Failed to save attendance record');
    }
  },
  
  undoLastAttendance: async () => {
    const lastChange = get().lastAttendanceChange;
    if (!lastChange) return;
    
    const classId = get().currentClassId;
    if (!classId) return;
    
    try {
      // Restore the previous state or remove the record
      if (lastChange.status) {
        await api.saveRecords([{ ...lastChange, classId } as any]);
      } else {
        // If there was no previous record, delete it
        await api.saveRecords([{ ...lastChange, classId, status: 'Present' as AttendanceStatus, reason: null } as any]);
      }
      
      set((state) => {
        const existingIndex = state.records.findIndex(
          (r) => r.studentId === lastChange.studentId && r.date === lastChange.date
        );
        let newRecords: AttendanceRecord[];
        if (existingIndex >= 0 && lastChange.status) {
          newRecords = [...state.records];
          newRecords[existingIndex] = lastChange;
        } else if (existingIndex >= 0 && !lastChange.status) {
          newRecords = state.records.filter((_, i) => i !== existingIndex);
        } else {
          newRecords = state.records;
        }
        return updateCurrentClass(state, { records: newRecords, lastAttendanceChange: null });
      });
      toast.success('Attendance undone');
    } catch (error) {
      toast.error('Failed to undo attendance');
    }
  },
  
  markAllPresent: async (date) => {
    const classId = get().currentClassId;
    if (!classId) return;
    const students = get().students.filter(s => !s.isArchived);
    const existingRecords = get().records;
    
    // Only create records for students without an existing record for this date
    const newRecords: AttendanceRecord[] = students
      .filter(s => !existingRecords.some(r => r.studentId === s.id && r.date === date))
      .map(s => ({ studentId: s.id, date, status: 'Present' as AttendanceStatus }));
    
    if (newRecords.length === 0) return;
    
    try {
      await api.saveRecords(newRecords.map(r => ({ ...r, classId })));
      set((state) => updateCurrentClass(state, {
        records: [...state.records, ...newRecords]
      }));
      toast.success(`${newRecords.length} students marked present`);
    } catch (error) {
      toast.error('Failed to mark all present');
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
    try {
      await api.saveSetting('theme', newTheme);
      set({ theme: newTheme });
    } catch (error) {
      toast.error('Failed to update theme');
    }
  },
  
  clearData: async () => {
    const classId = get().currentClassId;
    if (!classId) return;

    const className = get().classes.find(c => c.id === classId)?.name || 'Class';

    try {
      await api.deleteClass(classId);
      await api.createClass({ id: classId, name: className });

      set((state) => updateCurrentClass(state, { students: [], records: [], dailyNotes: {}, events: [], timetable: [], seatingLayout: {} }));
      toast.success('Class data cleared');
    } catch (error) {
      toast.error('Failed to clear class data');
    }
  },

  clearAllData: async () => {
    try {
      const currentTeacherId = get().teacherId;
      const classes = get().classes;
      const failed: string[] = [];
      
      await Promise.allSettled(
        classes.map(async (c) => {
          try {
            await api.deleteClass(c.id);
          } catch {
            failed.push(c.name);
          }
        })
      );
      
      if (failed.length > 0 && failed.length === classes.length) {
        throw new Error('All deletions failed');
      }
      
      const defaultClassId = `class_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
      await api.createClass({ id: defaultClassId, name: DEFAULT_CLASS_NAME });

      // Re-fetch admin status from server to ensure correctness after reset
      let currentIsAdmin = get().isAdmin;
      try {
        const me = await api.getMe();
        currentIsAdmin = me.isAdmin;
      } catch {
        // Fall back to current state if fetch fails
      }

      set(() => {
        const defaultClass: ClassData = {
          id: defaultClassId,
          name: DEFAULT_CLASS_NAME,
          students: [],
          records: [],
          dailyNotes: {},
          events: [],
          timetable: [],
          seatingLayout: {},
        };
        return {
          isAuthenticated: currentTeacherId !== null,
          teacherId: currentTeacherId,
          isAdmin: currentIsAdmin,
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
      
      const msg = failed.length > 0
        ? `All data cleared (${failed.length} classes failed to delete)`
        : 'All data cleared successfully';
      toast.success(msg);
    } catch (error) {
      toast.error('Failed to clear all data');
    }
  },

  updateAdminPassword: async (password) => {
    try {
      await api.saveSetting('adminPassword', password);
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
      toast.error('Failed to save attendance record');
    }
  },
}));

export const useActiveStudents = () => useStore(
  (state) => state.students.filter(s => !s.isArchived)
);
