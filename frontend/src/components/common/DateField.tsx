import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/utils/cn';
import { displayDate, parseDateText, timeOptions } from '@/utils/dateInput';
import { Calendar } from './Calendar';
import { SelectField } from './SelectField';

interface DateFieldProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  name?: string;
  min?: string;
  max?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  align?: 'start' | 'end';
  onBlur?: () => void;
  'aria-label'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
  'aria-describedby'?: string;
}

export function DateField({
  value,
  onChange,
  id,
  name,
  min,
  max,
  placeholder = 'dd/mm/yyyy',
  disabled,
  className,
  align = 'start',
  onBlur,
  ...aria
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);

  function pick(next: string) {
    setDraft(null);
    onChange(next);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className={cn('relative w-full', className)}>
          <Input
            id={id}
            name={name}
            inputMode="numeric"
            autoComplete="off"
            placeholder={placeholder}
            disabled={disabled}
            value={draft ?? displayDate(value)}
            className="pr-8 tabular-nums"
            onChange={(event) => {
              const text = event.target.value;
              setDraft(text);
              if (!text.trim()) onChange('');
              const parsed = parseDateText(text);
              if (parsed) onChange(parsed);
            }}
            onBlur={() => {
              setDraft(null);
              onBlur?.();
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' && event.altKey) {
                event.preventDefault();
                setOpen(true);
              }
            }}
            {...aria}
          />
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              aria-label="Open calendar"
              className="absolute top-1/2 right-0.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none data-[state=open]:bg-primary/10 data-[state=open]:text-primary"
            >
              <CalendarDays className="size-4" aria-hidden="true" />
            </button>
          </PopoverTrigger>
        </div>
      </PopoverAnchor>
      <PopoverContent align={align} className="w-auto">
        <Calendar value={value || undefined} min={min} max={max} onSelect={pick} onClear={() => pick('')} />
      </PopoverContent>
    </Popover>
  );
}

interface TimeFieldProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  'aria-label'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
  'aria-describedby'?: string;
}

export function TimeField({ value, onChange, className, placeholder = 'Time', ...props }: TimeFieldProps) {
  return (
    <SelectField
      value={value}
      onValueChange={onChange}
      options={timeOptions(value)}
      placeholder={placeholder}
      className={cn('w-full sm:w-32', className)}
      {...props}
    />
  );
}

interface DateTimeFieldProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  min?: string;
  disabled?: boolean;
  label: string;
}

export function DateTimeField({ value, onChange, id, min, disabled, label }: DateTimeFieldProps) {
  const [date = '', time = ''] = value ? value.split('T') : [];
  const minDate = min?.slice(0, 10);
  return (
    <div className="flex gap-2">
      <DateField
        id={id}
        value={date}
        min={minDate}
        disabled={disabled}
        className="min-w-0 flex-1"
        onChange={(next) => onChange(next ? `${next}T${time || '09:00'}` : '')}
      />
      <TimeField
        aria-label={`${label} time`}
        value={time.slice(0, 5)}
        disabled={disabled || !date}
        className="w-28 shrink-0 sm:w-28"
        onChange={(next) => onChange(`${date}T${next}`)}
      />
    </div>
  );
}
