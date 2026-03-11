import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { ClassData, Student, AttendanceRecord, CalendarEvent, TimetableSlot } from '../store';
import { useStore } from '../store';

export function useClasses() {
  return useQuery({
    queryKey: ['classes'],
    queryFn: api.getClasses,
  });
}

export function useCurrentClassData() {
  const currentClassId = useStore(state => state.currentClassId);
  const classesQuery = useClasses();
  return {
    isLoading: classesQuery.isLoading,
    classData: classesQuery.data?.find(c => c.id === currentClassId)
  };
}

export function useStudents(classId: string | null) {
  return useQuery({
    queryKey: ['students', classId],
    queryFn: () => classId ? api.getStudents(classId) : Promise.resolve([]),
    enabled: !!classId,
  });
}

// ... I will add other hooks dynamically as needed ...

export function useAuth() {
  return useQuery({
    queryKey: ['auth'],
    queryFn: api.verifyAuth,
    retry: false, // Don't retry auth checks if they fail (401)
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.login,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      queryClient.setQueryData(['auth'], { authenticated: false });
      queryClient.clear(); // Clear all cached data on logout
    },
  });
}
