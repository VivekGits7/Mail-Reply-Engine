import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/utils/cn';

// Radix Select reserves the empty string, so empty values travel under this key instead.
const EMPTY = '__empty__';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectFieldProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  id?: string;
  name?: string;
  prefix?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onBlur?: () => void;
  'aria-label'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
  'aria-describedby'?: string;
}

export function SelectField({
  value,
  onValueChange,
  options,
  id,
  name,
  prefix,
  placeholder,
  disabled,
  className,
  onBlur,
  ...aria
}: SelectFieldProps) {
  return (
    <Select
      value={value === '' ? EMPTY : value}
      onValueChange={(next) => onValueChange(next === EMPTY ? '' : next)}
      onOpenChange={(open) => !open && onBlur?.()}
      name={name}
      disabled={disabled}
    >
      <SelectTrigger id={id} className={cn('w-full min-w-0 sm:w-auto', className)} {...aria}>
        <span className="flex min-w-0 items-center gap-1 truncate">
          {prefix && <span className="text-muted-foreground">{prefix}:</span>}
          <SelectValue placeholder={placeholder} />
        </span>
      </SelectTrigger>
      <SelectContent position="popper" sideOffset={6} align="start" className="max-h-80">
        {options.map((option) => (
          <SelectItem
            key={option.value || EMPTY}
            value={option.value === '' ? EMPTY : option.value}
            disabled={option.disabled}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
