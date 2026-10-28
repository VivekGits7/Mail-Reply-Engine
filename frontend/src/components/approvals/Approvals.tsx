import { useQuery } from '@tanstack/react-query';
import { MailCheck, Presentation } from 'lucide-react';
import { Link } from 'react-router';
import { FilterBar } from '@/components/common/FilterBar';
import { FilterSelect } from '@/components/common/FilterSelect';
import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/common/QueryState';
import { SortSelect, type SortOption } from '@/components/common/SortSelect';
import { StatusBadge } from '@/components/common/StatusBadge';
import { TableShell } from '@/components/common/TableShell';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useLocalListState as useUrlState } from '@/hooks/useLocalListState';
import { optionsFrom, statusLabel } from '@/utils/labels';
import { formatRelative } from '@/utils/utility';
import { ApprovalStatus, ApprovalType, type SortOrder } from '@/types';
import { Avatar } from '@/components/visual/Avatar';
import { SelectField } from '@/components/common/SelectField';
import { cn } from '@/utils/cn';
import { ApprovalStats } from './ApprovalStats';
import { approvalListQuery } from './Approvalsapi';

const TYPE_LABELS: Record<string, string> = { reply: 'Reply draft', induction_schedule: 'Induction plan' };

const SORT_OPTIONS: SortOption[] = [
  { label: 'Newest first', sort_order: 'latest' },
  { label: 'Oldest first', sort_order: 'oldest' },
];

export default function Approvals() {
  const { get, set, page } = useUrlState();
  const status = (get('status') ?? ApprovalStatus.PENDING) as ApprovalStatus;
  const filters = {
    status,
    approval_type: get('approval_type') as ApprovalType | undefined,
    sort_order: (get('sort_order') ?? 'oldest') as SortOrder,
  };
  const approvals = useQuery(approvalListQuery({ ...filters, ...page }));

  return (
    <section>
      <PageHeader
        title="Approvals"
        description="Replies and induction plans the agent drafted. Nothing in this queue is sent until someone approves it."
      />
      <ApprovalStats
        status={status}
        approvalType={filters.approval_type}
        onType={(value) => set({ approval_type: value })}
        onStatus={(value) => set({ status: value })}
      />
      <FilterBar>
        <SelectField
          aria-label="Status"
          prefix="Status"
          value={status}
          onValueChange={(next) => set({ status: next === ApprovalStatus.PENDING ? undefined : next })}
          options={Object.values(ApprovalStatus).map((value) => ({ value, label: statusLabel(value).label }))}
        />
        <FilterSelect
          label="Type"
          value={filters.approval_type}
          options={optionsFrom(ApprovalType, TYPE_LABELS)}
          onChange={(value) => set({ approval_type: value })}
        />
        <SortSelect
          options={SORT_OPTIONS}
          sortOrder={filters.sort_order}
          onChange={(_sortBy, sortOrder) => set({ sort_order: sortOrder })}
        />
      </FilterBar>

      {approvals.isPending ? (
        <TableSkeleton />
      ) : approvals.isError ? (
        <ErrorState error={approvals.error} onRetry={() => approvals.refetch()} />
      ) : approvals.data.data.length === 0 ? (
        <EmptyState
          title={
            status === ApprovalStatus.PENDING
              ? 'Nothing waiting for approval'
              : 'No approvals match these filters'
          }
          description="Drafts land here when the agent is unsure or a reply needs a human."
        />
      ) : (
        <>
          <TableShell>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Draft</TableHead>
                  <TableHead>For</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approvals.data.data.map((approval) => (
                  <TableRow key={approval.approval_id}>
                    <TableCell className="max-w-md whitespace-normal">
                      <div className="flex items-start gap-3">
                        <span
                          className={cn(
                            'flex size-10 shrink-0 items-center justify-center rounded-2xl',
                            approval.approval_type === 'reply'
                              ? 'bg-iris/12 text-iris'
                              : 'bg-azure/12 text-azure',
                          )}
                        >
                          {approval.approval_type === 'reply' ? (
                            <MailCheck className="size-4.5" aria-hidden="true" />
                          ) : (
                            <Presentation className="size-4.5" aria-hidden="true" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <Link
                            to={`/approvals/${approval.approval_id}`}
                            className="font-medium hover:text-primary hover:underline"
                          >
                            {TYPE_LABELS[approval.approval_type]}
                          </Link>
                          {approval.summary && (
                            <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                              {approval.summary}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {approval.person_name ? (
                        <span className="flex items-center gap-2">
                          <Avatar name={approval.person_name} size="sm" />
                          {approval.person_name}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={approval.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {formatRelative(approval.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableShell>
          <Pagination
            total={approvals.data.total}
            limit={page.limit}
            offset={page.offset}
            onChange={(offset) => set({ offset: String(offset) }, { keepPage: true })}
          />
        </>
      )}
    </section>
  );
}
