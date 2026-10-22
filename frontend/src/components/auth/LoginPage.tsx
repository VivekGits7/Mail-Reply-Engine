import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { selectIsAuthenticated } from '@/redux/authSlice';
import { useAppSelector } from '@/redux/hooks';
import { LoginForm } from './LoginForm';

function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

export default function LoginPage() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(params.get('next'));

  if (isAuthenticated) return <Navigate to={next} replace />;

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <p className="text-sm font-medium text-primary">HR Desk</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Sign in to the mail desk</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Track joiners, exits and approvals the email agent is working on.
          </p>
        </div>
        <div className="rounded-lg border bg-card p-5">
          <LoginForm onSuccess={() => navigate(next, { replace: true })} />
        </div>
        <p className="mt-4 text-xs text-muted-foreground">Accounts are created by an HR admin.</p>
      </div>
    </main>
  );
}
