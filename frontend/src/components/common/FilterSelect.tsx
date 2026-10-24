import { SelectField } from './SelectField';

interface FilterSelectProps {
  label: string;
  value?: string;
  options: { value: string; label: string }[];
  onChange: (value: string | undefined) => void;
  allLabel?: string;
}

export function FilterSelect({ label, value, options, onChange, allLabel = 'All' }: FilterSelectProps) {
  return (
    <SelectField
      aria-label={label}
      prefix={label}
      value={value ?? ''}
      onValueChange={(next) => onChange(next || undefined)}
      options={[{ value: '', label: allLabel }, ...options]}
    />
  );
}
