import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Power, Send } from 'lucide-react';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { PageHeader } from '@/components/common/PageHeader';
import { BlockSkeleton, ErrorState } from '@/components/common/QueryState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { selectIsAdmin } from '@/redux/authSlice';
import { useAppSelector } from '@/redux/hooks';
import { getErrorMessage } from '@/utils/apiError';
import { showToast } from '@/utils/toast';
import { formatRelative, humanize } from '@/utils/utility';
import { adminApi, adminKeys, statusQuery } from './Adminapi';

export default function Controls() {
  const isAdmin = useAppSelector(selectIsAdmin);
  const status = useQuery(statusQuery());
  const cache = useQueryClient();
  const [reason, setReason] = useState('');
  const [inbox, setInbox] = useState('');
  const kill = useMutation({
    mutationFn: (enabled: boolean) => adminApi.killSwitch({ enabled, reason: reason.trim() || null }),
    onSuccess: () => {
      cache.invalidateQueries({ queryKey: adminKeys.status });
      showToast.success('Sending control updated');
      setReason('');
    },
    onError: (error) => showToast.error(getErrorMessage(error)),
  });
  const dry = useMutation({
    mutationFn: (enabled: boolean) =>
      adminApi.dryRun({ enabled, test_inbox: (inbox.trim() || status.data?.test_inbox) ?? null }),
    onSuccess: () => {
      cache.invalidateQueries({ queryKey: adminKeys.status });
      showToast.success('Dry run updated');
      setInbox('');
    },
    onError: (error) => showToast.error(getErrorMessage(error)),
  });
  return (
    <section>
      <PageHeader
        title="Sending controls"
        description="Check the live mailbox, queue and sending mode before changing automation."
      />
      {status.isPending ? (
        <BlockSkeleton />
      ) : status.isError ? (
        <ErrorState error={status.error} onRetry={() => status.refetch()} />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <ControlCard
              title="Kill switch"
              icon={<Power className="size-5" />}
              state={status.data.kill_switch ? 'Sending stopped' : 'Sending allowed'}
              description="Stops every outgoing email within one minute."
              warning={status.data.kill_switch}
            >
              {isAdmin && (
                <div className="space-y-3">
                  <label className="block text-sm">
                    Reason, optional
                    <Input
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="Why is sending changing…"
                      className="mt-1"
                    />
                  </label>
                  <Button
                    variant={status.data.kill_switch ? 'default' : 'destructive'}
                    disabled={kill.isPending}
                    onClick={() => kill.mutate(!status.data.kill_switch)}
                  >
                    {kill.isPending
                      ? 'Updating…'
                      : status.data.kill_switch
                        ? 'Allow sending'
                        : 'Stop sending'}
                  </Button>
                </div>
              )}
            </ControlCard>
            <ControlCard
              title="Dry run"
              icon={<Send className="size-5" />}
              state={status.data.dry_run ? 'Test inbox only' : 'Real recipients'}
              description="In dry run, every email goes to the test inbox."
              warning={!status.data.dry_run}
            >
              {isAdmin && (
                <div className="space-y-3">
                  <label className="block text-sm">
                    Test inbox
                    <Input
                      type="email"
                      value={inbox}
                      onChange={(event) => setInbox(event.target.value)}
                      placeholder={status.data.test_inbox}
                      className="mt-1"
                    />
                  </label>
                  {status.data.dry_run && inbox.trim() && inbox.trim() !== status.data.test_inbox && (
                    <Button variant="outline" disabled={dry.isPending} onClick={() => dry.mutate(true)}>
                      Save test inbox
                    </Button>
                  )}
                  {status.data.dry_run ? (
                    <ConfirmDialog
                      title="Send to real recipients?"
                      description="Turning off dry run sends future emails to their real recipients if the kill switch allows sending."
                      confirmLabel="Switch to real recipients"
                      destructive
                      onConfirm={() => dry.mutate(false)}
                      trigger={
                        <Button variant="destructive" disabled={dry.isPending}>
                          {dry.isPending ? 'Updating…' : 'Switch to real recipients'}
                        </Button>
                      }
                    />
                  ) : (
                    <Button
                      disabled={dry.isPending || (!inbox && !status.data.test_inbox)}
                      onClick={() => dry.mutate(true)}
                    >
                      {dry.isPending ? 'Updating…' : 'Enable dry run'}
                    </Button>
                  )}
                </div>
              )}
            </ControlCard>
          </div>
          <div className="rounded-lg border p-4">
            <h2 className="mb-3 font-semibold">System status</h2>
            <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Mailbox subscription" value={humanize(status.data.mailbox.subscription)} />
              <Metric label="Last poll" value={formatRelative(status.data.mailbox.last_poll_at)} />
              <Metric label="Last email" value={formatRelative(status.data.mailbox.last_email_at)} />
              <Metric label="Queued events" value={status.data.queue.queued} />
              <Metric label="Failed events" value={status.data.queue.failed} />
              <Metric label="Processing" value={status.data.queue.processing} />
              <Metric label="Pending jobs" value={status.data.queue.pending_jobs} />
              <Metric label="Document reading" value={status.data.document_reading_enabled ? 'On' : 'Off'} />
              <Metric label="D365" value={status.data.d365_enabled ? 'On' : 'Off'} />
            </dl>
          </div>
        </div>
      )}
    </section>
  );
}

function ControlCard({
  title,
  icon,
  state,
  description,
  warning,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  state: string;
  description: string;
  warning: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border p-5">
      <div className="mb-3 flex items-center gap-2 text-muted-foreground">
        {icon}
        <h2 className="font-semibold text-foreground">{title}</h2>
      </div>
      <p className="flex items-center gap-2 font-medium">
        {warning && <AlertTriangle className="size-4 text-warning" />} {state}
      </p>
      <p className="my-3 text-sm text-muted-foreground">{description}</p>
      {children}
    </section>
  );
}
function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium tabular-nums">{value}</dd>
    </div>
  );
}
