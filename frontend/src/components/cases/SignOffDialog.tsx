import { useState, type ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Field } from '@/components/common/Field';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { fieldProps } from '@/utils/fieldProps';
import { applyServerErrors } from '@/utils/formErrors';
import { casesApi } from './Casesapi';
import { useCaseMutation } from './useCaseMutation';

const signOffSchema = z.object({
  employee_code: z.string().trim().min(1, 'Enter the Employee ID').max(32),
  designation: z.string().trim().min(2, 'Enter the designation'),
  project_code: z.string().trim().max(100),
  gender: z.string().trim().min(1, 'Enter the gender'),
  blood_group: z.string().trim().max(10),
  date_of_marriage: z.string(),
  bu_head: z.string().trim().min(2, 'Enter the BU head'),
  employment_type: z.string().trim().min(2, 'Enter the employment type'),
  contact_number: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s]{7,20}$/, 'Enter a valid contact number'),
  sector_region: z.string().trim().min(2, 'Enter the sector or region'),
  skills: z.string().trim().min(2, 'Enter the skill set').max(500),
  system_type: z.boolean(),
  proj_ops: z.boolean(),
  ess_d365: z.boolean(),
  business_card: z.boolean(),
  force_reason: z.string().trim(),
});

type SignOffValues = z.infer<typeof signOffSchema>;

const DEFAULTS: SignOffValues = {
  employee_code: '',
  designation: '',
  project_code: '',
  gender: '',
  blood_group: '',
  date_of_marriage: '',
  bu_head: '',
  employment_type: 'Permanent',
  contact_number: '',
  sector_region: '',
  skills: '',
  system_type: true,
  proj_ops: false,
  ess_d365: true,
  business_card: false,
  force_reason: '',
};

const TEXT_FIELDS: { name: keyof SignOffValues; label: string; optional?: boolean; mono?: boolean; type?: string }[] = [
  { name: 'employee_code', label: 'Employee ID', mono: true },
  { name: 'designation', label: 'Designation' },
  { name: 'employment_type', label: 'Employment type' },
  { name: 'bu_head', label: 'BU head' },
  { name: 'sector_region', label: 'Sector or region' },
  { name: 'project_code', label: 'Project code', optional: true },
  { name: 'gender', label: 'Gender' },
  { name: 'contact_number', label: 'Contact number', type: 'tel' },
  { name: 'blood_group', label: 'Blood group', optional: true },
  { name: 'date_of_marriage', label: 'Date of marriage', optional: true, type: 'date' },
];

const SWITCHES: { name: 'system_type' | 'proj_ops' | 'ess_d365' | 'business_card'; label: string }[] = [
  { name: 'system_type', label: 'Needs a system' },
  { name: 'proj_ops', label: 'Needs Swift ALM or Proj Ops' },
  { name: 'ess_d365', label: 'Needs ESS D365' },
  { name: 'business_card', label: 'Needs a business card' },
];

interface SignOffDialogProps {
  caseId: string;
  early: boolean;
  trigger: ReactNode;
}

export function SignOffDialog({ caseId, early, trigger }: SignOffDialogProps) {
  const [open, setOpen] = useState(false);
  const schema = early
    ? signOffSchema.extend({ force_reason: z.string().trim().min(5, 'Say why you are signing off early') })
    : signOffSchema;
  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<SignOffValues>({ resolver: zodResolver(schema), defaultValues: DEFAULTS });

  const signOff = useCaseMutation(
    caseId,
    (values: SignOffValues) =>
      casesApi.signOff(caseId, {
        ...values,
        project_code: values.project_code || null,
        blood_group: values.blood_group || null,
        date_of_marriage: values.date_of_marriage || null,
        force_reason: early ? values.force_reason : null,
      }),
    { onSuccess: () => setOpen(false), onError: (error) => applyServerErrors(error, setError) },
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset(DEFAULTS);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{early ? 'Sign off before every document is verified' : 'Sign off and request IT setup'}</DialogTitle>
          <DialogDescription>
            These details go to IT in the setup request. The joiner is not emailed until IT confirms.
          </DialogDescription>
        </DialogHeader>
        <form
          id="sign-off-form"
          noValidate
          onSubmit={handleSubmit((values) => signOff.mutate(values))}
          className="grid gap-4 sm:grid-cols-2"
        >
          {TEXT_FIELDS.map(({ name, label, optional, mono, type }) => (
            <Field key={name} id={`so-${name}`} label={label} optional={optional} error={errors[name]?.message}>
              <Input
                type={type ?? 'text'}
                className={mono ? 'font-mono' : undefined}
                {...fieldProps(`so-${name}`, errors[name]?.message)}
                {...register(name)}
              />
            </Field>
          ))}
          <Field id="so-skills" label="Skill set" className="sm:col-span-2" error={errors.skills?.message}>
            <Textarea rows={2} {...fieldProps('so-skills', errors.skills?.message)} {...register('skills')} />
          </Field>
          <fieldset className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-medium">IT needs</legend>
            {SWITCHES.map(({ name, label }) => (
              <Controller
                key={name}
                control={control}
                name={name}
                render={({ field }) => (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`so-${name}`}
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                    <Label htmlFor={`so-${name}`} className="font-normal">
                      {label}
                    </Label>
                  </div>
                )}
              />
            ))}
          </fieldset>
          {early && (
            <Field
              id="so-force_reason"
              label="Why sign off now"
              className="sm:col-span-2"
              hint="Saved to the activity log"
              error={errors.force_reason?.message}
            >
              <Textarea
                rows={2}
                {...fieldProps('so-force_reason', errors.force_reason?.message)}
                {...register('force_reason')}
              />
            </Field>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" form="sign-off-form" disabled={signOff.isPending}>
            {signOff.isPending ? 'Signing off…' : 'Sign off and email IT'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
