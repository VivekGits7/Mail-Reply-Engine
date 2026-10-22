import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export function TableShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'max-w-full overflow-x-auto rounded-lg border bg-card [&_th]:h-9 [&_th]:bg-muted/50 [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted-foreground',
        className,
      )}
    >
      {children}
    </div>
  );
}
