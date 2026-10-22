import { TriangleAlert } from 'lucide-react';
import { flagLabel } from '@/utils/labels';

export function FlagList({ flags }: { flags: string[] }) {
  if (!flags.length) return null;
  return (
    <ul className="flex flex-wrap gap-1" aria-label="Flags">
      {flags.map((flag) => (
        <li
          key={flag}
          className="inline-flex h-5 items-center gap-1 rounded-sm border border-destructive/25 bg-destructive/10 px-1.5 text-xs font-medium text-destructive"
        >
          <TriangleAlert className="size-3" aria-hidden="true" />
          {flagLabel(flag)}
        </li>
      ))}
    </ul>
  );
}
