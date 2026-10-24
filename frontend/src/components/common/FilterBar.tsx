import type { ReactNode } from 'react';

export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 grid grid-flow-row-dense grid-cols-2 gap-2 sm:flex sm:flex-row sm:flex-wrap sm:items-center [&>div]:col-span-2 [&>fieldset]:col-span-2">
      {children}
    </div>
  );
}
