import { create } from 'zustand';
import { api } from './lib/api';
import toast from 'react-hot-toast';
import type {
  Student,
  AttendanceRecord,
  CalendarEvent,
  TimetableSlot,
  ClassData,
  AttendanceStatus,
  Theme,
  EventType,
} from './types/store';

type AttendanceRecordWithClassId = AttendanceRecord & { classId: string };

const DEFAULT_CLASS_NAME = 'My First Class';

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
  theme: Theme;

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

type ClassDataUpdatableFields = Pick<ClassData, 'students' | 'records' | 'dailyNotes' | 'events' | 'timetable' | 'seatingLayout'>;

const updateCurrentClass = (
  state: AppState,
  updates: Partial<ClassDataUpdatableFields> & { lastAttendanceChange?: null }
) => {
  let targetClassId = state.currentClassId;
  let newClasses = [...state.classes];

  if (!targetClassId) {
    if (newClasses.length === 0) {
      return state;
    }
    targetClassId = newClasses[0].id;
  }

  const { lastAttendanceChange, ...classUpdates } = updates;

  return {
    ...classUpdates,
    currentClassId: targetClassId,
    lastAttendanceChange: lastAttendanceChange !== undefined ? lastAttendanceChange : state.lastAttendanceChange,
    classes: newClasses.map(c => c.id === targetClassId ? { ...c, ...classUpdates } : c)
  };
};

const runSwallowedAction = async <T>(
  actionFn: () => Promise<T>,
  successMsg?: string | ((result: T) => string),
  errorMsg?: string
): Promise<T | null> => {
  try {
    const res = await actionFn();
    if (successMsg) {
      const msg = typeof successMsg === 'function' ? successMsg(res) : successMsg;
      toast.success(msg);
    }
    return res;
  } catch (_error) {
    if (errorMsg) {
      toast.error(errorMsg);
    }
    return null;
  }
};

const fetchClassPayload = async (classId: string) => {
  const [students, records, events, timetable, dailyNotes, seatingLayout] = await Promise.all([
    api.getStudents(classId, false),
    api.getRecords(classId),
    api.getEvents(classId),
    api.getTimetable(classId),
    api.getDailyNotes(classId),
    api.getSeating(classId),
  ]);
  return { students, records, events, timetable, dailyNotes, seatingLayout };
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
      const classesData = await api.getClasses();

      let settings: Record<string, string> = { theme: 'light' };
      try {
        const fetchedSettings = await api.getSettings();
        if (fetchedSettings) {
          settings = fetchedSettings;
        }
      } catch (err) {
        console.warn('[store] Could not load settings (expected for non-admins):', err);
      }

      if (classesData.length > 0) {
        const first = classesData[0] as unknown as ClassData;
        const payload = await fetchClassPayload(first.id);
        Object.assign(first, payload, { loaded: true });
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
        theme: (settings.theme as Theme) || 'light',
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
      const payload = await fetchClassPayload(classId);
      set((state) => ({
        classes: state.classes.map(c =>
          c.id === classId ? { ...c, ...payload, loaded: true } : c
        ),
      }));
    } catch (error) {
      console.error(`Failed to load class data for ${classId}`, error);
    }
  },

  reloadClassData: async (classId: string) => {
    try {
      const payload = await fetchClassPayload(classId);

      set((state) => {
        const updatedClasses = state.classes.map(c =>
          c.id === classId ? { ...c, ...payload, loaded: true } : c
        );
        const isCurrentClass = state.currentClassId === classId;
        return {
          classes: updatedClasses,
          ...(isCurrentClass ? {
            ...payload,
          } : {}),
        };
      });
    } catch (error) {
      console.error(`Failed to reload class data for ${classId}`, error);
    }
  },

  addClass: async (name) => {
    await runSwallowedAction(
      async () => {
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
            loaded: true,
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
      },
      'Class created',
      'Failed to create class'
    );
  },

  removeClass: async (id) => {
    await runSwallowedAction(
      async () => {
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
      },
      'Class deleted',
      'Failed to delete class'
    );
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

    const updated = get().classes.find(c => c.id === id);
    if (!updated) {
      set({ isLoading: false });
      return;
    }
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
    await runSwallowedAction(
      async () => {
        await api.updateClass(id, name);
        set((state) => ({
          classes: state.classes.map(c => c.id === id ? { ...c, name } : c)
        }));
      },
      undefined,
      'Failed to rename class'
    );
  },

  setStudents: async (students) => {
    const classId = get().currentClassId;
    if (!classId) return;
    await runSwallowedAction(
      async () => {
        await api.syncStudents(classId, students);
        set((state) => updateCurrentClass(state, { students }));
      },
      'Students synced',
      'Failed to sync students with database'
    );
  },

  addStudent: async (student) => {
    const state = get();
    const classId = state.currentClassId;
    if (!classId) return;
    if (state.students.some(s => s.rollNumber === student.rollNumber && s.name === student.name)) return;

    await runSwallowedAction(
      async () => {
        await api.createStudent(classId, student);
        set((state) => updateCurrentClass(state, { students: [...state.students, student] }));
      },
      'Student added',
      'Failed to add student'
    );
  },

  removeStudent: async (id) => {
    await runSwallowedAction(
      async () => {
        await api.deleteStudent(id);
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
      },
      'Student archived',
      'Failed to archive student'
    );
  },

  updateStudent: async (id, data) => {
    await runSwallowedAction(
      async () => {
        await api.updateStudent(id, data);
        set((state) => updateCurrentClass(state, {
          students: state.students.map((s) => (s.id === id ? { ...s, ...data } : s)),
        }));
      },
      undefined,
      'Failed to update student'
    );
  },

  setRecord: async (record) => {
    const classId = get().currentClassId;
    if (!classId) return;
    await runSwallowedAction(
      async () => {
        const existingRecord = get().records.find(
          (r) => r.studentId === record.studentId && r.date === record.date
        );

        await api.saveRecords([{ ...record, classId }] as AttendanceRecordWithClassId[]);

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
      },
      undefined,
      'Failed to save attendance record'
    );
  },

  undoLastAttendance: async () => {
    const lastChange = get().lastAttendanceChange;
    if (!lastChange) return;

    const classId = get().currentClassId;
    if (!classId) return;

    await runSwallowedAction(
      async () => {
        if (lastChange.status) {
          await api.saveRecords([{ ...lastChange, classId }] as unknown as AttendanceRecordWithClassId[]);
        } else {
          await api.saveRecords([{ ...lastChange, classId, status: 'Present', reason: undefined }] as unknown as AttendanceRecordWithClassId[]);
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
      },
      'Attendance undone',
      'Failed to undo attendance'
    );
  },

  markAllPresent: async (date) => {
    const classId = get().currentClassId;
    if (!classId) return;
    const students = get().students.filter(s => !s.isArchived);
    const existingRecords = get().records;

    const newRecords: AttendanceRecord[] = students
      .filter(s => !existingRecords.some(r => r.studentId === s.id && r.date === date))
      .map(s => ({ studentId: s.id, date, status: 'Present' as AttendanceStatus }));

    if (newRecords.length === 0) return;

    await runSwallowedAction(
      async () => {
        await api.saveRecords(newRecords.map(r => ({ ...r, classId })));
        set((state) => updateCurrentClass(state, {
          records: [...state.records, ...newRecords]
        }));
      },
      `${newRecords.length} students marked present`,
      'Failed to mark all present'
    );
  },

  setDailyNote: async (date, note) => {
    const classId = get().currentClassId;
    if (!classId) return;
    await runSwallowedAction(
      async () => {
        await api.saveDailyNote(classId, date, note);
        set((state) => updateCurrentClass(state, {
          dailyNotes: { ...state.dailyNotes, [date]: note },
        }));
      },
      undefined,
      'Failed to save daily note'
    );
  },

  addEvent: async (event) => {
    const classId = get().currentClassId;
    if (!classId) return;
    await runSwallowedAction(
      async () => {
        await api.createEvents(classId, [event]);
        set((state) => updateCurrentClass(state, { events: [...state.events, event] }));
      },
      'Event added',
      'Failed to add event'
    );
  },

  addEvents: async (newEvents) => {
    const classId = get().currentClassId;
    if (!classId) return;
    await runSwallowedAction(
      async () => {
        await api.createEvents(classId, newEvents);
        set((state) => updateCurrentClass(state, { events: [...state.events, ...newEvents] }));
      },
      undefined,
      'Failed to import events'
    );
  },

  updateEvent: async (id, data) => {
    await runSwallowedAction(
      async () => {
        await api.updateEvent(id, data);
        set((state) => updateCurrentClass(state, {
          events: state.events.map((e) => (e.id === id ? { ...e, ...data } : e)),
        }));
      },
      undefined,
      'Failed to update event'
    );
  },

  removeEvent: async (id) => {
    await runSwallowedAction(
      async () => {
        await api.deleteEvent(id);
        set((state) => updateCurrentClass(state, { events: state.events.filter((e) => e.id !== id) }));
      },
      'Event removed',
      'Failed to remove event'
    );
  },

  addTimetableSlot: async (slot) => {
    const classId = get().currentClassId;
    if (!classId) return;
    await runSwallowedAction(
      async () => {
        await api.createTimetableSlot(classId, slot);
        set((state) => updateCurrentClass(state, { timetable: [...state.timetable, slot] }));
      },
      undefined,
      'Failed to add timetable slot'
    );
  },

  updateTimetableSlot: async (id, data) => {
    await runSwallowedAction(
      async () => {
        await api.updateTimetableSlot(id, data);
        set((state) => updateCurrentClass(state, {
          timetable: state.timetable.map((s) => (s.id === id ? { ...s, ...data } : s)),
        }));
      },
      undefined,
      'Failed to update timetable slot'
    );
  },

  removeTimetableSlot: async (id) => {
    await runSwallowedAction(
      async () => {
        await api.deleteTimetableSlot(id);
        set((state) => updateCurrentClass(state, { timetable: state.timetable.filter((s) => s.id !== id) }));
      },
      undefined,
      'Failed to remove timetable slot'
    );
  },

  updateSeat: async (seatId, studentId) => {
    const classId = get().currentClassId;
    if (!classId) return;
    await runSwallowedAction(
      async () => {
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
      },
      undefined,
      'Failed to update seating chart'
    );
  },

  setSeatingLayout: async (layout) => {
    const classId = get().currentClassId;
    if (!classId) return;
    await runSwallowedAction(
      async () => {
        await api.saveSeatingLayout(classId, layout);
        set((state) => updateCurrentClass(state, { seatingLayout: layout }));
      },
      'Seating layout saved',
      'Failed to save layout'
    );
  },

  clearSeatingLayout: async () => {
    const classId = get().currentClassId;
    if (!classId) return;
    await runSwallowedAction(
      async () => {
        await api.clearSeating(classId);
        set((state) => updateCurrentClass(state, { seatingLayout: {} }));
      },
      undefined,
      'Failed to clear seating'
    );
  },

  toggleTheme: async () => {
    const newTheme = get().theme === 'light' ? 'dark' : 'light';
    await runSwallowedAction(
      async () => {
        await api.saveSetting('theme', newTheme);
        set({ theme: newTheme });
      },
      undefined,
      'Failed to update theme'
    );
  },

  clearData: async () => {
    const classId = get().currentClassId;
    if (!classId) return;

    const className = get().classes.find(c => c.id === classId)?.name || 'Class';

    await runSwallowedAction(
      async () => {
        await api.deleteClass(classId);
        await api.createClass({ id: classId, name: className });

        set((state) => updateCurrentClass(state, { students: [], records: [], dailyNotes: {}, events: [], timetable: [], seatingLayout: {} }));
      },
      'Class data cleared',
      'Failed to clear class data'
    );
  },

  clearAllData: async () => {
    await runSwallowedAction(
      async () => {
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

        let currentIsAdmin = get().isAdmin;
        try {
          const me = await api.getMe();
          currentIsAdmin = me.isAdmin;
        } catch {
          // Keep existing admin flag if profile refresh fails.
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

        return failed;
      },
      (failed) => failed.length > 0
        ? `All data cleared (${failed.length} classes failed to delete)`
        : 'All data cleared successfully',
      'Failed to clear all data'
    );
  },

  updateAdminPassword: async (password) => {
    await runSwallowedAction(
      async () => {
        await api.saveSetting('adminPassword', password);
      },
      'Admin password updated',
      'Failed to update admin password'
    );
  },

  setRecordForClass: async (classId, record) => {
    await runSwallowedAction(
      async () => {
        await api.saveRecords([{ ...record, classId }] as AttendanceRecordWithClassId[]);

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
      },
      undefined,
      'Failed to save attendance record'
    );
  },
}));

export const useActiveStudents = () => useStore(
  (state) => state.students.filter(s => !s.isArchived)
);

export type { AppState, ClassData, Student, AttendanceRecord, CalendarEvent, TimetableSlot, AttendanceStatus, EventType };