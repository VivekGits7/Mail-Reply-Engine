import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { setCredentials } from '@/redux/authSlice';
import { useAppDispatch } from '@/redux/hooks';
import { Field } from '@/components/common/Field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fieldProps } from '@/utils/fieldProps';
import { getErrorMessage } from '@/utils/apiError';
import { applyServerErrors } from '@/utils/formErrors';
import { authApi } from './Authapi';

const loginSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm({ onSuccess }: { onSuccess?: () => void }) {
  const dispatch = useAppDispatch();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  const login = useMutation({
    mutationFn: ({ email, password }: LoginValues) => authApi.login(email, password),
    onSuccess: (res) => {
      dispatch(setCredentials({ token: res.access_token, user: res.user }));
      onSuccess?.();
    },
    onError: (error) => {
      if (!applyServerErrors(error, setError)) setError('root', { message: getErrorMessage(error) });
    },
  });

  return (
    <form onSubmit={handleSubmit((values) => login.mutate(values))} noValidate className="flex flex-col gap-4">
      <Field id="email" label="Work email" error={errors.email?.message}>
        <Input
          type="email"
          autoComplete="username"
          spellCheck={false}
          autoFocus
          {...fieldProps('email', errors.email?.message)}
          {...register('email')}
        />
      </Field>
      <Field id="password" label="Password" error={errors.password?.message}>
        <Input
          type="password"
          autoComplete="current-password"
          {...fieldProps('password', errors.password?.message)}
          {...register('password')}
        />
      </Field>
      {errors.root && (
        <p role="alert" className="text-sm text-destructive">
          {errors.root.message}
        </p>
      )}
      <Button type="submit" size="lg" disabled={login.isPending} className="w-full">
        {login.isPending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
