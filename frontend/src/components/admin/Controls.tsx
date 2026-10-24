import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Power, Send } from 'lucide-react';
import { Link } from 'react-router';
import { z } from 'zod';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Field } from '@/components/common/Field';
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
import { SendingStatus } from './SendingStatus';

const inboxSchema = z.email();

export default function Controls() {
  const isAdmin = useAppSelector(selectIsAdmin);
  const status = useQuery(statusQuery());
  const failures = useQuery(failuresQuery({ limit: 1, offset: 0 }));

  return (
    <section>
      <PageHeader
        title="Controls"
        description="Stop or allow sending, choose where test emails go, and check that the mailbox is connected."
      />
      {!isAdmin && (
        <p className="mb-4 rounded-2xl bg-muted/70 px-4 py-3 text-sm text-muted-foreground">
          You can see the current state. Only HR admins can change these switches.
        </p>
      )}
      {status.isPending ? (
        <BlockSkeleton />
      ) : status.isError ? (
        <ErrorState error={status.error} onRetry={() => status.refetch()} />
      ) : (
        <div className="space-y-6">
          <SendingStatus status={status.data} failedCount={failures.data?.total} />
          <div className="grid gap-4 md:grid-cols-2">
            <KillSwitchCard status={status.data} isAdmin={isAdmin} />
            <DryRunCard key={status.data.test_inbox} status={status.data} isAdmin={isAdmin} />
          </div>
          <SystemDetails status={status.data} />
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
    return `Emails waiting in the queue go to the test inbox ${status.test_inbox}.`;
  if (status.dry_run) return 'Dry run has no test inbox yet, so emails stay on hold until you set one.';
  return 'Dry run is off. Emails waiting in the queue go to their real recipients right away.';
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
        res.data.kill_switch
          ? 'Sending stopped. Nothing goes out until it is allowed again.'
          : 'Sending allowed again',
      );
      setReason('');
    },
    onError: (error) => showToast.error(getErrorMessage(error)),
  });

  return (
    <ControlCard
      title="Kill switch"
      icon={<Power className="size-5" aria-hidden="true" />}
      state={on ? 'On, sending is stopped' : 'Off, sending is allowed'}
      alert={on}
      description="Stops every outgoing email within a minute, including follow-ups and approved replies. The agent keeps reading mail, and held emails go out once sending is allowed again."
    >
      {isAdmin && (
        <div className="space-y-3">
          <Field id="kill-reason" label="Reason" optional hint="Saved in the activity log">
            <Input
              id="kill-reason"
              value={reason}
              maxLength={300}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Wrong template went out…"
            />
          </Field>
          <ConfirmDialog
            title={on ? 'Allow sending again?' : 'Stop all sending?'}
            description={
              on
                ? allowDescription(status)
                : 'Every email, follow-up and approved reply waits until sending is allowed again. Incoming mail is still read.'
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
          ? `Dry run on. Test emails go to ${res.data.test_inbox}.`
          : 'Dry run off. Emails now go to their real recipients.',
      );
    },
    onError: (reason) => showToast.error(getErrorMessage(reason)),
  });

  function saveInbox(event: React.FormEvent) {
    event.preventDefault();
    if (!inboxSchema.safeParse(trimmed).success) {
      setError('Enter an email address like hr-test@tcgdigital.com');
      return;
    }
    setError('');
    dry.mutate({ enabled: true, test_inbox: trimmed });
  }

  const state = !status.dry_run
    ? 'Off, emails go to real people'
    : status.test_inbox
      ? `On, test emails go to ${status.test_inbox}`
      : 'On, but no test inbox is set';

  return (
    <ControlCard
      title="Dry run"
      icon={<Send className="size-5" aria-hidden="true" />}
      state={state}
      alert={!status.dry_run || held}
      description="While dry run is on, every email goes to the test inbox instead of candidates, recruiters and teams. The subject line shows who it was meant for. Keep it on until the templates and team addresses are checked."
    >
      {held && (
        <p
          role="alert"
          className="mb-3 rounded-2xl border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive"
        >
          No test inbox is set, so every email is on hold. Add one below to start test sending.
        </p>
      )}
      {isAdmin && (
        <form noValidate onSubmit={saveInbox} className="space-y-3">
          <Field
            id="test-inbox"
            label="Test inbox"
            error={error}
            hint="A mailbox your team reads, used only for test emails"
          >
            <Input
              type="email"
              autoComplete="email"
              spellCheck={false}
              autoCapitalize="none"
              placeholder="hr-test@tcgdigital.com…"
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
                  title="Send to real recipients?"
                  description={`Candidates, recruiters and teams will get the agent's emails directly, including anything waiting in the queue. Only do this once the templates and team addresses are checked.${
                    status.kill_switch
                      ? ' The kill switch is on, so nothing goes out until sending is allowed.'
                      : ''
                  }`}
                  confirmLabel="Switch to real recipients"
                  destructive
                  onConfirm={() => dry.mutate({ enabled: false, test_inbox: null })}
                  trigger={
                    <Button type="button" variant="outline" disabled={dry.isPending}>
                      Switch to real recipients
                    </Button>
                  }
                />
              </>
            ) : (
              <Button type="submit" disabled={dry.isPending || !trimmed}>
                {dry.isPending ? 'Updating…' : 'Turn dry run back on'}
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
  state,
  description,
  alert,
  children,
}: {
  title: string;
  icon: ReactNode;
  state: string;
  description: string;
  alert: boolean;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col panel p-6">
      <div className="mb-3 flex items-center gap-2 text-muted-foreground">
        {icon}
        <h2 className="text-lg font-normal tracking-tight text-foreground">{title}</h2>
      </div>
      <p className={cn('flex items-start gap-2 font-medium break-words', alert && 'text-warning')}>
        {alert && <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
        <span className="min-w-0">{state}</span>
      </p>
      <p className="my-3 text-sm text-pretty text-muted-foreground">{description}</p>
      {children}
    </section>
  );
}

function SystemDetails({ status }: { status: StatusData }) {
  const { mailbox, queue } = status;
  return (
    <section aria-labelledby="system-details" className="panel p-6">
      <h2 id="system-details" className="font-semibold">
        Mailbox, queue and integrations
      </h2>
      <dl className="mt-4 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <Metric
          label="Last mailbox check"
          value={formatRelative(mailbox.last_poll_at)}
          hint={
            mailbox.last_poll_at
              ? formatDateTime(mailbox.last_poll_at)
              : 'The agent has not checked the mailbox yet'
          }
        />
        <Metric
          label="Last email received"
          value={formatRelative(mailbox.last_email_at)}
          hint={mailbox.last_email_at ? formatDateTime(mailbox.last_email_at) : 'No email has arrived yet'}
        />
        <Metric
          label="Instant notifications"
          value={
            mailbox.subscription_expires_at
              ? `Renew by ${formatDateTime(mailbox.subscription_expires_at)}`
              : 'Not set up'
          }
          hint="Renewed automatically. The 2 minute mailbox check covers any gap."
        />
        <Metric
          label="Incoming work waiting"
          value={queue.queued}
          hint="New emails and HR actions queued for the agent"
        />
        <Metric label="Being worked on" value={queue.processing} hint="Picked up by the agent right now" />
        <Metric
          label="Emails and follow-ups scheduled"
          value={queue.pending_jobs}
          hint="Sent when due, inside the sending window"
        />
        <Metric
          label="Document reading"
          value={status.document_reading_enabled ? 'On' : 'Off'}
          hint={
            status.document_reading_enabled
              ? 'The agent reads documents to check type and name.'
              : 'Off until security approves. Files are stored, and HR checks them by hand.'
          }
        />
        <Metric
          label="D365"
          value={status.d365_enabled ? 'On' : 'Off'}
          hint={
            status.d365_enabled
              ? 'Status changes are read from D365.'
              : 'Off until D365 access arrives. Data comes from this dashboard and uploads.'
          }
        />
      </dl>
      <p className="mt-4 text-sm text-muted-foreground">
        Document reading and D365 are switched in{' '}
        <Link to="/admin/settings" className="font-medium text-foreground underline underline-offset-3">
          Settings
        </Link>
        .
      </p>
    </section>
  );
}

function Metric({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium tabular-nums">{value}</dd>
      <dd className="mt-0.5 text-xs text-pretty text-muted-foreground">{hint}</dd>
    </div>
  );
}
