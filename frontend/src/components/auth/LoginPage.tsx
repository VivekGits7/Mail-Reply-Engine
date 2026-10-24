import { useEffect, useState } from 'react';
import { Mail, Moon, Sun } from 'lucide-react';
import { motion, useAnimate, useReducedMotion } from 'motion/react';
import { useTheme } from 'next-themes';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { selectIsAuthenticated } from '@/redux/authSlice';
import { useAppSelector } from '@/redux/hooks';
import { preloadPages, whenIdle } from '@/components/pages';
import { Orb } from '@/components/visual/Orb';
import { EASE_FLUID } from '@/utils/animations';
import { LoginForm, type LoginFeedback } from './LoginForm';

function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

const SHAKE = [0, -14, 12, -9, 7, -4, 2, 0];

function Aurora() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -top-40 -left-32 size-[34rem] animate-drift rounded-full bg-azure/25 blur-3xl dark:bg-iris/20" />
      <div
        className="absolute top-1/3 -right-40 size-[30rem] animate-drift rounded-full bg-iris/20 blur-3xl dark:bg-azure/15"
        style={{ animationDelay: '-7s' }}
      />
      <div
        className="absolute -bottom-48 left-1/4 size-[28rem] animate-drift rounded-full bg-mint/15 blur-3xl"
        style={{ animationDelay: '-13s' }}
      />
      <div className="absolute inset-0 [background-image:radial-gradient(color-mix(in_oklch,var(--foreground)_9%,transparent)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_center,black_10%,transparent_70%)] [background-size:22px_22px]" />
    </div>
  );
}

export default function LoginPage() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(params.get('next'));
  const { resolvedTheme, setTheme } = useTheme();
  const reduced = useReducedMotion();
  const [scope, animate] = useAnimate();
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    whenIdle(() => preloadPages(['layout', 'overview']));
  }, []);

  if (isAuthenticated) return <Navigate to={next} replace />;

  function feedback(kind: LoginFeedback) {
    if (kind === 'success') {
      setSuccess(true);
      return;
    }
    if (!reduced && scope.current)
      void animate(scope.current, { x: SHAKE }, { duration: 0.5, ease: 'easeInOut' });
  }

  const dark = resolvedTheme === 'dark';

  return (
    <main className="relative flex min-h-svh w-full items-center justify-center overflow-hidden px-4 py-24">
      <Aurora />

      <motion.div
        className="absolute top-5 left-5"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE_FLUID }}
      >
        <Link
          to="/welcome"
          title="About HR Desk"
          className="group/brand flex items-center gap-2.5 rounded-2xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <span className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_8px_20px_-10px_var(--primary)] transition-transform duration-200 ease-(--ease-fluid) group-hover/brand:scale-105">
            <Mail className="size-5" aria-hidden="true" />
          </span>
          <span className="leading-tight">
            <span className="block text-[0.7rem] font-medium tracking-[0.12em] text-muted-foreground uppercase">
              TCG Digital
            </span>
            <span className="block text-sm font-semibold tracking-tight">Mail Reply Engine</span>
          </span>
        </Link>
      </motion.div>

      <button
        type="button"
        onClick={() => setTheme(dark ? 'light' : 'dark')}
        aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
        className="absolute top-5 right-5 flex size-11 items-center justify-center pill rounded-full text-foreground/80 transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Sun
          className="size-4.5 scale-100 rotate-0 transition-transform duration-300 dark:scale-0 dark:-rotate-90"
          aria-hidden="true"
        />
        <Moon
          className="absolute size-4.5 scale-0 rotate-90 transition-transform duration-300 dark:scale-100 dark:rotate-0"
          aria-hidden="true"
        />
      </button>

      <motion.div
        className="relative z-10 w-full max-w-[26rem]"
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={success && !reduced ? { opacity: 1, y: -6, scale: 1.01 } : { opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: EASE_FLUID }}
      >
        <motion.div
          className="relative z-10 mx-auto -mb-14 flex w-fit justify-center"
          animate={
            success && !reduced
              ? { scale: [1, 1.12, 1.04], filter: ['brightness(1)', 'brightness(1.25)', 'brightness(1.1)'] }
              : {}
          }
          transition={{ duration: 0.7, ease: EASE_FLUID }}
        >
          <Orb className="size-28" />
          {success && !reduced && (
            <motion.span
              aria-hidden="true"
              className="absolute inset-0 rounded-full border-2 border-mint"
              initial={{ scale: 0.9, opacity: 0.9 }}
              animate={{ scale: 2.2, opacity: 0 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          )}
        </motion.div>

        <div ref={scope} className="panel px-6 pt-18 pb-7 sm:px-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.15, ease: EASE_FLUID }}
            className="mb-7 text-center"
          >
            <h1 className="text-[1.9rem] leading-tight font-normal tracking-[-0.035em]">Welcome back</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">Sign in to HR Desk with your work email.</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.25, ease: EASE_FLUID }}
          >
            <LoginForm onFeedback={feedback} onSuccess={() => navigate(next, { replace: true })} />
          </motion.div>
        </div>

        <motion.p
          className="mt-5 text-center text-xs text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          Accounts are provisioned by an HR administrator.
        </motion.p>
      </motion.div>
    </main>
  );
}
