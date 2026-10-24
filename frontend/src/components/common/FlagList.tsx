import { TriangleAlert } from 'lucide-react';
import { flagLabel } from '@/utils/labels';

export function FlagList({ flags }: { flags: string[] }) {
  if (!flags.length) return null;
  return (
    <ul className="flex flex-wrap gap-1" aria-label="Flags">
      {flags.map((flag) => (
        <li
          key={flag}
          className="inline-flex h-6 items-center gap-1 rounded-full bg-ember/10 px-2.5 text-xs font-medium text-ember"
        >
          <TriangleAlert className="size-3" aria-hidden="true" />
          {flagLabel(flag)}
        </li>
      ))}
    </ul>
  );
}
