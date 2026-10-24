import { cn } from '@/utils/cn';

const MAX_SEGMENTS = 12;

export function DocProgress({ verified, total }: { verified: number; total: number }) {
  const segments = Math.min(total, MAX_SEGMENTS);
  const filled = total ? Math.round((verified / total) * segments) : 0;
  const done = total > 0 && verified >= total;
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="flex h-2 w-20 gap-0.5"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={verified}
        aria-label="Documents verified"
      >
        {segments === 0 ? (
          <span className="h-full w-full rounded-full bg-muted" />
        ) : (
          Array.from({ length: segments }, (_, index) => (
            <span
              key={index}
              className={cn(
                'h-full flex-1 rounded-full transition-colors duration-300',
                index < filled ? (done ? 'bg-mint' : 'bg-primary') : 'bg-muted',
              )}
            />
          ))
        )}
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">
        {verified}/{total}
      </span>
    </div>
  );
}
