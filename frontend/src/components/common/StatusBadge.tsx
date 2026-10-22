import { cn } from '@/utils/cn';
import { statusLabel, type Tone } from '@/utils/labels';

const TONES: Record<Tone, string> = {
  neutral: 'border-border bg-muted text-muted-foreground',
  info: 'border-info/25 bg-info/10 text-info',
  success: 'border-success/25 bg-success/10 text-success',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  danger: 'border-destructive/25 bg-destructive/10 text-destructive',
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
        'inline-flex h-5 shrink-0 items-center rounded-sm border px-1.5 text-xs font-medium whitespace-nowrap',
        TONES[tone ?? known.tone],
        className,
      )}
    >
      {label ?? known.label}
    </span>
  );
}
