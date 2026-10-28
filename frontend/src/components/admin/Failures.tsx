import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleAlert, RotateCw } from 'lucide-react';
import { Link } from 'react-router';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { FilterBar } from '@/components/common/FilterBar';
import { FilterSelect } from '@/components/common/FilterSelect';
import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/common/QueryState';
import { TableShell } from '@/components/common/TableShell';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useLocalListState as useUrlState } from '@/hooks/useLocalListState';
import { selectIsAdmin } from '@/redux/authSlice';
import { useAppSelector } from '@/redux/hooks';
import { getErrorMessage } from '@/utils/apiError';
import { FAILURE_KIND_LABELS, failureReason, workLabel, type FailureCause } from '@/utils/systemState';
import { showToast } from '@/utils/toast';
import { formatDateTime, formatRelative } from '@/utils/utility';
import { FailureKind, type FailureKind as Kind, type FailureItem } from '@/types';
import { adminApi, adminKeys, failuresQuery } from './Adminapi';

const WORK_OPTIONS = [
  { value: 'send_email', label: 'Send an email' },
  { value: 'email.received', label: 'Read an incoming email' },
  { value: 'documents.check', label: 'Check a document' },
  { value: 'induction.draft', label: 'Draft an induction plan' },
  { value: 'approval.approved', label: 'Send an approved draft' },
  { value: 'feedback.report', label: 'Build the feedback report' },
];

const CAUSE_BANNERS: Partial<Record<FailureCause, { title: string; detail: string }>> = {
  microsoft_login: {
    title: 'Emails are not going out because the Microsoft 365 sign-in is failing',
    detail:
      'The agent cannot log in to the mailbox, so every send fails. This is a server setting, not something HR did. IT needs to check the app registration client ID, secret and tenant. Once it works, retry the items below.',
  },
  microsoft_missing: {
    title: 'Microsoft 365 is not connected yet',
    detail:
      'IT needs to add the Microsoft Graph app details on the server. Once they are added, retry the items below.',
  },
  smtp_login: {
    title: 'Emails are not going out because the email server sign-in is failing',
    detail: 'IT needs to check the SMTP username and password on the server. Once it works, retry the items below.',
  },
  smtp_missing: {
    title: 'The email server is not set up yet',
    detail: 'IT needs to add the SMTP settings on the server. Once they are added, retry the items below.',
  },
};

export default function Failures() {
  const { get, set, page } = useUrlState();
  const isAdmin = useAppSelector(selectIsAdmin);
  const params = { ...page, kind: get('kind') as Kind | undefined, event_type: get('event_type') };
  const list = useQuery(failuresQuery(params));
  const hasFilters = Boolean(params.kind || params.event_type);
  const banner = list.data?.data
    .map((item) => CAUSE_BANNERS[failureReason(item.last_error).cause])
    .find(Boolean);

  return (
    <section>
      <PageHeader
        title="Failures"
        description="Work the agent tried several times and could not finish, like an email that would not send. Each row says why. Fix the cause, then retry."
      />
      <FilterBar>
        <FilterSelect
          label="Work"
          value={params.event_type}
          allLabel="Any"
          options={WORK_OPTIONS}
          onChange={(event_type) => set({ event_type })}
        />
        <FilterSelect
          label="Kind"
          value={params.kind}
          allLabel="Any"
          options={Object.values(FailureKind).map((value) => ({ value, label: FAILURE_KIND_LABELS[value] }))}
          onChange={(kind) => set({ kind })}
        />
      </FilterBar>
      {banner && (
        <div
          role="alert"
          className="mb-4 flex gap-3 rounded-3xl border border-destructive/20 bg-destructive/6 p-5"
        >
          <CircleAlert className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-medium text-destructive">{banner.title}</p>
            <p className="mt-1 text-sm text-pretty text-muted-foreground">{banner.detail}</p>
          </div>
        </div>
      )}
      {list.isPending ? (
        <TableSkeleton />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : !list.data.data.length ? (
        <EmptyState
          title={hasFilters ? 'No failures match these filters' : 'Nothing has failed'}
          description={
            hasFilters
              ? 'Clear a filter to see every failure.'
              : 'When the agent cannot finish something after every retry, it shows up here with the reason and a retry button.'
          }
        />
      ) : (
        <>
          <TableShell>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>What failed</TableHead>
                  <TableHead>Why</TableHead>
                  <TableHead>Tries</TableHead>
                  <TableHead>Last try</TableHead>
                  <TableHead>Case</TableHead>
                  {isAdmin && <TableHead>Action</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.data.map((item) => {
                  const reason = failureReason(item.last_error);
                  return (
                    <TableRow key={item.failure_id}>
                      <TableCell className="align-top">
                        <span className="font-medium">{workLabel(item.event_type)}</span>
                        <span className="block text-xs text-muted-foreground">
                          {FAILURE_KIND_LABELS[item.kind] ?? item.kind}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-sm align-top whitespace-normal">
                        <span className="font-medium">{reason.title}</span>
                        <span className="mt-0.5 block text-xs text-pretty text-muted-foreground">
                          {reason.fix}
                        </span>
                        {item.last_error && (
                          <details className="mt-1 text-xs text-muted-foreground">
                            <summary className="cursor-pointer select-none hover:text-foreground">
                              Error for IT
                            </summary>
                            <code className="mt-1 block font-mono break-words">{item.last_error}</code>
                          </details>
                        )}
                      </TableCell>
                      <TableCell className="align-top tabular-nums">{item.attempts}</TableCell>
                      <TableCell className="align-top tabular-nums" title={formatDateTime(item.updated_at)}>
                        {formatRelative(item.updated_at)}
                      </TableCell>
                      <TableCell className="align-top">
                        {item.case_id ? (
                          <Link
                            to={`/cases/${item.case_id}`}
                            className="text-sm hover:text-primary hover:underline"
                          >
                            Open case
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="align-top">
                          <RetryFailure item={item} />
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
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
  const label = workLabel(item.event_type);
  const retry = useMutation({
    mutationFn: () => adminApi.retryFailure(item.failure_id, item.kind),
    onSuccess: () => {
      cache.invalidateQueries({ queryKey: ['admin', 'failures'] });
      cache.invalidateQueries({ queryKey: adminKeys.status });
      showToast.success('Queued to run again');
    },
    onError: (error) => showToast.error(getErrorMessage(error)),
  });
  return (
    <ConfirmDialog
      title="Run this again?"
      description={`"${label}" goes back in the queue and runs again now. If the cause is not fixed yet, it fails again.`}
      confirmLabel="Retry"
      onConfirm={() => retry.mutate()}
      trigger={
        <Button variant="outline" size="sm" disabled={retry.isPending} aria-label={`Retry ${label}`}>
          <RotateCw className="size-4" aria-hidden="true" /> Retry
        </Button>
      }
    />
  );
}
