import { Check, Clock, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { TEAM_LABELS } from '@/utils/labels';

const DONE = new Set(['done', 'not_applicable']);
const STUCK = new Set(['blocked', 'escalated']);

export function ClearanceChips({ clearances }: { clearances: Record<string, string> }) {
  const teams = Object.entries(clearances);
  if (!teams.length) return <span className="text-xs text-muted-foreground">—</span>;

  return (
    <ul className="flex flex-wrap gap-1" aria-label="Clearances">
      {teams.map(([team, status]) => {
        const Icon = DONE.has(status) ? Check : STUCK.has(status) ? X : Clock;
        return (
          <li
            key={team}
            title={`${TEAM_LABELS[team] ?? team}: ${status.replace(/_/g, ' ')}`}
            className={cn(
              'inline-flex h-5 items-center gap-1 rounded-sm border px-1.5 text-xs font-medium',
              DONE.has(status)
                ? 'border-success/25 bg-success/10 text-success'
                : STUCK.has(status)
                  ? 'border-destructive/25 bg-destructive/10 text-destructive'
                  : 'border-border bg-muted text-muted-foreground',
            )}
          >
            <Icon className="size-3" aria-hidden="true" />
            {TEAM_LABELS[team] ?? team}
            <span className="sr-only">{status.replace(/_/g, ' ')}</span>
          </li>
        );
      })}
    </ul>
  );
}
