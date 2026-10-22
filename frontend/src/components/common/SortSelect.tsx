import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';

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
  const current = options.find((option) => option.sort_by === sortBy && option.sort_order === sortOrder) ?? options[0];

  return (
    <NativeSelect
      aria-label="Sort"
      value={keyOf(current)}
      className="w-full sm:w-auto"
      onChange={(event) => {
        const picked = options.find((option) => keyOf(option) === event.target.value) ?? options[0];
        onChange(picked.sort_by, picked.sort_order);
      }}
    >
      {options.map((option) => (
        <NativeSelectOption key={keyOf(option)} value={keyOf(option)}>
          {option.label}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}
