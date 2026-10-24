import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { DateRange } from '@/components/common/DateRange';
import { FilterBar } from '@/components/common/FilterBar';
import { FilterSelect } from '@/components/common/FilterSelect';
import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/common/QueryState';
import { SearchInput } from '@/components/common/SearchInput';
import { TableShell } from '@/components/common/TableShell';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useUrlState } from '@/hooks/useUrlState';
import { ACTOR_LABELS, labelFrom } from '@/utils/labels';
import { formatDateTime, humanize } from '@/utils/utility';
import { ActorType, type ActorType as Actor, type SortOrder } from '@/types';
import { ActivityStats } from './ActivityStats';
import { actionLogQuery } from './Adminapi';

export default function ActionLog() {
  const { get, set, page } = useUrlState();
  const params = {
    ...page,
    case_id: get('case_id'),
    actor_type: get('actor_type') as Actor | undefined,
    action: get('action'),
    date_from: get('date_from') ? `${get('date_from')}T00:00:00` : undefined,
    date_to: get('date_to') ? `${get('date_to')}T23:59:59` : undefined,
    sort_order: (get('sort_order') ?? 'latest') as SortOrder,
  };
  const list = useQuery(actionLogQuery(params));
  return (
    <section>
      <PageHeader
        title="Activity log"
        description="Everything the agent, the system and HR users did, with who did it and when. Document content and personal details are never stored here."
      />
      <ActivityStats actor={params.actor_type} onActor={(actor_type) => set({ actor_type })} />
      <FilterBar>
        <SearchInput label="Action name" value={params.action} onSearch={(action) => set({ action })} />
        <FilterSelect
          label="Done by"
          value={params.actor_type}
          options={Object.values(ActorType).map((value) => ({ value, label: ACTOR_LABELS[value] }))}
          onChange={(actor_type) => set({ actor_type })}
        />
        <DateRange
          label="Occurred"
          from={get('date_from')}
          to={get('date_to')}
          onChange={(date_from, date_to) => set({ date_from, date_to })}
        />
        <FilterSelect
          label="Order"
          value={params.sort_order}
          options={[
            { value: 'latest', label: 'Newest' },
            { value: 'oldest', label: 'Oldest' },
          ]}
          onChange={(sort_order) => set({ sort_order })}
        />
      </FilterBar>
      {list.isPending ? (
        <TableSkeleton />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : !list.data.data.length ? (
        <EmptyState
          title={
            params.action || params.actor_type || get('date_from') || get('date_to')
              ? 'No activity matches'
              : 'No activity yet'
          }
          description={
            params.action || params.actor_type || get('date_from') || get('date_to')
              ? 'Change who did it, the action or the dates.'
              : 'Every email, check, approval and settings change is recorded here as it happens.'
          }
        />
      ) : (
        <>
          <TableShell>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Done by</TableHead>
                  <TableHead>Case</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.data.map((item) => (
                  <TableRow key={item.action_log_id}>
                    <TableCell className="font-mono text-xs whitespace-nowrap tabular-nums">
                      {formatDateTime(item.occurred_at)}
                    </TableCell>
                    <TableCell className="font-medium">{humanize(item.action)}</TableCell>
                    <TableCell>
                      {item.actor_type === 'user' && item.actor_name
                        ? item.actor_name
                        : labelFrom(ACTOR_LABELS, item.actor_type)}
                    </TableCell>
                    <TableCell>
                      {item.case_id ? (
                        <Link
                          to={`/cases/${item.case_id}`}
                          className="text-sm hover:text-primary hover:underline"
                        >
                          Open case
                        </Link>
                      ) : (
                        '—'
                      )}
                    </TableCell>
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
