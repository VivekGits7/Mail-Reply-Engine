import { useState, type ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { Field } from '@/components/common/Field';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { DateField } from '@/components/common/DateField';
import { fieldProps } from '@/utils/fieldProps';
import { getErrorMessage } from '@/utils/apiError';
import { applyServerErrors } from '@/utils/formErrors';
import { showToast } from '@/utils/toast';
import { exitKeys, exitsApi } from './Exitsapi';

const exitSchema = z.object({
  full_name: z.string().trim().min(2, 'Enter the employee name'),
  employee_code: z.string().trim().min(1, 'Enter the employee ID').max(32),
  work_email: z.email('Enter a valid work email'),
  manager_name: z.string().trim(),
  manager_email: z.email('Enter a valid manager email'),
  last_working_day: z.string().min(1, 'Pick the last working day'),
});

type ExitValues = z.infer<typeof exitSchema>;

const EMPTY: ExitValues = {
  full_name: '',
  employee_code: '',
  work_email: '',
  manager_name: '',
  manager_email: '',
  last_working_day: '',
};

export function ExitFormDialog({ trigger }: { trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<ExitValues>({ resolver: zodResolver(exitSchema), defaultValues: EMPTY });

  const create = useMutation({
    mutationFn: (values: ExitValues) =>
      exitsApi.create({ ...values, manager_name: values.manager_name || null }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: exitKeys.all });
      setOpen(false);
      showToast.success('Exit started. The clearance mail is on its way.');
      navigate(`/cases/${res.data.case_id}`);
    },
    onError: (error) => {
      if (!applyServerErrors(error, setError)) showToast.error(getErrorMessage(error));
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset(EMPTY);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Start an exit</DialogTitle>
          <DialogDescription>
            The agent sends one clearance mail to the offboarding group and the manager, then chases each
            team.
          </DialogDescription>
        </DialogHeader>
        <form
          id="exit-form"
          noValidate
          onSubmit={handleSubmit((values) => create.mutate(values))}
          className="grid gap-4 sm:grid-cols-2"
        >
          <Field id="exit_full_name" label="Employee name" error={errors.full_name?.message}>
            <Input {...fieldProps('exit_full_name', errors.full_name?.message)} {...register('full_name')} />
          </Field>
          <Field id="exit_employee_code" label="Employee ID" error={errors.employee_code?.message}>
            <Input
              spellCheck={false}
              className="font-mono"
              {...fieldProps('exit_employee_code', errors.employee_code?.message)}
              {...register('employee_code')}
            />
          </Field>
          <Field id="exit_work_email" label="Work email" error={errors.work_email?.message}>
            <Input
              type="email"
              spellCheck={false}
              {...fieldProps('exit_work_email', errors.work_email?.message)}
              {...register('work_email')}
            />
          </Field>
          <Field id="exit_lwd" label="Last working day" error={errors.last_working_day?.message}>
            <Controller
              control={control}
              name="last_working_day"
              render={({ field }) => (
                <DateField
                  {...fieldProps('exit_lwd', errors.last_working_day?.message)}
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
          </Field>
          <Field id="exit_manager_name" label="Manager name" optional error={errors.manager_name?.message}>
            <Input
              {...fieldProps('exit_manager_name', errors.manager_name?.message)}
              {...register('manager_name')}
            />
          </Field>
          <Field id="exit_manager_email" label="Manager email" error={errors.manager_email?.message}>
            <Input
              type="email"
              spellCheck={false}
              {...fieldProps('exit_manager_email', errors.manager_email?.message)}
              {...register('manager_email')}
            />
          </Field>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" form="exit-form" disabled={create.isPending}>
            {create.isPending ? 'Starting…' : 'Start exit and send clearance mail'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
