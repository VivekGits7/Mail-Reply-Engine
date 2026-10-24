import { SelectField } from './SelectField';

export interface SortOption {
  label: string;
  sort_by?: string;
  sort_order: string;
}

interface SortSelectProps {
  options: SortOption[];
  sortBy?: string;
  sortOrder?: string;
  onChange: (sortBy: string | undefined, sortOrder: string) => void;
}

function keyOf(option: Pick<SortOption, 'sort_by' | 'sort_order'>) {
  return `${option.sort_by ?? ''}:${option.sort_order}`;
}

export function SortSelect({ options, sortBy, sortOrder, onChange }: SortSelectProps) {
  const current =
    options.find((option) => option.sort_by === sortBy && option.sort_order === sortOrder) ?? options[0];

  return (
    <SelectField
      aria-label="Sort"
      prefix="Sort"
      value={keyOf(current)}
      options={options.map((option) => ({ value: keyOf(option), label: option.label }))}
      onValueChange={(next) => {
        const picked = options.find((option) => keyOf(option) === next) ?? options[0];
        onChange(picked.sort_by, picked.sort_order);
      }}
    />
  );
}
