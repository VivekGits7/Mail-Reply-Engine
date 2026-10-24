import { FlaskConical, MailWarning, OctagonPause, Send } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';
import { mailboxSummary, sendingSummary, type SendingMode } from '@/utils/systemState';
import type { StatusData } from '@/types';

const MODE_ICONS: Record<SendingMode, typeof Send> = {
  stopped: OctagonPause,
  held: MailWarning,
  test: FlaskConical,
  live: Send,
};

const TONE_TEXT = {
  neutral: 'text-muted-foreground',
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-destructive',
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
    <section aria-labelledby="sending-status-title" className={cn('rounded-lg border bg-card p-4 sm:p-5', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Icon className={cn('mt-0.5 size-5 shrink-0', TONE_TEXT[sending.tone])} aria-hidden="true" />
          <div className="min-w-0">
            <h2 id="sending-status-title" className="font-semibold break-words">
              {sending.title}
            </h2>
            <p className="mt-1 text-sm text-pretty text-muted-foreground">{sending.detail}</p>
          </div>
        </div>
        {showControlsLink && (
          <Button asChild variant="outline" size="sm" className="self-start">
            <Link to="/admin/controls">Open controls</Link>
          </Button>
        )}
      </div>
      <dl className="mt-4 grid gap-4 border-t pt-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Incoming mail</dt>
          <dd className={cn('mt-0.5 font-medium', mailbox.tone === 'danger' && 'text-destructive')}>{mailbox.label}</dd>
          <dd className="mt-0.5 text-xs text-pretty text-muted-foreground">{mailbox.detail}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Waiting to send</dt>
          <dd className="mt-0.5 font-medium tabular-nums">
            {status.queue.pending_jobs === 1 ? '1 email or follow-up' : `${status.queue.pending_jobs} emails and follow-ups`}
          </dd>
          <dd className="mt-0.5 text-xs text-pretty text-muted-foreground">
            {failedCount ? (
              <>
                {failedCount === 1 ? '1 item' : `${failedCount} items`} failed after every retry.{' '}
                <Link to="/admin/failures" className="font-medium text-foreground underline underline-offset-3">
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
