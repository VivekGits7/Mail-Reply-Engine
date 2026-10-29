import { useQuery } from '@tanstack/react-query';
import { Eye, UserPlus, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { selectIsAdmin } from '@/redux/authSlice';
import { useAppSelector } from '@/redux/hooks';
import { DateRange } from '@/components/common/DateRange';
import { DocProgress } from '@/components/common/DocProgress';
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
import { useLocalListState as useUrlState } from '@/hooks/useLocalListState';
import { FLAG_LABELS, optionsFrom } from '@/utils/labels';
import { formatDate, formatRelative, humanize } from '@/utils/utility';
import {
  CaseFlag,
  HireCategory,
  OnboardingStage,
  type JoinerSortBy,
  type OnboardingStage as Stage,
  type SortOrder,
} from '@/types';
import { Avatar } from '@/components/visual/Avatar';
import { JoinerFormDialog } from './JoinerFormDialog';
import { joinerListQuery } from './Joinersapi';

const SORT_OPTIONS: SortOption[] = [
  { label: 'Newest first', sort_by: 'created_at', sort_order: 'latest' },
  { label: 'Joining soonest', sort_by: 'joining_date', sort_order: 'oldest' },
  { label: 'Joining latest', sort_by: 'joining_date', sort_order: 'latest' },
  { label: 'Recently updated', sort_by: 'updated_at', sort_order: 'latest' },
  { label: 'Name A to Z', sort_by: 'full_name', sort_order: 'a_to_z' },
];

export default function Joiners() {
  const isAdmin = useAppSelector(selectIsAdmin);
  const navigate = useNavigate();
  const { get, set, page } = useUrlState();
  const search = get('search');
  const filters = {
    search,
    stage: get('stage') as Stage | undefined,
    flag: get('flag') as CaseFlag | undefined,
    hire_category: get('hire_category') as HireCategory | undefined,
    joining_from: get('joining_from'),
    joining_to: get('joining_to'),
    sort_by: (get('sort_by') ?? 'created_at') as JoinerSortBy,
    sort_order: (get('sort_order') ?? 'latest') as SortOrder,
  };
  const joiners = useQuery(joinerListQuery({ ...filters, ...page }));
  const hasFilters = Boolean(
    search ||
      filters.stage ||
      filters.flag ||
      filters.hire_category ||
      filters.joining_from ||
      get('sort_by') ||
      get('sort_order'),
  );
  const clearFilters = () =>
    set({
      search: undefined,
      stage: undefined,
      flag: undefined,
      hire_category: undefined,
      joining_from: undefined,
      joining_to: undefined,
      sort_by: undefined,
      sort_order: undefined,
    });

  return (
    <section>
      <PageHeader
        title="Joiners"
        actions={
          isAdmin && (
            <JoinerFormDialog
              trigger={
                <Button>
                  <UserPlus aria-hidden="true" />
                  Add joiner
                </Button>
              }
            />
          )
        }
      />

      <FilterBar>
        <SearchInput label="Search name" value={search} onSearch={(value) => set({ search: value })} />
        <FilterSelect
          label="Stage"
          value={filters.stage}
          options={optionsFrom(OnboardingStage)}
          onChange={(value) => set({ stage: value })}
        />
        <FilterSelect
          label="Flag"
          value={filters.flag}
          options={optionsFrom(CaseFlag, FLAG_LABELS)}
          onChange={(value) => set({ flag: value })}
        />
        <FilterSelect
          label="Hire type"
          value={filters.hire_category}
          options={optionsFrom(HireCategory, { campus: 'Campus', lateral: 'Lateral' })}
          onChange={(value) => set({ hire_category: value })}
        />
        <DateRange
          label="Joining date"
          from={filters.joining_from}
          to={filters.joining_to}
          onChange={(from, to) => set({ joining_from: from, joining_to: to })}
        />
        <SortSelect
          options={SORT_OPTIONS}
          sortBy={filters.sort_by}
          sortOrder={filters.sort_order}
          onChange={(sortBy, sortOrder) => set({ sort_by: sortBy, sort_order: sortOrder })}
        />
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X aria-hidden="true" />
            Clear filters
          </Button>
        )}
      </FilterBar>

      {joiners.isPending ? (
        <TableSkeleton />
      ) : joiners.isError ? (
        <ErrorState error={joiners.error} onRetry={() => joiners.refetch()} />
      ) : joiners.data.data.length === 0 ? (
        <EmptyState
          title={hasFilters ? 'No joiners match these filters' : 'No joiners yet'}
          description={
            hasFilters
              ? 'Clear a filter or search for a different name.'
              : 'Add a joiner and the agent sends the document checklist and follows up until everything arrives.'
          }
        />
      ) : (
        <>
          <TableShell>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Joiner</TableHead>
                  <TableHead>Joining</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Documents</TableHead>
                  <TableHead>Flags</TableHead>
                  <TableHead>Next follow-up</TableHead>
                  <TableHead className="text-right">View</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {joiners.data.data.map((joiner) => {
                  const to = `/cases/${joiner.case_id}`;
                  return (
                  <TableRow
                    key={joiner.case_id}
                    className="cursor-pointer"
                    onClick={(event) => {
                      if ((event.target as HTMLElement).closest('a')) return;
                      navigate(to);
                    }}
                  >
                    <TableCell className="max-w-72">
                      <div className="flex items-center gap-3">
                        <Avatar name={joiner.full_name} src={joiner.photo_url} size="md" />
                        <div className="min-w-0">
                          <Link to={to} className="block truncate font-medium hover:text-primary hover:underline">
                            {joiner.full_name}
                          </Link>
                          <span className="text-xs text-muted-foreground">
                            {[humanize(joiner.hire_category), joiner.level, joiner.location]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatDate(joiner.joining_date)}
                      {joiner.joining_date && (
                        <span className="block text-xs text-muted-foreground">
                          {formatRelative(joiner.joining_date)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <StatusBadge value={joiner.stage} />
                        {joiner.status !== 'open' && <StatusBadge value={joiner.status} />}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DocProgress verified={joiner.docs_verified} total={joiner.docs_total} />
                    </TableCell>
                    <TableCell>
                      <FlagList flags={joiner.flags} />
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {formatRelative(joiner.next_followup_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        to={to}
                        aria-label="View joiner"
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
            total={joiners.data.total}
            limit={page.limit}
            offset={page.offset}
            onChange={(offset) => set({ offset: String(offset) }, { keepPage: true })}
          />
        </>
      )}
    </section>
  );
}
