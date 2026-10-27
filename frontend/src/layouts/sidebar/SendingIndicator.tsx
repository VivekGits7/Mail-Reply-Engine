import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router';
import { SENDING_MODE_ICONS, SENDING_MODE_LABELS, TONE_SQUARE } from '@/components/admin/sendingModes';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/utils/cn';
import type { SendingSummary } from '@/utils/systemState';
import { useSendingAlert } from './useNav';

const CONTROLS_PATH = '/admin/controls';

function actionLabel(alert: SendingSummary) {
  return alert.mode === 'held' ? 'Set test inbox' : 'Open controls';
}

export function SendingRailIndicator() {
  const alert = useSendingAlert();
  const [open, setOpen] = useState(false);
  if (!alert) return null;
  const Icon = SENDING_MODE_ICONS[alert.mode];
  const label = SENDING_MODE_LABELS[alert.mode];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${label}. ${alert.title}`}
          className="group/rail flex w-16 shrink-0 flex-col items-center gap-1 rounded-2xl py-1 text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <span
            className={cn(
              'flex size-11 items-center justify-center rounded-full transition-transform duration-200 ease-(--ease-fluid) group-hover/rail:scale-105',
              TONE_SQUARE[alert.tone],
            )}
          >
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <span className="text-[0.65rem] leading-tight font-medium">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="end" sideOffset={16} className="w-72 p-4">
        <p className="text-sm font-medium break-words">{alert.title}</p>
        <p className="mt-1 text-xs text-pretty text-muted-foreground">{alert.detail}</p>
        <Link
          to={CONTROLS_PATH}
          onClick={() => setOpen(false)}
          className="mt-3 inline-flex items-center gap-1 rounded-full text-sm font-medium underline underline-offset-3 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {actionLabel(alert)}
          <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </Link>
      </PopoverContent>
    </Popover>
  );
}

export function SendingMenuIndicator({
  className,
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  const alert = useSendingAlert();
  if (!alert) return null;
  const Icon = SENDING_MODE_ICONS[alert.mode];

  return (
    <Link
      to={CONTROLS_PATH}
      onClick={onNavigate}
      className={cn(
        'flex items-center gap-3 panel-inset rounded-3xl p-3 transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
        className,
      )}
    >
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-full',
          TONE_SQUARE[alert.tone],
        )}
      >
        <Icon className="size-4.5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium break-words">{alert.title}</span>
        <span className="block text-xs text-muted-foreground">{actionLabel(alert)}</span>
      </span>
      <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}
