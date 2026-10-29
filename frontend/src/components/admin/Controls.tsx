import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  CheckCircle2,
  Clock,
  Database,
  FileSearch,
  Inbox,
  Mail,
  Power,
  Send,
  XCircle,
} from 'lucide-react';
import { Link } from 'react-router';
import { z } from 'zod';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Field } from '@/components/common/Field';
import { HelpPopover } from '@/components/common/HelpPopover';
import { PageHeader } from '@/components/common/PageHeader';
import { BlockSkeleton, ErrorState } from '@/components/common/QueryState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { selectIsAdmin } from '@/redux/authSlice';
import { useAppSelector } from '@/redux/hooks';
import { getErrorMessage } from '@/utils/apiError';
import { cn } from '@/utils/cn';
import { fieldProps } from '@/utils/fieldProps';
import { showToast } from '@/utils/toast';
import { formatDateTime, formatRelative } from '@/utils/utility';
import type { StatusData } from '@/types';
import { adminApi, adminKeys, failuresQuery, statusQuery } from './Adminapi';


const inboxSchema = z.email();

const CONTROLS_HELP = [
  {
    label: 'Last mailbox check',
    detail:
      'When the agent last looked for new emails in the mailbox. If instant notifications are on, it also gets alerts the moment a new email arrives.',
  },
  {
    label: 'Last email received',
    detail:
      'When the last email arrived in the mailbox. Useful to confirm the agent is actively receiving emails.',
  },
  {
    label: 'Queue',
    detail:
      '"Waiting" = new emails or HR actions not yet picked up. "Active" = agent is working on them right now. "Scheduled" = follow-ups or replies waiting to be sent at their due time.',
  },
  {
    label: 'Failed',
    detail:
      'Emails or tasks the agent tried multiple times but could not complete. Click "See failures" to find out why and retry them.',
  },
  {
    label: 'Document reading',
    detail:
      'When On, the agent automatically reads uploaded documents to check their type and name (e.g. PAN card, offer letter). When Off, HR checks documents manually.',
  },
  {
    label: 'D365',
    detail:
      'When On, the agent gets employee status updates directly from Dynamics 365. When Off, data comes from this dashboard and manual uploads.',
  },
];


export default function Controls() {
  const isAdmin = useAppSelector(selectIsAdmin);
  const status = useQuery(statusQuery());
  const failures = useQuery(failuresQuery({ limit: 1, offset: 0 }));

  return (
    <section>
      <PageHeader
        title="Controls"
        actions={<HelpPopover title="How Controls works" items={CONTROLS_HELP} />}
      />
      {!isAdmin && (
        <p className="mb-4 rounded-2xl bg-muted/70 px-4 py-3 text-sm text-muted-foreground">
          View only — only HR admins can change these switches.
        </p>
      )}
      {status.isPending ? (
        <BlockSkeleton />
      ) : status.isError ? (
        <ErrorState error={status.error} onRetry={() => status.refetch()} />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <KillSwitchCard status={status.data} isAdmin={isAdmin} />
            <DryRunCard key={status.data.test_inbox} status={status.data} isAdmin={isAdmin} />
          </div>
          <SystemDetails status={status.data} failedCount={failures.data?.total} />
        </div>
      )}
    </section>
  );
}

function useStatusRefresh() {
  const cache = useQueryClient();
  return () => cache.invalidateQueries({ queryKey: adminKeys.status });
}

function allowDescription(status: StatusData): string {
  if (status.dry_run && status.test_inbox)
    return `Queued emails will go to the test inbox ${status.test_inbox}.`;
  if (status.dry_run) return 'Dry run is on but no test inbox is set — emails stay on hold.';
  return 'Queued emails will go to their real recipients right away.';
}

function KillSwitchCard({ status, isAdmin }: { status: StatusData; isAdmin: boolean }) {
  const refresh = useStatusRefresh();
  const [reason, setReason] = useState('');
  const on = status.kill_switch;
  const kill = useMutation({
    mutationFn: (enabled: boolean) => adminApi.killSwitch({ enabled, reason: reason.trim() || null }),
    onSuccess: (res) => {
      refresh();
      showToast.success(
        res.data.kill_switch ? 'Sending stopped.' : 'Sending allowed again.',
      );
      setReason('');
    },
    onError: (error) => showToast.error(getErrorMessage(error)),
  });

  return (
    <ControlCard
      title="Kill switch"
      icon={<Power className="size-5" aria-hidden="true" />}
      status={on ? 'danger' : 'success'}
      statusLabel={on ? 'Sending stopped' : 'Sending allowed'}
      description={
        on
          ? 'All outgoing emails are paused. The agent still reads mail and queues replies.'
          : 'Outgoing emails are delivered normally. Toggle to pause everything instantly.'
      }
    >
      {isAdmin && (
        <div className="space-y-3">
          <Field id="kill-reason" label="Reason" optional hint="Saved in the activity log">
            <Input
              id="kill-reason"
              value={reason}
              maxLength={300}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Wrong template went out…"
            />
          </Field>
          <ConfirmDialog
            title={on ? 'Allow sending again?' : 'Stop all sending?'}
            description={
              on
                ? allowDescription(status)
                : 'Every email and follow-up will wait. Incoming mail is still read and processed.'
            }
            confirmLabel={on ? 'Allow sending' : 'Stop sending'}
            destructive={!on}
            onConfirm={() => kill.mutate(!on)}
            trigger={
              <Button variant={on ? 'default' : 'destructive'} disabled={kill.isPending}>
                {kill.isPending ? 'Updating…' : on ? 'Allow sending' : 'Stop sending'}
              </Button>
            }
          />
        </div>
      )}
    </ControlCard>
  );
}

function DryRunCard({ status, isAdmin }: { status: StatusData; isAdmin: boolean }) {
  const refresh = useStatusRefresh();
  const [inbox, setInbox] = useState(status.test_inbox);
  const [error, setError] = useState('');
  const held = status.dry_run && !status.test_inbox;
  const trimmed = inbox.trim().toLowerCase();
  const dry = useMutation({
    mutationFn: (payload: { enabled: boolean; test_inbox: string | null }) => adminApi.dryRun(payload),
    onSuccess: (res) => {
      refresh();
      showToast.success(
        res.data.dry_run
          ? `Test mode on — emails go to ${res.data.test_inbox}.`
          : 'Live mode on — emails go to real recipients.',
      );
    },
    onError: (reason) => showToast.error(getErrorMessage(reason)),
  });

  function saveInbox(event: React.FormEvent) {
    event.preventDefault();
    if (!inboxSchema.safeParse(trimmed).success) {
      setError('Enter a valid email like hr-test@tcgdigital.com');
      return;
    }
    setError('');
    dry.mutate({ enabled: true, test_inbox: trimmed });
  }

  const statusLabel = !status.dry_run
    ? 'Live — real recipients'
    : held
      ? 'Test — no inbox set'
      : `Test → ${status.test_inbox}`;

  const description = !status.dry_run
    ? 'Emails go to candidates, recruiters, and teams. Switch to test mode while checking templates.'
    : 'All emails go to the test inbox instead of real people. Safe for checking templates.';

  return (
    <ControlCard
      title="Dry run"
      icon={<Send className="size-5" aria-hidden="true" />}
      status={!status.dry_run ? 'warning' : held ? 'danger' : 'info'}
      statusLabel={statusLabel}
      description={description}
    >
      {held && (
        <p
          role="alert"
          className="mb-3 rounded-2xl border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive"
        >
          No test inbox set — add one below to start sending.
        </p>
      )}
      {isAdmin && (
        <form noValidate onSubmit={saveInbox} className="space-y-3">
          <Field
            id="test-inbox"
            label="Test inbox"
            error={error}
            hint="Your team's test mailbox"
          >
            <Input
              type="email"
              autoComplete="email"
              spellCheck={false}
              autoCapitalize="none"
              placeholder="hr-test@tcgdigital.com"
              value={inbox}
              onChange={(event) => setInbox(event.target.value)}
              {...fieldProps('test-inbox', error)}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            {status.dry_run ? (
              <>
                <Button
                  type="submit"
                  variant={held ? 'default' : 'outline'}
                  disabled={dry.isPending || !trimmed || trimmed === status.test_inbox}
                >
                  {dry.isPending ? 'Saving…' : 'Save test inbox'}
                </Button>
                <ConfirmDialog
                  title="Switch to real recipients?"
                  description={`Emails will go directly to candidates, recruiters and teams. Only do this once templates are verified.${
                    status.kill_switch
                      ? ' The kill switch is on, so nothing goes out until sending is allowed.'
                      : ''
                  }`}
                  confirmLabel="Switch to live"
                  destructive
                  onConfirm={() => dry.mutate({ enabled: false, test_inbox: null })}
                  trigger={
                    <Button type="button" variant="outline" disabled={dry.isPending}>
                      Switch to live
                    </Button>
                  }
                />
              </>
            ) : (
              <Button type="submit" disabled={dry.isPending || !trimmed}>
                {dry.isPending ? 'Updating…' : 'Enable test mode'}
              </Button>
            )}
          </div>
        </form>
      )}
    </ControlCard>
  );
}

function ControlCard({
  title,
  icon,
  status,
  statusLabel,
  description,
  children,
}: {
  title: string;
  icon: ReactNode;
  status: 'success' | 'danger' | 'warning' | 'info';
  statusLabel: string;
  description: string;
  children?: ReactNode;
}) {
  const statusStyles = {
    success: 'bg-success/10 text-success',
    danger: 'bg-destructive/10 text-destructive',
    warning: 'bg-sun/10 text-sun-foreground',
    info: 'bg-primary/10 text-primary',
  };

  const dotStyles = {
    success: 'bg-success',
    danger: 'bg-destructive',
    warning: 'bg-sun',
    info: 'bg-primary',
  };

  return (
    <section className="flex flex-col panel p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className={cn('flex size-9 items-center justify-center rounded-xl', statusStyles[status])}>
            {icon}
          </span>
          <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
        </div>
        <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', statusStyles[status])}>
          <span className={cn('size-1.5 rounded-full', dotStyles[status])} />
          {statusLabel}
        </span>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{description}</p>
      {children}
    </section>
  );
}

function MetricBadge({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof Inbox;
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'success' | 'warning' | 'danger' | 'muted';
}) {
  const toneClass = {
    success: 'text-success',
    warning: 'text-sun-foreground',
    danger: 'text-destructive',
    muted: 'text-muted-foreground',
  }[tone ?? 'muted'];

  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-border/60 bg-card/80 px-4 py-3.5">
      <dt className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
        {label}
      </dt>
      <dd className={cn('text-sm font-semibold tabular-nums', toneClass)}>{value}</dd>
      {hint && <dd className="text-[0.68rem] leading-snug text-muted-foreground">{hint}</dd>}
    </div>
  );
}

function SystemDetails({ status, failedCount }: { status: StatusData; failedCount?: number }) {
  const { mailbox, queue } = status;
  return (
    <section aria-labelledby="system-details" className="panel p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <Activity className="size-4 text-muted-foreground" aria-hidden="true" />
        <h2 id="system-details" className="text-base font-semibold tracking-tight text-foreground">
          System status
        </h2>
      </div>
      <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        <MetricBadge
          icon={Inbox}
          label="Last mailbox check"
          value={formatRelative(mailbox.last_poll_at)}
          hint={mailbox.last_poll_at ? formatDateTime(mailbox.last_poll_at) : 'Never checked yet'}
        />
        <MetricBadge
          icon={Mail}
          label="Last email received"
          value={formatRelative(mailbox.last_email_at)}
          hint={mailbox.last_email_at ? formatDateTime(mailbox.last_email_at) : 'No emails yet'}
        />
        <MetricBadge
          icon={Clock}
          label="Queue"
          value={`${queue.queued} waiting · ${queue.processing} active`}
          hint={`${queue.pending_jobs} scheduled`}
        />
        <MetricBadge
          icon={failedCount ? XCircle : CheckCircle2}
          label="Failed"
          value={failedCount ? `${failedCount} item${failedCount > 1 ? 's' : ''}` : 'None'}
          hint={
            failedCount ? (
              <Link to="/#admin-failures" className="font-medium text-destructive underline underline-offset-2">
                See failures →
              </Link>
            ) as unknown as string : 'All healthy'
          }
          tone={failedCount ? 'danger' : 'success'}
        />
        <MetricBadge
          icon={FileSearch}
          label="Document reading"
          value={status.document_reading_enabled ? 'On' : 'Off'}
          tone={status.document_reading_enabled ? 'success' : 'muted'}
        />
        <MetricBadge
          icon={Database}
          label="D365"
          value={status.d365_enabled ? 'On' : 'Off'}
          tone={status.d365_enabled ? 'success' : 'muted'}
        />
      </dl>
      <p className="mt-4 text-xs text-muted-foreground">
        Document reading and D365 are configured in{' '}
        <Link to="/#admin-settings" className="font-medium text-foreground underline underline-offset-3">
          Settings
        </Link>
        .
      </p>
    </section>
  );
}
