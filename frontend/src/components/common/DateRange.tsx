import { Input } from '@/components/ui/input';

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
      <Input
        type="date"
        aria-label={`${label} from`}
        value={from ?? ''}
        max={to}
        onChange={(event) => onChange(event.target.value || undefined, to)}
        className="w-full sm:w-36"
      />
      <span className="text-sm text-muted-foreground" aria-hidden="true">
        to
      </span>
      <Input
        type="date"
        aria-label={`${label} to`}
        value={to ?? ''}
        min={from}
        onChange={(event) => onChange(from, event.target.value || undefined)}
        className="w-full sm:w-36"
      />
    </fieldset>
  );
}
