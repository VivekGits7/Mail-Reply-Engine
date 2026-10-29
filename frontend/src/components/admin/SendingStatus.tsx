import { ArrowUpRight, Inbox, Timer } from 'lucide-react';
import { Link } from 'react-router';
import { cn } from '@/utils/cn';
import { mailboxSummary, sendingSummary } from '@/utils/systemState';
import type { StatusData } from '@/types';
import { SENDING_MODE_ICONS, SENDING_MODE_LABELS, TONE_SQUARE } from './sendingModes';

const TONE_DOT = {
  neutral: 'bg-muted-foreground',
  info: 'bg-azure',
  success: 'bg-mint',
  warning: 'bg-sun',
  danger: 'bg-ember',
} as const;

interface SendingStatusProps {
  status: StatusData;
  failedCount?: number;
  showControlsLink?: boolean;
  className?: string;
}

export function SendingStatus({ status, failedCount, showControlsLink, className }: SendingStatusProps) {
  const sending = sendingSummary(status);
  const mailbox = mailboxSummary(status.mailbox.subscription);
  const Icon = SENDING_MODE_ICONS[sending.mode];

  const simpleDetail =
    sending.mode === 'test'
      ? 'Safe test mode is active. Candidates and recruiters receive no emails.'
      : sending.mode === 'stopped'
        ? 'Sending is paused by the master switch. No outgoing emails will be sent.'
        : sending.mode === 'held'
          ? 'Emails are on hold because no test mailbox is set.'
          : 'Live sending is active. Emails are delivered directly to real recipients.';

  return (
    <section
      aria-labelledby="sending-status-title"
      className={cn('flex flex-col panel p-5 sm:p-6', className)}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <span
            className={cn(
              'flex size-12 shrink-0 items-center justify-center rounded-2xl',
              TONE_SQUARE[sending.tone],
            )}
          >
            <Icon className="size-6" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <span className="mb-1.5 inline-flex h-6 items-center gap-1.5 pill px-2.5 text-xs font-semibold">
              <span
                className={cn(
                  'size-1.5 rounded-full',
                  TONE_DOT[sending.tone],
                  sending.mode === 'live' && 'animate-pulse',
                )}
              />
              {SENDING_MODE_LABELS[sending.mode]}
            </span>
            <h2
              id="sending-status-title"
              className="text-lg leading-snug font-medium tracking-tight text-foreground break-words"
            >
              {sending.title}
            </h2>
            <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground">{simpleDetail}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-xs">
            <Inbox className="size-4 text-muted-foreground" aria-hidden="true" />
            <div>
              <span className="text-muted-foreground">Mailbox: </span>
              <span className="font-semibold text-foreground">{mailbox.label}</span>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-xs">
            <Timer className="size-4 text-muted-foreground" aria-hidden="true" />
            <div>
              <span className="text-muted-foreground">Scheduled: </span>
              <span className="font-semibold text-foreground tabular-nums">
                {status.queue.pending_jobs}
              </span>
            </div>
          </div>
          {failedCount ? (
            <Link
              to="/#admin-failures"
              className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/15"
            >
              <span>{failedCount} failed</span>
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </Link>
          ) : null}
          {showControlsLink && (
            <Link
              to="/#admin-controls"
              aria-label="Open controls"
              className="flex size-9 shrink-0 items-center justify-center pill rounded-full transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
