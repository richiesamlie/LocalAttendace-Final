import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useStore } from '../store';

export function useAuth() {
  return useQuery({
    queryKey: ['auth'],
    queryFn: api.verifyAuth,
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
        setAuth(data.teacherId, data.username);
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
