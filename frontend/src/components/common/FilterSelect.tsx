import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';

interface FilterSelectProps {
  label: string;
  value?: string;
  options: { value: string; label: string }[];
  onChange: (value: string | undefined) => void;
  allLabel?: string;
}

export function FilterSelect({ label, value, options, onChange, allLabel = 'All' }: FilterSelectProps) {
  return (
    <NativeSelect
      aria-label={label}
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value || undefined)}
      className="w-full sm:w-auto"
    >
      <NativeSelectOption value="">
        {label}: {allLabel}
      </NativeSelectOption>
      {options.map((option) => (
        <NativeSelectOption key={option.value} value={option.value}>
          {option.label}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}
