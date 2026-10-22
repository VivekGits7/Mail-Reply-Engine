import { ArrowDownLeft, ArrowUpRight, CircleDot, UserRound } from 'lucide-react';
import { EmptyState } from '@/components/common/QueryState';
import { formatDateTime, humanize } from '@/utils/utility';
import type { TimelineEntry } from '@/types';

function iconFor(entry: TimelineEntry) {
  if (entry.direction === 'inbound') return ArrowDownLeft;
  if (entry.direction === 'outbound') return ArrowUpRight;
  return entry.actor === 'agent' || entry.actor === 'system' ? CircleDot : UserRound;
}

export function TimelinePanel({ entries }: { entries: TimelineEntry[] }) {
  if (!entries.length) return <EmptyState title="Nothing has happened yet" />;

  return (
    <ol className="relative flex flex-col gap-4 border-l pl-5" aria-label="Case timeline">
      {entries.map((entry, index) => {
        const Icon = iconFor(entry);
        return (
          <li key={`${entry.at}-${index}`} className="relative">
            <span className="absolute top-0.5 -left-[1.95rem] flex size-5 items-center justify-center rounded-full border bg-background">
              <Icon className="size-3 text-muted-foreground" aria-hidden="true" />
            </span>
            <p className="text-xs text-muted-foreground tabular-nums">
              {formatDateTime(entry.at)} · {humanize(entry.actor)}
              {entry.category && ` · ${humanize(entry.category)}`}
            </p>
            {entry.subject && <p className="mt-0.5 text-sm font-medium">{entry.subject}</p>}
            <p className="mt-0.5 text-sm text-pretty text-muted-foreground">{entry.summary}</p>
          </li>
        );
      })}
    </ol>
  );
}
