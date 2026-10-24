import { cn } from '@/utils/cn';
import { statusLabel, type Tone } from '@/utils/labels';

const TONES: Record<Tone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  info: 'bg-info/10 text-info',
  success: 'bg-success/12 text-success',
  warning: 'bg-warning/14 text-warning',
  danger: 'bg-destructive/10 text-destructive',
};

interface StatusBadgeProps {
  value?: string | null;
  label?: string;
  tone?: Tone;
  className?: string;
}

export function StatusBadge({ value, label, tone, className }: StatusBadgeProps) {
  const known = statusLabel(value);
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full pr-2.5 pl-2 text-xs font-medium whitespace-nowrap',
        TONES[tone ?? known.tone],
        className,
      )}
    >
      <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />
      {label ?? known.label}
    </span>
  );
}
