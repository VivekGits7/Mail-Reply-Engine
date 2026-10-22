import { useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/utils/cn';

interface SearchInputProps {
  value?: string;
  onSearch: (value: string | undefined) => void;
  label: string;
  className?: string;
}

const DEBOUNCE_MS = 300;

export function SearchInput({ value, onSearch, label, className }: SearchInputProps) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div className={cn('relative w-full sm:w-64', className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        type="search"
        aria-label={label}
        placeholder={`${label}…`}
        defaultValue={value}
        spellCheck={false}
        className="pl-8"
        onChange={(event) => {
          const next = event.target.value.trim();
          clearTimeout(timer.current);
          timer.current = setTimeout(() => onSearch(next || undefined), DEBOUNCE_MS);
        }}
      />
    </div>
  );
}
