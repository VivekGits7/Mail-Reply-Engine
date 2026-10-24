import { useState, type KeyboardEvent } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { setCredentials } from '@/redux/authSlice';
import { useAppDispatch } from '@/redux/hooks';
import { Field } from '@/components/common/Field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { applyServerErrors } from '@/utils/formErrors';
import { getErrorMessage } from '@/utils/apiError';
import { fieldProps } from '@/utils/fieldProps';
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

export function LoginForm({ onSuccess }: { onSuccess?: () => void }) {
  const dispatch = useAppDispatch();
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockActive, setCapsLockActive] = useState(false);

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
      dispatch(setCredentials({ token: res.access_token, user: res.user }));
      onSuccess?.();
    },
    onError: (error) => {
      if (!applyServerErrors(error, setError)) {
        setError('root', { message: getErrorMessage(error) });
      }
    },
  });

  const checkCapsLock = (e: KeyboardEvent<HTMLInputElement>) => {
    setCapsLockActive(e.getModifierState('CapsLock'));
  };

  const emailFieldProps = fieldProps('email', errors.email?.message);
  const passwordFieldProps = fieldProps('password', errors.password?.message);

  return (
    <form
      onSubmit={handleSubmit((values) => login.mutate(values))}
      noValidate
      className="flex flex-col gap-4"
    >
      <Field id="email" label="Work email" error={errors.email?.message}>
        <Input
          type="email"
          autoComplete="username"
          spellCheck={false}
          autoFocus
          placeholder="colleague@tcgdigital.com"
          className="h-10 text-sm"
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
            className="h-10 pr-10 text-sm"
            onKeyDown={checkCapsLock}
            onKeyUp={checkCapsLock}
            {...passwordFieldProps}
            {...register('password')}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-2.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {showPassword ? (
              <EyeOff className="size-4" aria-hidden="true" />
            ) : (
              <Eye className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>
        {capsLockActive && (
          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
            Caps Lock is active
          </p>
        )}
      </Field>

      {errors.root && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span className="font-medium leading-snug">{errors.root.message}</span>
        </div>
      )}

      <Button
        type="submit"
        size="lg"
        disabled={login.isPending}
        className="mt-1 h-10 w-full font-medium"
      >
        {login.isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Signing in…
          </>
        ) : (
          'Sign in'
        )}
      </Button>
    </form>
  );
}
