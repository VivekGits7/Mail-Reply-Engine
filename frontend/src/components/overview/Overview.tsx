import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import { selectIsAdmin } from '@/redux/authSlice';
import { useAppSelector } from '@/redux/hooks';
import { failuresQuery, settingsQuery, statusQuery } from '@/components/admin/Adminapi';
import { SendingStatus } from '@/components/admin/SendingStatus';
import { approvalListQuery } from '@/components/approvals/Approvalsapi';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState, TableSkeleton } from '@/components/common/QueryState';
import { StatusBadge } from '@/components/common/StatusBadge';
import { exitListQuery } from '@/components/exits/Exitsapi';
import { joinerListQuery } from '@/components/joiners/Joinersapi';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { missingContacts, requiredContactCount, setupSteps } from '@/utils/setup';
import { formatDate } from '@/utils/utility';
import { SetupChecklist } from './SetupChecklist';

const APPROVAL_LABELS: Record<string, string> = { reply: 'Reply draft', induction_schedule: 'Induction plan' };

export default function Overview() {
  const isAdmin = useAppSelector(selectIsAdmin);
  const approvals = useQuery(approvalListQuery({ status: 'pending', limit: 5, offset: 0 }));
  const joiners = useQuery(joinerListQuery({ limit: 5, offset: 0 }));
  const signOff = useQuery(joinerListQuery({ stage: 'ready_for_signoff', limit: 1, offset: 0 }));
  const release = useQuery(exitListQuery({ stage: 'all_cleared', limit: 1, offset: 0 }));
  const failures = useQuery(failuresQuery({ limit: 1, offset: 0 }));
  const status = useQuery(statusQuery());
  const settings = useQuery(settingsQuery());

  return (
    <section>
      <PageHeader
        title="Overview"
        description="What the email agent is doing right now, and the decisions waiting for HR."
      />

      {status.data && settings.data && joiners.data && (
        <SetupChecklist
          steps={setupSteps({
            testInbox: status.data.test_inbox,
            settings: settings.data,
            joinerCount: joiners.data.total,
          })}
          testInbox={status.data.test_inbox}
          dryRun={status.data.dry_run}
          missingContacts={missingContacts(settings.data).length}
          totalContacts={requiredContactCount(settings.data)}
          isAdmin={isAdmin}
        />
      )}

      {status.isPending ? (
        <Skeleton className="mb-6 h-40 w-full" />
      ) : status.isError ? (
        <div className="mb-6">
          <ErrorState error={status.error} onRetry={() => status.refetch()} />
        </div>
      ) : (
        <SendingStatus status={status.data} failedCount={failures.data?.total} showControlsLink className="mb-6" />
      )}

      <h2 className="mb-3 text-sm font-semibold">Waiting for HR</h2>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Summary
          to="/approvals"
          title="Drafts to review"
          hint="AI-written replies and induction plans"
          query={approvals}
        />
        <Summary
          to="/joiners?stage=ready_for_signoff"
          title="Ready for sign-off"
          hint="Joiners with every document verified"
          query={signOff}
        />
        <Summary
          to="/exits?stage=all_cleared"
          title="Ready for release"
          hint="Exits where every team has cleared"
          query={release}
        />
        <Summary to="/admin/failures" title="Failed work" hint="Work that ran out of retries" query={failures} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="min-w-0 rounded-lg border bg-card p-4 sm:p-5">
          <SectionTitle title="Pending approvals" to="/approvals" />
          {approvals.isPending ? (
            <TableSkeleton rows={3} />
          ) : approvals.isError ? (
            <ErrorState error={approvals.error} onRetry={() => approvals.refetch()} />
          ) : approvals.data.data.length ? (
            <ul className="divide-y">
              {approvals.data.data.map((item) => (
                <li key={item.approval_id}>
                  <Link
                    className="flex items-center justify-between gap-3 py-3 text-sm hover:text-primary"
                    to={`/approvals/${item.approval_id}`}
                  >
                    <span className="min-w-0 truncate">
                      {item.summary || APPROVAL_LABELS[item.approval_type] || 'Draft to review'}
                    </span>
                    <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nothing to approve. Replies the agent writes itself wait here until an admin approves them.
            </p>
          )}
        </section>
        <section className="min-w-0 rounded-lg border bg-card p-4 sm:p-5">
          <SectionTitle title="Recent joiners" to="/joiners" />
          {joiners.isPending ? (
            <TableSkeleton rows={3} />
          ) : joiners.isError ? (
            <ErrorState error={joiners.error} onRetry={() => joiners.refetch()} />
          ) : joiners.data.data.length ? (
            <ul className="divide-y">
              {joiners.data.data.map((item) => (
                <li key={item.case_id}>
                  <Link
                    className="flex items-center justify-between gap-3 py-3 text-sm hover:text-primary"
                    to={`/cases/${item.case_id}`}
                  >
                    <span className="min-w-0 truncate">{item.full_name}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <StatusBadge value={item.stage} />
                      <span className="hidden text-xs text-muted-foreground tabular-nums sm:inline">
                        {formatDate(item.joining_date)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No joiners yet. Each joiner you add gets a document checklist and automatic follow-ups.
            </p>
          )}
        </section>
      </div>
    </section>
  );
}

interface SummaryProps {
  to: string;
  title: string;
  hint: string;
  query: { isPending: boolean; isError: boolean; data?: { total: number } };
}

function Summary({ to, title, hint, query }: SummaryProps) {
  let value: ReactNode;
  if (query.isPending) value = <Skeleton className="h-9 w-12" />;
  else if (query.isError || !query.data) value = <span className="text-sm font-normal text-muted-foreground">Unavailable</span>;
  else value = query.data.total;

  return (
    <Link
      to={to}
      className="flex flex-col rounded-lg border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-muted/30 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <span className="text-sm font-medium">{title}</span>
      <span className="mt-2 flex h-9 items-center text-3xl font-semibold tabular-nums">{value}</span>
      <span className="mt-1 text-xs text-muted-foreground">{hint}</span>
    </Link>
  );
}

function SectionTitle({ title, to }: { title: string; to: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="font-semibold">{title}</h2>
      <Button asChild size="sm" variant="ghost">
        <Link to={to}>
          View all <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </Button>
    </div>
  );
}
