import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RotateCw } from 'lucide-react';
import { Link } from 'react-router';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { FilterBar } from '@/components/common/FilterBar';
import { FilterSelect } from '@/components/common/FilterSelect';
import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/common/QueryState';
import { SearchInput } from '@/components/common/SearchInput';
import { TableShell } from '@/components/common/TableShell';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useUrlState } from '@/hooks/useUrlState';
import { selectIsAdmin } from '@/redux/authSlice';
import { useAppSelector } from '@/redux/hooks';
import { getErrorMessage } from '@/utils/apiError';
import { showToast } from '@/utils/toast';
import { formatDate, humanize } from '@/utils/utility';
import { FailureKind, type FailureKind as Kind, type FailureItem } from '@/types';
import { adminApi, adminKeys, failuresQuery } from './Adminapi';

export default function Failures() {
  const { get, set, page } = useUrlState();
  const isAdmin = useAppSelector(selectIsAdmin);
  const params = { ...page, kind: get('kind') as Kind | undefined, event_type: get('event_type') };
  const list = useQuery(failuresQuery(params));
  return (
    <section>
      <PageHeader
        title="Failed work"
        description="Events and scheduled jobs that ran out of retries. Review the error before requeuing."
      />
      <FilterBar>
        <SearchInput
          label="Event type"
          value={params.event_type}
          onSearch={(event_type) => set({ event_type })}
        />
        <FilterSelect
          label="Kind"
          value={params.kind}
          options={Object.values(FailureKind).map((value) => ({ value, label: humanize(value) }))}
          onChange={(kind) => set({ kind })}
        />
      </FilterBar>
      {list.isPending ? (
        <TableSkeleton />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : !list.data.data.length ? (
        <EmptyState
          title="No failed work"
          description="The queue has no exhausted events or jobs in this view."
        />
      ) : (
        <>
          <TableShell>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Last error</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Case</TableHead>
                  {isAdmin && <TableHead>Action</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.data.map((item) => (
                  <TableRow key={item.failure_id}>
                    <TableCell>
                      <span className="font-medium">{item.event_type}</span>
                      <span className="block text-xs text-muted-foreground">{item.kind}</span>
                    </TableCell>
                    <TableCell>{item.attempts}</TableCell>
                    <TableCell className="max-w-xs text-xs break-words whitespace-normal text-muted-foreground">
                      {item.last_error ?? '—'}
                    </TableCell>
                    <TableCell>{formatDate(item.updated_at)}</TableCell>
                    <TableCell>
                      {item.case_id ? (
                        <Link
                          to={`/cases/${item.case_id}`}
                          className="font-mono text-xs hover:text-primary hover:underline"
                        >
                          Open case
                        </Link>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <RetryFailure item={item} />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableShell>
          <Pagination
            total={list.data.total}
            limit={page.limit}
            offset={page.offset}
            onChange={(offset) => set({ offset: String(offset) }, { keepPage: true })}
          />
        </>
      )}
    </section>
  );
}

function RetryFailure({ item }: { item: FailureItem }) {
  const cache = useQueryClient();
  const retry = useMutation({
    mutationFn: () => adminApi.retryFailure(item.failure_id, item.kind),
    onSuccess: () => {
      cache.invalidateQueries({ queryKey: ['admin', 'failures'] });
      cache.invalidateQueries({ queryKey: adminKeys.status });
      showToast.success('Work requeued');
    },
    onError: (error) => showToast.error(getErrorMessage(error)),
  });
  return (
    <ConfirmDialog
      title="Retry failed work?"
      description={`Requeue ${item.event_type}. This may repeat the operation.`}
      confirmLabel="Retry"
      onConfirm={() => retry.mutate()}
      trigger={
        <Button variant="outline" size="sm" disabled={retry.isPending}>
          <RotateCw className="size-4" /> Retry
        </Button>
      }
    />
  );
}
