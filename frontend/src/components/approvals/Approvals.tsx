import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { FilterBar } from '@/components/common/FilterBar';
import { FilterSelect } from '@/components/common/FilterSelect';
import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/common/QueryState';
import { SortSelect, type SortOption } from '@/components/common/SortSelect';
import { StatusBadge } from '@/components/common/StatusBadge';
import { TableShell } from '@/components/common/TableShell';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useUrlState } from '@/hooks/useUrlState';
import { optionsFrom, statusLabel } from '@/utils/labels';
import { formatRelative } from '@/utils/utility';
import { ApprovalStatus, ApprovalType, type SortOrder } from '@/types';
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
      <FilterBar>
        <NativeSelect
          aria-label="Status"
          value={status}
          className="w-full sm:w-auto"
          onChange={(event) => set({ status: event.target.value === ApprovalStatus.PENDING ? undefined : event.target.value })}
        >
          {Object.values(ApprovalStatus).map((value) => (
            <NativeSelectOption key={value} value={value}>
              Status: {statusLabel(value).label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
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
          title={status === ApprovalStatus.PENDING ? 'Nothing waiting for approval' : 'No approvals match these filters'}
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
                      <Link
                        to={`/approvals/${approval.approval_id}`}
                        className="font-medium hover:text-primary hover:underline"
                      >
                        {TYPE_LABELS[approval.approval_type]}
                      </Link>
                      {approval.summary && (
                        <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{approval.summary}</span>
                      )}
                    </TableCell>
                    <TableCell>{approval.person_name ?? '—'}</TableCell>
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
