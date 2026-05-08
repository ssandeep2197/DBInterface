import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ConnectionOptions } from '@dbi/shared';
import { auth } from '../api/endpoints';

export function useSession() {
  return useQuery({ queryKey: ['session'], queryFn: auth.session });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opts: ConnectionOptions) => auth.login(opts),
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
