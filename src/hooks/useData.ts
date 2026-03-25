import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

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
