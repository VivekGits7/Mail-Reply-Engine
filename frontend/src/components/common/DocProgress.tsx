export function DocProgress({ verified, total }: { verified: number; total: number }) {
  return (
    <span className="text-sm text-muted-foreground tabular-nums" aria-label="Documents verified">
      {verified} out of {total}
    </span>
  );
}
