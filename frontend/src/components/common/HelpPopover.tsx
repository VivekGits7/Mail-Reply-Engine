import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface HelpPopoverProps {
  title: string;
  items: { label: string; detail: string }[];
}

export function HelpPopover({ title, items }: HelpPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={title}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Info className="size-4.5" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <p className="mb-2 text-sm font-medium">{title}</p>
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.label}>
              <p className="text-sm font-medium">{item.label}</p>
              <p className="mt-0.5 text-xs text-pretty text-muted-foreground">{item.detail}</p>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
