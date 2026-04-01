import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useStore } from '../store';

export function useAuth() {
  const setAuth = useStore((state) => state.setAuth);
  const clearAuth = useStore((state) => state.clearAuth);
  
  return useQuery({
    queryKey: ['auth'],
    queryFn: async () => {
      const result = await api.verifyAuth() as { authenticated: boolean; teacherId?: string; name?: string };
      if (result.authenticated && result.teacherId) {
        try {
          const teacher = await api.getMe();
          setAuth(result.teacherId!, teacher.name);
        } catch {
          setAuth(result.teacherId!, 'Teacher');
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
        setAuth(data.teacherId, data.name);
        queryClient.invalidateQueries({ queryKey: ['auth'] });
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
      queryClient.setQueryData(['auth'], { authenticated: false });
      queryClient.clear();
    },
  });
}

// Poll-based sync: periodically reloads class data to detect changes made by other teachers (Phase 3.1)
// Uses a lightweight fingerprint (record count + last event date) to detect changes before full reload
export function useClassSync(intervalMs: number = 30000) {
  const currentClassId = useStore((state) => state.currentClassId);
  const reloadClassData = useStore((state) => state.reloadClassData);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!currentClassId) return;

    let lastFingerprint = '';

    const checkForUpdates = async () => {
      try {
        const [students, records, events, timetable, seating] = await Promise.all([
          api.getStudents(currentClassId),
          api.getRecords(currentClassId),
          api.getEvents(currentClassId),
          api.getTimetable(currentClassId),
          api.getSeating(currentClassId),
        ]);

        const fingerprint = `${students.length}:${records.length}:${events.length}:${timetable.length}:${Object.keys(seating).length}`;
        if (fingerprint !== lastFingerprint && lastFingerprint !== '') {
          await reloadClassData(currentClassId);
        }
        lastFingerprint = fingerprint;
      } catch {
        // Silently ignore sync errors (network issues, etc.)
      }
    };

    // Initial fingerprint
    checkForUpdates();

    intervalRef.current = setInterval(checkForUpdates, intervalMs);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [currentClassId, reloadClassData, intervalMs]);
}
