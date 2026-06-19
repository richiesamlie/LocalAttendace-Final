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
      const result = await api.verifyAuth() as { authenticated: boolean; teacherId?: string; name?: string; isAdmin?: boolean };
      if (result.authenticated && result.teacherId) {
        try {
          const teacher = await api.getMe();
          setAuth(result.teacherId, teacher.name, teacher.isAdmin);
        } catch {
          // Fallback to /auth/verify payload instead of force-downgrading to non-admin.
          setAuth(result.teacherId, result.name || 'Teacher', !!result.isAdmin);
        }
      } else {
        clearAuth();
      }
      return result;
    },

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