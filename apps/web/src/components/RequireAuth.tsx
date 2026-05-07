import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useSession } from '../hooks/useSession';

export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { data, isLoading } = useSession();

  if (isLoading) {
    return <div className="loading">Checking session…</div>;
  }
  if (!data?.authenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <>{children}</>;
}
