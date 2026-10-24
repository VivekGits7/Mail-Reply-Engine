import { useToday } from '@/hooks/useToday';
import { cn } from '@/utils/cn';
import { dayKey } from '@/utils/utility';

const MONTH = new Intl.DateTimeFormat('en-IN', { month: 'short' });
const DAY = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });
const ROW_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'];
const LEVELS = ['bg-muted', 'bg-mint/25', 'bg-mint/45', 'bg-mint/70', 'bg-mint'];

interface HeatmapProps {
  counts: Record<string, number>;
  weeks?: number;
  label: string;
  unit?: string;
  className?: string;
}

export function Heatmap({ counts, weeks = 26, label, unit = 'actions', className }: HeatmapProps) {
  const today = useToday();
  const todayKey = dayKey(today);
  const start = new Date(today);
  start.setDate(today.getDate() - ((today.getDay() + 6) % 7) - (weeks - 1) * 7);

  const columns = Array.from({ length: weeks }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => {
      const date = new Date(start);
      date.setDate(start.getDate() + week * 7 + day);
      return date;
    }),
  );
  const peak = Math.max(1, ...Object.values(counts));
  const level = (count: number) => (count <= 0 ? 0 : Math.min(4, Math.ceil((count / peak) * 4)));
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const template = `2.25rem repeat(${weeks}, minmax(0, 1fr))`;

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div
        role="img"
        aria-label={`${label}: ${total} ${unit} in the last ${weeks} weeks`}
        className="grid gap-[3px] sm:gap-1.5"
        style={{ gridTemplateColumns: template }}
      >
        <span />
        {columns.map((days, index) => {
          const first = days[0];
          const showMonth = index === 0 || first.getDate() <= 7;
          return (
            <span key={`m-${dayKey(first)}`} className="truncate pb-1 text-[0.65rem] text-muted-foreground">
              {showMonth ? MONTH.format(first) : ''}
            </span>
          );
        })}
        {ROW_LABELS.map((rowLabel, row) => (
          <div key={row} className="contents">
            <span className="flex items-center text-[0.65rem] text-muted-foreground">{rowLabel}</span>
            {columns.map((days) => {
              const date = days[row];
              const key = dayKey(date);
              const count = counts[key] ?? 0;
              const future = date > today;
              return (
                <span
                  key={key}
                  title={future ? undefined : `${DAY.format(date)}: ${count} ${unit}`}
                  className={cn(
                    'aspect-square max-h-7 w-full rounded-[0.3rem] transition-transform duration-150 hover:scale-125 sm:rounded-md',
                    future ? 'bg-transparent' : LEVELS[level(count)],
                    key === todayKey && 'ring-2 ring-primary/60 ring-offset-1 ring-offset-card',
                  )}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 self-end text-[0.7rem] text-muted-foreground">
        Less
        {LEVELS.map((item) => (
          <span key={item} className={cn('size-3 rounded-[0.25rem]', item)} />
        ))}
        More
      </div>
    </div>
  );
}
