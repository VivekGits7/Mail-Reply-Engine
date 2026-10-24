import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { setCredentials } from '@/redux/authSlice';
import { useAppDispatch } from '@/redux/hooks';
import { Field } from '@/components/common/Field';
import { Input } from '@/components/ui/input';
import { cn } from '@/utils/cn';
import { applyServerErrors } from '@/utils/formErrors';
import { getErrorMessage } from '@/utils/apiError';
import { fieldProps } from '@/utils/fieldProps';
import { EASE_FLUID } from '@/utils/animations';
import { authApi } from './Authapi';

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Enter your work email address')
    .email('Enter a valid email address')
    .max(255, 'Email cannot exceed 255 characters'),
  password: z
    .string()
    .min(1, 'Enter your password')
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password cannot exceed 128 characters'),
});

type LoginValues = z.infer<typeof loginSchema>;
export type LoginFeedback = 'error' | 'success';

const SUCCESS_HOLD_MS = 650;
const SWAP = {
  initial: { opacity: 0, y: 10, filter: 'blur(2px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -10, filter: 'blur(2px)' },
  transition: { duration: 0.22, ease: EASE_FLUID },
};

function DrawnCheck() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
      <motion.circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="2"
        initial={{ pathLength: 0, opacity: 0.4 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.35, ease: EASE_FLUID }}
      />
      <motion.path
        d="M7.5 12.5l3 3 6-6.5"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.3, delay: 0.22, ease: EASE_FLUID }}
      />
    </svg>
  );
}

interface LoginFormProps {
  onSuccess?: () => void;
  onFeedback?: (kind: LoginFeedback) => void;
}

export function LoginForm({ onSuccess, onFeedback }: LoginFormProps) {
  const dispatch = useAppDispatch();
  const reduced = useReducedMotion();
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockActive, setCapsLockActive] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onTouched',
    defaultValues: { email: '', password: '' },
  });

  const login = useMutation({
    mutationFn: ({ email, password }: LoginValues) => authApi.login(email, password),
    onSuccess: (res) => {
      setSignedIn(true);
      onFeedback?.('success');
      // Hold the session until the success animation plays, because storing it redirects right away.
      timer.current = setTimeout(
        () => {
          dispatch(setCredentials({ token: res.access_token, user: res.user }));
          onSuccess?.();
        },
        reduced ? 0 : SUCCESS_HOLD_MS,
      );
    },
    onError: (error) => {
      if (!applyServerErrors(error, setError)) {
        setError('root', { message: getErrorMessage(error) });
      }
      onFeedback?.('error');
    },
  });

  const checkCapsLock = (e: KeyboardEvent<HTMLInputElement>) => {
    setCapsLockActive(e.getModifierState('CapsLock'));
  };

  const emailFieldProps = fieldProps('email', errors.email?.message);
  const passwordFieldProps = fieldProps('password', errors.password?.message);
  const busy = login.isPending || signedIn;
  const state = signedIn ? 'success' : login.isPending ? 'pending' : 'idle';

  return (
    <form
      onSubmit={handleSubmit(
        (values) => login.mutate(values),
        () => onFeedback?.('error'),
      )}
      noValidate
      className="flex flex-col gap-4"
    >
      <Field id="email" label="Work email" error={errors.email?.message}>
        <Input
          type="email"
          autoComplete="username"
          spellCheck={false}
          autoFocus
          disabled={signedIn}
          placeholder="colleague@tcgdigital.com"
          className="h-12 rounded-2xl px-4 text-sm"
          {...emailFieldProps}
          {...register('email')}
        />
      </Field>

      <Field id="password" label="Password" error={errors.password?.message}>
        <div className="relative">
          <Input
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="••••••••••••"
            disabled={signedIn}
            className="h-12 rounded-2xl px-4 pr-12 text-sm"
            onKeyDown={checkCapsLock}
            onKeyUp={checkCapsLock}
            {...passwordFieldProps}
            {...register('password')}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute top-1/2 right-2.5 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={showPassword ? 'hide' : 'show'}
                initial={{ opacity: 0, rotate: -45, scale: 0.6 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={{ opacity: 0, rotate: 45, scale: 0.6 }}
                transition={{ duration: 0.16 }}
                className="flex"
              >
                {showPassword ? (
                  <EyeOff className="size-4" aria-hidden="true" />
                ) : (
                  <Eye className="size-4" aria-hidden="true" />
                )}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>
        <AnimatePresence initial={false}>
          {capsLockActive && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mt-1 text-xs text-warning"
            >
              Caps Lock is active
            </motion.p>
          )}
        </AnimatePresence>
      </Field>

      <AnimatePresence initial={false}>
        {errors.root && (
          <motion.div
            role="alert"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.22, ease: EASE_FLUID }}
            className="flex items-start gap-2.5 rounded-2xl border border-destructive/20 bg-destructive/8 p-3 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span className="leading-snug font-medium">{errors.root.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="submit"
        disabled={busy}
        whileTap={busy ? undefined : { scale: 0.97 }}
        animate={signedIn && !reduced ? { scale: [1, 1.03, 1] } : { scale: 1 }}
        transition={{ duration: 0.4, ease: EASE_FLUID }}
        className={cn(
          'group relative mt-2 flex h-12 w-full items-center justify-center overflow-hidden rounded-full text-sm font-medium transition-[background-color,box-shadow] duration-300 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-default',
          signedIn
            ? 'bg-mint text-white shadow-[0_14px_30px_-12px_var(--mint)] dark:text-black'
            : 'bg-primary text-primary-foreground shadow-[0_14px_30px_-14px_var(--primary)] hover:shadow-[0_18px_34px_-12px_var(--primary)]',
        )}
      >
        {!busy && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 w-1/3 animate-sweep bg-linear-to-r from-transparent via-white/25 to-transparent"
          />
        )}
        <AnimatePresence mode="wait" initial={false}>
          {state === 'success' ? (
            <motion.span key="success" {...SWAP} className="relative flex items-center gap-2">
              <DrawnCheck />
              Welcome back
            </motion.span>
          ) : state === 'pending' ? (
            <motion.span key="pending" {...SWAP} className="relative flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Signing in…
            </motion.span>
          ) : (
            <motion.span key="idle" {...SWAP} className="relative flex items-center gap-2">
              Sign in
              <ArrowRight
                className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
      <span role="status" className="sr-only">
        {signedIn ? 'Signed in, opening the desk' : ''}
      </span>
    </form>
  );
}
