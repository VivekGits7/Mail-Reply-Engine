import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { Mail, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { selectIsAuthenticated } from '@/redux/authSlice';
import { useAppSelector } from '@/redux/hooks';
import { Button } from '@/components/ui/button';
import { LoginForm } from './LoginForm';

function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

export default function LoginPage() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(params.get('next'));
  const { theme, setTheme } = useTheme();

  if (isAuthenticated) return <Navigate to={next} replace />;

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <main className="relative flex h-svh max-h-svh w-full overflow-hidden bg-background font-sans antialiased">
      {/* Theme Toggle Top Right */}
      <div className="absolute right-4 top-4 z-30">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
        >
          <Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>
      </div>

      {/* LEFT PANE: Photo Showcase with Seamless Soft Edge Blend */}
      <section className="relative hidden h-full w-full flex-1 flex-col justify-between overflow-hidden p-6 lg:flex lg:max-w-lg xl:max-w-xl xl:p-8">
        {/* Full image with soft feathered right edge merging into the background */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <img
            src="/auth-hero.jpg"
            alt="TCG Digital Mail Reply Engine"
            className="size-full object-cover object-center opacity-90 select-none"
          />
          {/* Feathered right edge dissolves the boundary into the right pane seamlessly */}
          <div className="absolute inset-y-0 right-0 w-44 bg-gradient-to-r from-transparent via-background/60 to-background" />
          {/* Dedicated smooth dark backdrops so typography never collides with ribbon lines */}
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/75 via-black/35 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/95 via-black/75 to-transparent" />
        </div>

        {/* Top: Brand Header */}
        <div className="relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-blue-600/90 text-white shadow-md shadow-blue-500/20 backdrop-blur-xs">
              <Mail className="size-4" />
            </div>
            <div>
              <span className="block text-[10px] font-semibold tracking-wider text-blue-300 uppercase">
                TCG Digital
              </span>
              <span className="block text-xs font-semibold tracking-tight text-white drop-shadow-xs">
                Mail Reply Engine
              </span>
            </div>
          </div>
        </div>

        {/* Bottom: Refined Typography & Mission housed in a sleek frosted glass container */}
        <div className="relative z-10 max-w-md rounded-2xl border border-white/10 bg-slate-950/50 p-5.5 backdrop-blur-xl shadow-2xl ring-1 ring-white/5">
          <div className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
            <span className="text-[10px] font-mono tracking-widest text-blue-300 uppercase">
              People Operations Platform
            </span>
          </div>
          <h1 className="mt-2.5 text-2xl font-medium tracking-tight bg-gradient-to-b from-white via-slate-100 to-slate-300 bg-clip-text text-transparent xl:text-[28px] leading-tight">
            Autonomous HR email operations.
          </h1>
          <p className="mt-2 text-xs text-slate-300/90 leading-relaxed font-normal xl:text-[13px]">
            Coordinates pre-onboarding documents and multi-department exit clearances with human verification.
          </p>
          <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-[10px] font-mono text-slate-400">
            <span>People Operations Desk</span>
            <span>Enterprise Portal</span>
          </div>
        </div>
      </section>

      {/* RIGHT PANE: Focused Sign-In Terminal */}
      <section className="flex h-full flex-1 flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-sm sm:max-w-[380px]">
          {/* Mobile brand header (shown only when left pane is hidden) */}
          <div className="mb-4 flex items-center gap-2.5 lg:hidden">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Mail className="size-4" />
            </div>
            <div>
              <span className="block text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                TCG Digital
              </span>
              <span className="block text-xs font-semibold tracking-tight text-foreground">
                Mail Reply Engine
              </span>
            </div>
          </div>

          {/* Form Header */}
          <div className="mb-5">
            <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              Sign in to HR Desk
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Enter your work email and password to access the desk.
            </p>
          </div>

          {/* Form Card */}
          <div className="rounded-2xl border border-border/80 bg-card/85 p-5 shadow-lg backdrop-blur-md sm:p-7 dark:bg-card/40 dark:border-white/10">
            <LoginForm onSuccess={() => navigate(next, { replace: true })} />
          </div>

          {/* Footer Note */}
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Accounts are provisioned by an HR administrator.
          </p>
        </div>
      </section>
    </main>
  );
}
