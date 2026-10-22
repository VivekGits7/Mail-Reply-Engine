export function DocProgress({ verified, total }: { verified: number; total: number }) {
  const percent = total ? Math.round((verified / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1.5 w-16 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={verified}
        aria-label="Documents verified"
      >
        <div className="h-full rounded-full bg-success" style={{ width: `${percent}%` }} />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">
        {verified}/{total}
      </span>
    </div>
  );
}
