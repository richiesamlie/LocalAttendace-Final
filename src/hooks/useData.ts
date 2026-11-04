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
      const result = await api.verifyAuth();
      if (result.authenticated && result.teacherId) {
        if (result.name !== undefined && result.isAdmin !== undefined) {
          setAuth(result.teacherId, result.name, !!result.isAdmin, {
            schoolId: result.schoolId,
            schoolCode: result.schoolCode,
            schoolName: result.schoolName,
          });
        } else {
          try {
            const teacher = await api.getMe();
            setAuth(result.teacherId, teacher.name, teacher.isAdmin, {
              schoolId: teacher.schoolId,
              schoolCode: teacher.schoolCode,
              schoolName: teacher.schoolName,
            });
          } catch {
            // Fallback to /auth/verify payload instead of force-downgrading to non-admin.
            setAuth(result.teacherId, result.name || 'Teacher', !!result.isAdmin, {
              schoolId: result.schoolId,
              schoolCode: result.schoolCode,
              schoolName: result.schoolName,
            });
          }
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
    mutationFn: ({ username, password, schoolCode }: { username: string; password: string; schoolCode?: string }) =>
      api.login(username, password, schoolCode),
    onSuccess: (data) => {
      if (data.success) {
        setAuth(data.teacherId, data.name, data.isAdmin, {
          schoolId: data.schoolId,
          schoolCode: data.schoolCode,
          schoolName: data.schoolName,
        });
        queryClient.invalidateQueries({ queryKey: queryKeys.auth });
      }
    },
  });
}

export function useRegisterSchool() {
  const queryClient = useQueryClient();
  const setAuth = useStore((state) => state.setAuth);

  return useMutation({
    mutationFn: (payload: { schoolName: string; schoolCode: string; username: string; password: string; adminName: string }) =>
      api.registerSchool(payload),
    onSuccess: (data) => {
      if (data.success) {
        setAuth(data.teacherId, data.name, data.isAdmin, {
          schoolId: data.schoolId,
          schoolCode: data.schoolCode,
          schoolName: data.schoolName,
        });
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

// --- Background Fallback Sync Hook ---

export function useClassSync(intervalMs: number = 30000) {
  const currentClassId = useStore((state) => state.currentClassId);
  const reloadClassData = useStore((state) => state.reloadClassData);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Store in a ref so the interval callback always has the latest version
  // without causing the effect to re-run (and reset the interval) on every render.
  const reloadClassDataRef = useRef(reloadClassData);
  useEffect(() => { reloadClassDataRef.current = reloadClassData; }, [reloadClassData]);

  useEffect(() => {
    if (!currentClassId) return;

    const checkForUpdates = async () => {
      try {
        await reloadClassDataRef.current(currentClassId);
      } catch {
        // Silently ignore sync errors
      }
    };

    intervalRef.current = setInterval(checkForUpdates, intervalMs);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [currentClassId, intervalMs]); // reloadClassData excluded — accessed via ref
}
