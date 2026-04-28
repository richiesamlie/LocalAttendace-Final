import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useStore } from '../store';

export const queryKeys = {
  auth: ['auth'] as const,
  classes: ['classes'] as const,
  settings: ['settings'] as const,
  students: (classId: string) => ['students', classId] as const,
  records: (classId: string) => ['records', classId] as const,
  events: (classId: string) => ['events', classId] as const,
  timetable: (classId: string) => ['timetable', classId] as const,
  seating: (classId: string) => ['seating', classId] as const,
  dailyNotes: (classId: string) => ['dailyNotes', classId] as const,
  classTeachers: (classId: string) => ['classTeachers', classId] as const,
  classInvites: (classId: string) => ['classInvites', classId] as const,
  sessions: ['sessions'] as const,
  teachers: ['teachers'] as const,
};

export function useAuth() {
  const setAuth = useStore((state) => state.setAuth);
  const clearAuth = useStore((state) => state.clearAuth);
  
  return useQuery({
    queryKey: queryKeys.auth,
    queryFn: async () => {
      const result = await api.verifyAuth() as { authenticated: boolean; teacherId?: string; name?: string };
      if (result.authenticated && result.teacherId) {
        try {
          const teacher = await api.getMe();
          setAuth(result.teacherId!, teacher.name, teacher.isAdmin);
        } catch {
          setAuth(result.teacherId!, 'Teacher', false);
        }
      } else {
        clearAuth();
      }
      return result;
    },
    retry: false,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  const setAuth = useStore((state) => state.setAuth);
  
  return useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) => api.login(username, password),
    onSuccess: (data) => {
      if (data.success) {
        setAuth(data.teacherId, data.name, data.isAdmin);
        queryClient.invalidateQueries({ queryKey: queryKeys.auth });
      }
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const clearAuth = useStore((state) => state.clearAuth);
  
  return useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      clearAuth();
      queryClient.setQueryData(queryKeys.auth, { authenticated: false });
      queryClient.clear();
    },
  });
}

// --- Data Fetching Hooks (Request Deduplication) ---

export function useClasses() {
  return useQuery({
    queryKey: queryKeys.classes,
    queryFn: () => api.getClasses() as ReturnType<typeof api.getClasses>,
    staleTime: 30000,
  });
}

export function useStudents(classId: string | null) {
  return useQuery({
    queryKey: queryKeys.students(classId ?? ''),
    queryFn: () => classId ? api.getStudents(classId, false) : Promise.resolve([]),
    enabled: !!classId,
    staleTime: 5000,
  });
}

export function useRecords(classId: string | null) {
  return useQuery({
    queryKey: queryKeys.records(classId ?? ''),
    queryFn: () => classId ? api.getRecords(classId) : Promise.resolve([]),
    enabled: !!classId,
    staleTime: 5000,
  });
}

export function useEvents(classId: string | null) {
  return useQuery({
    queryKey: queryKeys.events(classId ?? ''),
    queryFn: () => classId ? api.getEvents(classId) : Promise.resolve([]),
    enabled: !!classId,
    staleTime: 5000,
  });
}

export function useTimetable(classId: string | null) {
  return useQuery({
    queryKey: queryKeys.timetable(classId ?? ''),
    queryFn: () => classId ? api.getTimetable(classId) : Promise.resolve([]),
    enabled: !!classId,
    staleTime: 5000,
  });
}

export function useSeating(classId: string | null) {
  return useQuery({
    queryKey: queryKeys.seating(classId ?? ''),
    queryFn: () => classId ? api.getSeating(classId) : Promise.resolve({}),
    enabled: !!classId,
    staleTime: 5000,
  });
}

export function useDailyNotes(classId: string | null) {
  return useQuery({
    queryKey: queryKeys.dailyNotes(classId ?? ''),
    queryFn: () => classId ? api.getDailyNotes(classId) : Promise.resolve({}),
    enabled: !!classId,
    staleTime: 5000,
  });
}

export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => api.getSettings() as ReturnType<typeof api.getSettings>,
    staleTime: 30000,
  });
}

// --- Mutations with Auto-Invalidation ---

export function useCreateStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ classId, student }: { classId: string; student: Parameters<typeof api.createStudent>[1] }) =>
      api.createStudent(classId, student),
    onSuccess: (_, { classId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.students(classId) });
    },
  });
}

export function useUpdateStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ studentId, data }: { studentId: string; data: Parameters<typeof api.updateStudent>[1] }) =>
      api.updateStudent(studentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });
}

export function useDeleteStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (studentId: string) => api.deleteStudent(studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });
}

export function useSyncStudents() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ classId, students }: { classId: string; students: Parameters<typeof api.syncStudents>[1] }) =>
      api.syncStudents(classId, students),
    onSuccess: (_, { classId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.students(classId) });
    },
  });
}

export function useSaveRecords() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ records }: { records: Parameters<typeof api.saveRecords>[0]; classId: string }) => 
      api.saveRecords(records),
    onSuccess: (_, { classId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.records(classId) });
    },
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ classId, events }: { classId: string; events: Parameters<typeof api.createEvents>[1] }) =>
      api.createEvents(classId, events),
    onSuccess: (_, { classId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.events(classId) });
    },
  });
}

export function useUpdateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, data }: { eventId: string; data: Parameters<typeof api.updateEvent>[1] }) =>
      api.updateEvent(eventId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => api.deleteEvent(eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

export function useCreateTimetableSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ classId, slot }: { classId: string; slot: Parameters<typeof api.createTimetableSlot>[1] }) =>
      api.createTimetableSlot(classId, slot),
    onSuccess: (_, { classId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.timetable(classId) });
    },
  });
}

export function useUpdateTimetableSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ slotId, data }: { slotId: string; data: Parameters<typeof api.updateTimetableSlot>[1] }) =>
      api.updateTimetableSlot(slotId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable'] });
    },
  });
}

export function useDeleteTimetableSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (slotId: string) => api.deleteTimetableSlot(slotId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable'] });
    },
  });
}

export function useUpdateSeat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ classId, seatId, studentId }: { classId: string; seatId: string; studentId: string | null }) =>
      api.updateSeat(classId, seatId, studentId),
    onSuccess: (_, { classId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seating(classId) });
    },
  });
}

export function useSaveSeatingLayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ classId, layout }: { classId: string; layout: Record<string, string> }) =>
      api.saveSeatingLayout(classId, layout),
    onSuccess: (_, { classId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seating(classId) });
    },
  });
}

export function useClearSeating() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (classId: string) => api.clearSeating(classId),
    onSuccess: (_, classId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seating(classId) });
    },
  });
}

export function useSaveDailyNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ classId, date, note }: { classId: string; date: string; note: string }) =>
      api.saveDailyNote(classId, date, note),
    onSuccess: (_, { classId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dailyNotes(classId) });
    },
  });
}

export function useCreateClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cls: Parameters<typeof api.createClass>[0]) => api.createClass(cls),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.classes });
    },
  });
}

export function useUpdateClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.updateClass(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.classes });
    },
  });
}

export function useDeleteClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteClass(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.classes });
    },
  });
}

export function useSaveSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => api.saveSetting(key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    },
  });
}

// --- Sync Hook (Uses React Query for Deduplication) ---

export function useClassSync(intervalMs: number = 30000) {
  const currentClassId = useStore((state) => state.currentClassId);
  const reloadClassData = useStore((state) => state.reloadClassData);
  const queryClient = useQueryClient();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastFingerprintRef = useRef<string>('');
  // Store in a ref so the interval callback always has the latest version
  // without causing the effect to re-run (and reset the interval) on every render.
  const reloadClassDataRef = useRef(reloadClassData);
  useEffect(() => { reloadClassDataRef.current = reloadClassData; }, [reloadClassData]);

  useEffect(() => {
    if (!currentClassId) return;

    const checkForUpdates = async () => {
      try {
        const [students, records, events, timetable, seating] = await Promise.all([
          queryClient.fetchQuery({ queryKey: queryKeys.students(currentClassId), queryFn: () => api.getStudents(currentClassId, false) }),
          queryClient.fetchQuery({ queryKey: queryKeys.records(currentClassId), queryFn: () => api.getRecords(currentClassId) }),
          queryClient.fetchQuery({ queryKey: queryKeys.events(currentClassId), queryFn: () => api.getEvents(currentClassId) }),
          queryClient.fetchQuery({ queryKey: queryKeys.timetable(currentClassId), queryFn: () => api.getTimetable(currentClassId) }),
          queryClient.fetchQuery({ queryKey: queryKeys.seating(currentClassId), queryFn: () => api.getSeating(currentClassId) }),
        ]);

        const fingerprint = `${students.length}:${records.length}:${events.length}:${timetable.length}:${Object.keys(seating).length}`;
        if (fingerprint !== lastFingerprintRef.current && lastFingerprintRef.current !== '') {
          await reloadClassDataRef.current(currentClassId);
        }
        lastFingerprintRef.current = fingerprint;
      } catch {
        // Silently ignore sync errors
      }
    };

    checkForUpdates();

    intervalRef.current = setInterval(checkForUpdates, intervalMs);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [currentClassId, intervalMs, queryClient]); // reloadClassData excluded — accessed via ref
}
