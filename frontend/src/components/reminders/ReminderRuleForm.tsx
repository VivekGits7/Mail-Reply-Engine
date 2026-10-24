import { useState, type ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
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
import { SelectField } from '@/components/common/SelectField';
import { DATA_SOURCE_LABELS } from '@/utils/labels';
import { fieldProps } from '@/utils/fieldProps';
import { getErrorMessage } from '@/utils/apiError';
import { applyServerErrors } from '@/utils/formErrors';
import { showToast } from '@/utils/toast';
import {
  DataSource,
  type CreateRuleRequest,
  type RuleData,
  type RuleStage,
  type UpdateRuleRequest,
} from '@/types';
import { reminderKeys, remindersApi } from './Remindersapi';

const ruleSchema = z.object({
  name: z.string().trim().min(2, 'Enter a rule name').max(255),
  rule_key: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9_]{1,63}$/, 'Use lowercase letters, numbers and underscores'),
  data_source: z.enum([DataSource.UPLOAD, DataSource.D365, DataSource.TEST]),
  recipient_field: z.string().trim().min(2, 'Enter the recipient column').max(64),
  required_columns: z
    .string()
    .refine((value) => value.split(',').some((part) => part.trim()), 'Add at least one column'),
  template_key: z.string().trim().min(2, 'Enter a template key').max(64),
  stages: z.string().refine((value) => {
    if (!value.trim()) return true;
    try {
      const parsed: unknown = JSON.parse(value);
      return (
        Array.isArray(parsed) &&
        parsed.every(
          (item) =>
            typeof item === 'object' &&
            item !== null &&
            'stage' in item &&
            'recipient_field' in item &&
            'template_key' in item,
        )
      );
    } catch {
      return false;
    }
  }, 'Enter a JSON list with stage, recipient_field and template_key'),
  schedule_cron: z.string().trim().min(9, 'Enter a five field cron schedule').max(64),
  followup_gap_hours: z.number().int().min(1).max(720),
  max_rounds: z.number().int().min(0).max(10),
  escalate_to_email: z.union([z.literal(''), z.email('Enter a valid email address')]),
  is_active: z.boolean(),
});

type RuleValues = z.infer<typeof ruleSchema>;

export function ReminderRuleForm({ trigger, rule }: { trigger: ReactNode; rule?: RuleData }) {
  const [open, setOpen] = useState(false);
  const cache = useQueryClient();
  const defaults: RuleValues = {
    name: rule?.name ?? '',
    rule_key: rule?.rule_key ?? '',
    data_source: rule?.data_source ?? DataSource.UPLOAD,
    recipient_field: rule?.recipient_field ?? '',
    required_columns: rule?.required_columns.join(', ') ?? '',
    template_key: rule?.template_key ?? '',
    stages: rule?.stages.length ? JSON.stringify(rule.stages) : '',
    schedule_cron: rule?.schedule_cron ?? '0 10 * * MON',
    followup_gap_hours: rule?.followup_gap_hours ?? 48,
    max_rounds: rule?.max_rounds ?? 3,
    escalate_to_email: rule?.escalate_to_email ?? '',
    is_active: rule?.is_active ?? true,
  };
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<RuleValues>({ resolver: zodResolver(ruleSchema), defaultValues: defaults });
  const save = useMutation({
    mutationFn: (values: RuleValues) => {
      const common = {
        name: values.name,
        recipient_field: values.recipient_field,
        required_columns: values.required_columns
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean),
        template_key: values.template_key,
        stages: values.stages.trim() ? (JSON.parse(values.stages) as RuleStage[]) : [],
        schedule_cron: values.schedule_cron,
        followup_gap_hours: values.followup_gap_hours,
        max_rounds: values.max_rounds,
        escalate_to_email: values.escalate_to_email || null,
        is_active: values.is_active,
      };
      return rule
        ? remindersApi.updateRule(rule.reminder_rule_id, common satisfies UpdateRuleRequest)
        : remindersApi.createRule({
            ...common,
            rule_key: values.rule_key,
            data_source: values.data_source,
          } satisfies CreateRuleRequest);
    },
    onSuccess: () => {
      cache.invalidateQueries({ queryKey: reminderKeys.all });
      showToast.success(rule ? 'Rule updated' : 'Rule created');
      setOpen(false);
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
        if (next) reset(defaults);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{rule ? 'Edit reminder rule' : 'Create reminder rule'}</DialogTitle>
          <DialogDescription>Choose who receives reminders and when the rule runs in IST.</DialogDescription>
        </DialogHeader>
        <form
          id="rule-form"
          noValidate
          onSubmit={handleSubmit((values) => save.mutate(values))}
          className="grid gap-4 sm:grid-cols-2"
        >
          <Field id="rule-name" label="Rule name" error={errors.name?.message}>
            <Input {...fieldProps('rule-name', errors.name?.message)} {...register('name')} />
          </Field>
          {!rule && (
            <Field id="rule-key" label="Rule key" error={errors.rule_key?.message}>
              <Input
                spellCheck={false}
                {...fieldProps('rule-key', errors.rule_key?.message)}
                {...register('rule_key')}
              />
            </Field>
          )}
          {!rule && (
            <Field id="rule-source" label="Data source">
              <Controller
                control={control}
                name="data_source"
                render={({ field }) => (
                  <SelectField
                    {...fieldProps('rule-source')}
                    className="w-full sm:w-full"
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    options={Object.values(DataSource).map((value) => ({
                      value,
                      label: DATA_SOURCE_LABELS[value],
                    }))}
                  />
                )}
              />
            </Field>
          )}
          <Field id="rule-recipient" label="Recipient column" error={errors.recipient_field?.message}>
            <Input
              spellCheck={false}
              {...fieldProps('rule-recipient', errors.recipient_field?.message)}
              {...register('recipient_field')}
            />
          </Field>
          <Field
            id="rule-columns"
            label="Required columns"
            hint="Comma separated column names"
            error={errors.required_columns?.message}
          >
            <Input
              spellCheck={false}
              {...fieldProps('rule-columns', errors.required_columns?.message)}
              {...register('required_columns')}
            />
          </Field>
          <Field id="rule-template" label="Template key" error={errors.template_key?.message}>
            <Input
              spellCheck={false}
              {...fieldProps('rule-template', errors.template_key?.message)}
              {...register('template_key')}
            />
          </Field>
          <Field
            id="rule-cron"
            label="Schedule in IST"
            hint="Five field cron, for example 0 10 * * MON"
            error={errors.schedule_cron?.message}
          >
            <Input
              spellCheck={false}
              {...fieldProps('rule-cron', errors.schedule_cron?.message)}
              {...register('schedule_cron')}
            />
          </Field>
          <Field id="rule-gap" label="Follow-up gap, hours" error={errors.followup_gap_hours?.message}>
            <Input
              type="number"
              min={1}
              max={720}
              {...fieldProps('rule-gap', errors.followup_gap_hours?.message)}
              {...register('followup_gap_hours', { valueAsNumber: true })}
            />
          </Field>
          <Field id="rule-rounds" label="Maximum follow-ups" error={errors.max_rounds?.message}>
            <Input
              type="number"
              min={0}
              max={10}
              {...fieldProps('rule-rounds', errors.max_rounds?.message)}
              {...register('max_rounds', { valueAsNumber: true })}
            />
          </Field>
          <Field
            id="rule-escalate"
            label="Escalation email"
            optional
            error={errors.escalate_to_email?.message}
          >
            <Input
              type="email"
              autoCapitalize="none"
              spellCheck={false}
              {...fieldProps('rule-escalate', errors.escalate_to_email?.message)}
              {...register('escalate_to_email')}
            />
          </Field>
          <Field
            id="rule-stages"
            label="Stages"
            hint="Optional JSON list for multi step reminders"
            error={errors.stages?.message}
          >
            <Input
              spellCheck={false}
              {...fieldProps('rule-stages', errors.stages?.message)}
              {...register('stages')}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" {...register('is_active')} /> Active rule
          </label>
        </form>
        <DialogFooter>
          <Button type="submit" form="rule-form" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save rule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
