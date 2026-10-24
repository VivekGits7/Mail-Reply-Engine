import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

const FILLED = 'svg, img, input, button, a, [role=img]';

// Phones show each row as a card, so every cell carries its column name for the CSS label.
function labelCells(root: HTMLElement) {
  for (const table of root.querySelectorAll('table')) {
    const labels = [...table.querySelectorAll('thead th')].map((cell) => cell.textContent?.trim() ?? '');
    for (const row of table.querySelectorAll('tbody tr')) {
      [...row.children].forEach((cell, index) => {
        const label = labels[index] ?? '';
        if (cell.getAttribute('data-label') !== label) cell.setAttribute('data-label', label);
        const blank = /^[—–-]?$/.test(cell.textContent?.trim() ?? '') && !cell.querySelector(FILLED);
        cell.toggleAttribute('data-blank', blank);
      });
    }
  }
}

export function TableShell({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    labelCells(root);
    const observer = new MutationObserver(() => labelCells(root));
    observer.observe(root, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={cn('table-stack max-w-full overflow-x-auto panel px-2 pt-1 pb-2', className)}>
      {children}
    </div>
  );
}
