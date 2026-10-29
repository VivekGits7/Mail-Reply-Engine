import { useQuery } from '@tanstack/react-query';
import { Eye, MailCheck, Presentation, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { FilterBar } from '@/components/common/FilterBar';
import { FilterSelect } from '@/components/common/FilterSelect';
import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/common/QueryState';
import { SortSelect, type SortOption } from '@/components/common/SortSelect';
import { StatusBadge } from '@/components/common/StatusBadge';
import { TableShell } from '@/components/common/TableShell';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useLocalListState as useUrlState } from '@/hooks/useLocalListState';
import { optionsFrom, statusLabel } from '@/utils/labels';
import { formatRelative } from '@/utils/utility';
import { ApprovalStatus, ApprovalType, type ApprovalListItem, type SortOrder } from '@/types';
import { Avatar } from '@/components/visual/Avatar';
import { cn } from '@/utils/cn';
import { approvalListQuery } from './Approvalsapi';

const TYPE_LABELS: Record<string, string> = { reply: 'Reply draft', induction_schedule: 'Induction plan' };

const PLACEHOLDER_APPROVALS: Partial<ApprovalListItem>[] = [
  {
    approval_id: 'sample-pending',
    approval_type: ApprovalType.REPLY,
    status: ApprovalStatus.PENDING,
    summary: 'Sample draft — query reply',
    person_name: 'Sample Candidate',
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    approval_id: 'sample-approved',
    approval_type: ApprovalType.INDUCTION_SCHEDULE,
    status: ApprovalStatus.APPROVED,
    summary: 'Sample draft — already approved',
    person_name: 'Sample Joiner',
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    approval_id: 'sample-rejected',
    approval_type: ApprovalType.REPLY,
    status: ApprovalStatus.REJECTED,
    summary: 'Sample draft — already rejected',
    person_name: 'Sample Employee',
    created_at: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
  },
  {
    approval_id: 'sample-sent',
    approval_type: ApprovalType.REPLY,
    status: ApprovalStatus.SENT,
    summary: 'Sample draft — sent to recipient',
    person_name: 'Sample Employee',
    created_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
  },
];

const SORT_OPTIONS: SortOption[] = [
  { label: 'Newest first', sort_order: 'latest' },
  { label: 'Oldest first', sort_order: 'oldest' },
];

export default function Approvals() {
  const navigate = useNavigate();
  const { get, set, page } = useUrlState();
  const status = get('status') as ApprovalStatus | undefined;
  const filters = {
    status,
    approval_type: get('approval_type') as ApprovalType | undefined,
    sort_order: (get('sort_order') ?? 'oldest') as SortOrder,
  };
  const approvals = useQuery(approvalListQuery({ ...filters, ...page }));
  const placeholders = PLACEHOLDER_APPROVALS.filter(
    (item) =>
      (!status || item.status === status) &&
      (!filters.approval_type || item.approval_type === filters.approval_type),
  );
  const rows = approvals.data
    ? [...approvals.data.data, ...placeholders].sort((a, b) => {
        const diff = new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime();
        return filters.sort_order === 'latest' ? -diff : diff;
      })
    : undefined;
  const hasActiveFilters = Boolean(status || filters.approval_type || get('sort_order'));

  return (
    <section>
      <PageHeader title="Approvals" />
      <FilterBar>
        <FilterSelect
          label="Status"
          value={status}
          options={Object.values(ApprovalStatus).map((value) => ({ value, label: statusLabel(value).label }))}
          onChange={(value) => set({ status: value })}
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
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => set({ status: undefined, approval_type: undefined, sort_order: undefined })}
          >
            <X aria-hidden="true" />
            Clear filters
          </Button>
        )}
      </FilterBar>

      {approvals.isPending ? (
        <TableSkeleton />
      ) : approvals.isError ? (
        <ErrorState error={approvals.error} onRetry={() => approvals.refetch()} />
      ) : !rows?.length ? (
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
                  <TableHead className="text-right">View</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((approval) => {
                  const to = `/approvals/${approval.approval_id}`;
                  return (
                  <TableRow
                    key={approval.approval_id}
                    className="cursor-pointer"
                    onClick={(event) => {
                      if ((event.target as HTMLElement).closest('a')) return;
                      navigate(to);
                    }}
                  >
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
                          <Link to={to} className="font-medium hover:text-primary hover:underline">
                            {TYPE_LABELS[approval.approval_type!]}
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
                    <TableCell className="text-right">
                      <Link
                        to={to}
                        aria-label="View draft"
                        className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <Eye className="size-4" aria-hidden="true" />
                      </Link>
                    </TableCell>
                  </TableRow>
                  );
                })}
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
