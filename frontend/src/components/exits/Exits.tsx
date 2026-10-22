import { useQuery } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';
import { Link } from 'react-router';
import { selectIsAdmin } from '@/redux/authSlice';
import { useAppSelector } from '@/redux/hooks';
import { DateRange } from '@/components/common/DateRange';
import { FilterBar } from '@/components/common/FilterBar';
import { FilterSelect } from '@/components/common/FilterSelect';
import { FlagList } from '@/components/common/FlagList';
import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/common/QueryState';
import { SearchInput } from '@/components/common/SearchInput';
import { SortSelect, type SortOption } from '@/components/common/SortSelect';
import { StatusBadge } from '@/components/common/StatusBadge';
import { TableShell } from '@/components/common/TableShell';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useUrlState } from '@/hooks/useUrlState';
import { TEAM_LABELS, optionsFrom } from '@/utils/labels';
import { formatDate, formatRelative } from '@/utils/utility';
import { ClearanceTeam, ExitStage, type ExitSortBy, type SortOrder } from '@/types';
import { ClearanceChips } from './ClearanceChips';
import { ExitFormDialog } from './ExitFormDialog';
import { exitListQuery } from './Exitsapi';

const SORT_OPTIONS: SortOption[] = [
  { label: 'Newest first', sort_by: 'created_at', sort_order: 'latest' },
  { label: 'Last day soonest', sort_by: 'last_working_day', sort_order: 'oldest' },
  { label: 'Last day latest', sort_by: 'last_working_day', sort_order: 'latest' },
  { label: 'Name A to Z', sort_by: 'full_name', sort_order: 'a_to_z' },
];

export default function Exits() {
  const isAdmin = useAppSelector(selectIsAdmin);
  const { get, set, page } = useUrlState();
  const search = get('search');
  const filters = {
    search,
    stage: get('stage') as ExitStage | undefined,
    pending_team: get('pending_team') as ClearanceTeam | undefined,
    lwd_from: get('lwd_from'),
    lwd_to: get('lwd_to'),
    sort_by: (get('sort_by') ?? 'created_at') as ExitSortBy,
    sort_order: (get('sort_order') ?? 'latest') as SortOrder,
  };
  const exits = useQuery(exitListQuery({ ...filters, ...page }));
  const hasFilters = Boolean(search || filters.stage || filters.pending_team || filters.lwd_from || filters.lwd_to);

  return (
    <section>
      <PageHeader
        title="Exits"
        description="Clearances the agent is chasing with IT, Finance, Admin and the manager."
        actions={
          isAdmin && (
            <ExitFormDialog
              trigger={
                <Button>
                  <LogOut aria-hidden="true" />
                  Start exit
                </Button>
              }
            />
          )
        }
      />

      <FilterBar>
        <SearchInput label="Search name or ID" value={search} onSearch={(value) => set({ search: value })} />
        <FilterSelect
          label="Stage"
          value={filters.stage}
          options={optionsFrom(ExitStage)}
          onChange={(value) => set({ stage: value })}
        />
        <FilterSelect
          label="Waiting on"
          value={filters.pending_team}
          allLabel="Any team"
          options={optionsFrom(ClearanceTeam, TEAM_LABELS)}
          onChange={(value) => set({ pending_team: value })}
        />
        <DateRange
          label="Last working day"
          from={filters.lwd_from}
          to={filters.lwd_to}
          onChange={(from, to) => set({ lwd_from: from, lwd_to: to })}
        />
        <SortSelect
          options={SORT_OPTIONS}
          sortBy={filters.sort_by}
          sortOrder={filters.sort_order}
          onChange={(sortBy, sortOrder) => set({ sort_by: sortBy, sort_order: sortOrder })}
        />
      </FilterBar>

      {exits.isPending ? (
        <TableSkeleton />
      ) : exits.isError ? (
        <ErrorState error={exits.error} onRetry={() => exits.refetch()} />
      ) : exits.data.data.length === 0 ? (
        <EmptyState
          title={hasFilters ? 'No exits match these filters' : 'No exits in progress'}
          description={
            hasFilters
              ? 'Clear a filter or search for a different name.'
              : 'Start an exit and the agent asks every team for clearance and follows up until all are done.'
          }
        />
      ) : (
        <>
          <TableShell>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Last day</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Clearances</TableHead>
                  <TableHead>Flags</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exits.data.data.map((exit) => (
                  <TableRow key={exit.case_id}>
                    <TableCell className="max-w-64">
                      <Link
                        to={`/cases/${exit.case_id}`}
                        className="block truncate font-medium hover:text-primary hover:underline"
                      >
                        {exit.full_name}
                      </Link>
                      {exit.employee_code && (
                        <span className="font-mono text-xs text-muted-foreground">{exit.employee_code}</span>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums">{formatDate(exit.last_working_day)}</TableCell>
                    <TableCell>
                      <StatusBadge value={exit.stage} />
                    </TableCell>
                    <TableCell>
                      <ClearanceChips clearances={exit.clearances} />
                    </TableCell>
                    <TableCell>
                      <FlagList flags={exit.flags} />
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {formatRelative(exit.updated_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableShell>
          <Pagination
            total={exits.data.total}
            limit={page.limit}
            offset={page.offset}
            onChange={(offset) => set({ offset: String(offset) }, { keepPage: true })}
          />
        </>
      )}
    </section>
  );
}
