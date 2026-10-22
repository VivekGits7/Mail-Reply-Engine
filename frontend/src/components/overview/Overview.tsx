import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ClipboardCheck, MailCheck, Users } from 'lucide-react';
import { Link } from 'react-router';
import { approvalListQuery } from '@/components/approvals/Approvalsapi';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState, TableSkeleton } from '@/components/common/QueryState';
import { StatusBadge } from '@/components/common/StatusBadge';
import { exitListQuery } from '@/components/exits/Exitsapi';
import { joinerListQuery } from '@/components/joiners/Joinersapi';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/utils/utility';

export default function Overview() {
  const approvals = useQuery(approvalListQuery({ status: 'pending', limit: 5, offset: 0 }));
  const joiners = useQuery(joinerListQuery({ limit: 5, offset: 0 }));
  const exits = useQuery(exitListQuery({ limit: 5, offset: 0 }));

  return (
    <section>
      <PageHeader title="Overview" description="A quick view of cases and decisions waiting for HR." />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Summary
          to="/approvals"
          title="Drafts to review"
          value={approvals.data?.total}
          icon={<ClipboardCheck className="size-5" />}
        />
        <Summary
          to="/joiners"
          title="Joiners"
          value={joiners.data?.total}
          icon={<Users className="size-5" />}
        />
        <Summary
          to="/exits"
          title="Exits"
          value={exits.data?.total}
          icon={<MailCheck className="size-5" />}
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="min-w-0 rounded-lg border p-4 sm:p-5">
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
                    <span className="truncate">{item.summary || 'Draft to review'}</span>
                    <ArrowRight className="size-4 shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No drafts are waiting for review.</p>
          )}
        </section>
        <section className="min-w-0 rounded-lg border p-4 sm:p-5">
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
                      <span className="hidden text-xs text-muted-foreground sm:inline">
                        {formatDate(item.joining_date)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No joiner cases yet.</p>
          )}
        </section>
      </div>
    </section>
  );
}

function Summary({
  to,
  title,
  value,
  icon,
}: {
  to: string;
  title: string;
  value?: number;
  icon: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="rounded-lg border p-4 transition-colors hover:border-primary/50 hover:bg-muted/30"
    >
      <div className="mb-4 flex items-center justify-between text-muted-foreground">
        <span className="text-sm">{title}</span>
        {icon}
      </div>
      <p className="text-3xl font-semibold tabular-nums">{value ?? '—'}</p>
    </Link>
  );
}

function SectionTitle({ title, to }: { title: string; to: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="font-semibold">{title}</h2>
      <Button asChild size="sm" variant="ghost">
        <Link to={to}>
          View all <ArrowRight className="size-4" />
        </Link>
      </Button>
    </div>
  );
}
