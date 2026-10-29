import { DateField } from './DateField';

interface DateRangeProps {
  label: string;
  from?: string;
  to?: string;
  onChange: (from: string | undefined, to: string | undefined) => void;
}

export function DateRange({ label, from, to, onChange }: DateRangeProps) {
  return (
    <fieldset className="flex items-center gap-1.5">
      <legend className="sr-only">{label}</legend>
      <DateField
        aria-label={`${label} from`}
        placeholder="From"
        value={from ?? ''}
        max={to}
        onChange={(next) => onChange(next || undefined, to)}
        className="w-full sm:w-32"
      />
      <span className="text-sm text-muted-foreground" aria-hidden="true">
        to
      </span>
      <DateField
        aria-label={`${label} to`}
        placeholder="To"
        value={to ?? ''}
        min={from}
        align="end"
        onChange={(next) => onChange(from, next || undefined)}
        className="w-full sm:w-32"
      />
    </fieldset>
  );
}
