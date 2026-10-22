import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { selectHasComplaintsAccess, selectIsAdmin, selectIsAuthenticated } from '@/redux/authSlice';
import { useAppSelector } from '@/redux/hooks';

export function RequireAuth({ children }: { children: ReactNode }) {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const location = useLocation();

  if (!isAuthenticated) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return children;
}

function NoAccess({ what }: { what: string }) {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-xl font-semibold">You don't have access to {what}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Ask an HR admin to give your account access.</p>
    </div>
  );
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const isAdmin = useAppSelector(selectIsAdmin);
  return isAdmin ? children : <NoAccess what="user management" />;
}

export function RequireComplaintsAccess({ children }: { children: ReactNode }) {
  const allowed = useAppSelector(selectHasComplaintsAccess);
  return allowed ? children : <NoAccess what="complaints" />;
}
