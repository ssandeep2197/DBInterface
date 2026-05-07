import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { auth } from '../api/endpoints';

export function useSession() {
  return useQuery({ queryKey: ['session'], queryFn: auth.session });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (password: string) => auth.login(password),
    onSuccess: (data) => qc.setQueryData(['session'], data),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: auth.logout,
    onSuccess: (data) => {
      qc.setQueryData(['session'], data);
      qc.clear();
    },
  });
}
