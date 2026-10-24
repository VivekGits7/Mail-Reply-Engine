import { useState, type ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { caseKeys } from '@/components/cases/Casesapi';
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
import { SelectField } from '@/components/common/SelectField';
import { DateField } from '@/components/common/DateField';
import { fieldProps } from '@/utils/fieldProps';
import { getErrorMessage } from '@/utils/apiError';
import { applyServerErrors } from '@/utils/formErrors';
import { showToast } from '@/utils/toast';
import { toDateInput } from '@/utils/utility';
import { HireCategory, type PersonData, type UpdateJoinerRequest } from '@/types';
import { joinerKeys, joinersApi } from './Joinersapi';

const joinerSchema = z.object({
  full_name: z.string().trim().min(2, 'Enter the full name'),
  personal_email: z.email('Enter a valid email address'),
  recruiter_email: z.email('Enter a valid email address'),
  hire_category: z.enum([HireCategory.CAMPUS, HireCategory.LATERAL]),
  location: z.string().trim().min(2, 'Enter the base location'),
  level: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^L\d{1,2}$/, 'Level must look like L4'),
  joining_date: z.string().min(1, 'Pick the joining date'),
  date_of_birth: z.string().min(1, 'Pick the date of birth'),
  manager_name: z.string().trim().min(2, 'Enter the manager name'),
  manager_email: z.email('Enter a valid email address'),
});

type JoinerValues = z.infer<typeof joinerSchema>;

const EMPTY: JoinerValues = {
  full_name: '',
  personal_email: '',
  recruiter_email: '',
  hire_category: HireCategory.LATERAL,
  location: '',
  level: '',
  joining_date: '',
  date_of_birth: '',
  manager_name: '',
  manager_email: '',
};

function fromPerson(person: PersonData): JoinerValues {
  return {
    full_name: person.full_name,
    personal_email: person.personal_email ?? '',
    recruiter_email: person.recruiter_email ?? '',
    hire_category: person.hire_category === HireCategory.CAMPUS ? HireCategory.CAMPUS : HireCategory.LATERAL,
    location: person.location ?? '',
    level: person.level ?? '',
    joining_date: toDateInput(person.joining_date),
    date_of_birth: toDateInput(person.date_of_birth),
    manager_name: person.manager_name ?? '',
    manager_email: person.manager_email ?? '',
  };
}

interface JoinerFormDialogProps {
  trigger: ReactNode;
  person?: PersonData;
  caseId?: string;
}

export function JoinerFormDialog({ trigger, person, caseId }: JoinerFormDialogProps) {
  const [open, setOpen] = useState(false);
  const isEdit = Boolean(person);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors, dirtyFields },
  } = useForm<JoinerValues>({
    resolver: zodResolver(joinerSchema),
    defaultValues: person ? fromPerson(person) : EMPTY,
  });

  const save = useMutation({
    mutationFn: async (values: JoinerValues) => {
      if (!person) return { created: await joinersApi.create(values) };
      const changes = Object.fromEntries(
        Object.keys(dirtyFields).map((key) => [key, values[key as keyof JoinerValues]]),
      ) as UpdateJoinerRequest;
      return { updated: await joinersApi.update(person.person_id, changes) };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: joinerKeys.all });
      if (caseId) queryClient.invalidateQueries({ queryKey: caseKeys.detail(caseId) });
      setOpen(false);
      if (result.created) {
        showToast.success('Joiner added. The document request is on its way.');
        navigate(`/cases/${result.created.data.case_id}`);
      } else if (result.updated) {
        const rechecked = result.updated.data.rechecked_documents;
        showToast.success(
          rechecked ? `Saved. ${rechecked} documents will be checked again.` : 'Joiner details saved',
        );
      }
    },
    onError: (error) => {
      if (!applyServerErrors(error, setError)) showToast.error(getErrorMessage(error));
    },
  });

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) reset(person ? fromPerson(person) : EMPTY);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit joiner details' : 'Add a joiner'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Changing the name or date of birth checks the received documents again.'
              : 'The agent emails the joiner and recruiter with the document checklist as soon as you save.'}
          </DialogDescription>
        </DialogHeader>
        <form
          id="joiner-form"
          noValidate
          onSubmit={handleSubmit((values) => save.mutate(values))}
          className="grid gap-4 sm:grid-cols-2"
        >
          <Field id="full_name" label="Full name" error={errors.full_name?.message}>
            <Input
              autoComplete="off"
              {...fieldProps('full_name', errors.full_name?.message)}
              {...register('full_name')}
            />
          </Field>
          <Field id="personal_email" label="Personal email" error={errors.personal_email?.message}>
            <Input
              type="email"
              spellCheck={false}
              {...fieldProps('personal_email', errors.personal_email?.message)}
              {...register('personal_email')}
            />
          </Field>
          {!isEdit && (
            <Field id="hire_category" label="Hire type" error={errors.hire_category?.message}>
              <Controller
                control={control}
                name="hire_category"
                render={({ field }) => (
                  <SelectField
                    {...fieldProps('hire_category')}
                    className="w-full sm:w-full"
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    options={[
                      { value: HireCategory.LATERAL, label: 'Lateral' },
                      { value: HireCategory.CAMPUS, label: 'Campus' },
                    ]}
                  />
                )}
              />
            </Field>
          )}
          <Field id="level" label="Level" hint="Like L4" error={errors.level?.message}>
            <Input
              spellCheck={false}
              {...fieldProps('level', errors.level?.message)}
              {...register('level')}
            />
          </Field>
          <Field id="location" label="Base location" error={errors.location?.message}>
            <Input {...fieldProps('location', errors.location?.message)} {...register('location')} />
          </Field>
          <Field id="joining_date" label="Joining date" error={errors.joining_date?.message}>
            <Controller
              control={control}
              name="joining_date"
              render={({ field }) => (
                <DateField
                  {...fieldProps('joining_date', errors.joining_date?.message)}
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
          </Field>
          <Field
            id="date_of_birth"
            label="Date of birth"
            hint="Only used to match documents, never sent to the AI"
            error={errors.date_of_birth?.message}
          >
            <Controller
              control={control}
              name="date_of_birth"
              render={({ field }) => (
                <DateField
                  {...fieldProps('date_of_birth', errors.date_of_birth?.message)}
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
          </Field>
          <Field id="recruiter_email" label="Recruiter email" error={errors.recruiter_email?.message}>
            <Input
              type="email"
              spellCheck={false}
              {...fieldProps('recruiter_email', errors.recruiter_email?.message)}
              {...register('recruiter_email')}
            />
          </Field>
          <Field id="manager_name" label="Reporting manager" error={errors.manager_name?.message}>
            <Input
              {...fieldProps('manager_name', errors.manager_name?.message)}
              {...register('manager_name')}
            />
          </Field>
          <Field id="manager_email" label="Manager email" error={errors.manager_email?.message}>
            <Input
              type="email"
              spellCheck={false}
              {...fieldProps('manager_email', errors.manager_email?.message)}
              {...register('manager_email')}
            />
          </Field>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" form="joiner-form" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Add joiner and send request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
