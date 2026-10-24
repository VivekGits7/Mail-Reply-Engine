import { ArrowUpRight, FlaskConical, Inbox, MailWarning, OctagonPause, Send, Timer } from 'lucide-react';
import { Link } from 'react-router';
import { cn } from '@/utils/cn';
import { mailboxSummary, sendingSummary, type SendingMode } from '@/utils/systemState';
import type { StatusData } from '@/types';

const MODE_ICONS: Record<SendingMode, typeof Send> = {
  stopped: OctagonPause,
  held: MailWarning,
  test: FlaskConical,
  live: Send,
};

const MODE_LABELS: Record<SendingMode, string> = {
  stopped: 'Stopped',
  held: 'On hold',
  test: 'Dry run',
  live: 'Live',
};

const TONE_SQUARE = {
  neutral: 'bg-muted text-muted-foreground',
  info: 'bg-azure/12 text-azure',
  success: 'bg-mint/15 text-success',
  warning: 'bg-sun/30 text-sun-foreground dark:text-sun',
  danger: 'bg-ember/12 text-ember',
} as const;

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
  const Icon = MODE_ICONS[sending.mode];

  return (
    <section
      aria-labelledby="sending-status-title"
      className={cn('flex flex-col panel p-5 sm:p-6', className)}
    >
      <div className="flex items-start gap-4">
        <span
          className={cn(
            'flex size-12 shrink-0 items-center justify-center rounded-2xl',
            TONE_SQUARE[sending.tone],
          )}
        >
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <span className="mb-2 inline-flex h-6 items-center gap-1.5 pill px-2.5 text-xs font-medium">
            <span
              className={cn(
                'size-1.5 rounded-full',
                TONE_DOT[sending.tone],
                sending.mode === 'live' && 'animate-pulse',
              )}
            />
            {MODE_LABELS[sending.mode]}
          </span>
          <h2
            id="sending-status-title"
            className="text-lg leading-snug font-normal tracking-[-0.015em] break-words"
          >
            {sending.title}
          </h2>
          <p className="mt-1 text-sm text-pretty text-muted-foreground">{sending.detail}</p>
        </div>
        {showControlsLink && (
          <Link
            to="/admin/controls"
            aria-label="Open controls"
            className="flex size-10 shrink-0 items-center justify-center pill rounded-full transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        )}
      </div>
      <dl className="mt-5 grid gap-2 text-sm sm:grid-cols-2">
        <div className="panel-inset p-4">
          <dt className="flex items-center gap-2 text-muted-foreground">
            <Inbox className="size-4" aria-hidden="true" />
            Incoming mail
          </dt>
          <dd className={cn('mt-2 text-base font-medium', mailbox.tone === 'danger' && 'text-destructive')}>
            {mailbox.label}
          </dd>
          <dd className="mt-1 text-xs text-pretty text-muted-foreground">{mailbox.detail}</dd>
        </div>
        <div className="panel-inset p-4">
          <dt className="flex items-center gap-2 text-muted-foreground">
            <Timer className="size-4" aria-hidden="true" />
            Waiting to send
          </dt>
          <dd className="mt-2 text-base font-medium tabular-nums">
            {status.queue.pending_jobs === 1
              ? '1 email or follow-up'
              : `${status.queue.pending_jobs} emails and follow-ups`}
          </dd>
          <dd className="mt-1 text-xs text-pretty text-muted-foreground">
            {failedCount ? (
              <>
                {failedCount === 1 ? '1 item' : `${failedCount} items`} failed after every retry.{' '}
                <Link
                  to="/admin/failures"
                  className="font-medium text-foreground underline underline-offset-3"
                >
                  See why
                </Link>
              </>
            ) : (
              'Includes follow-ups scheduled for later, emails waiting for the sending window, and anything held by the kill switch or dry run.'
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}
