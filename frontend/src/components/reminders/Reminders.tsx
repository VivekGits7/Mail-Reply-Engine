import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Link } from 'react-router';
import { FilterBar } from '@/components/common/FilterBar';
import { FilterSelect } from '@/components/common/FilterSelect';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/common/QueryState';
import { SearchInput } from '@/components/common/SearchInput';
import { SortSelect } from '@/components/common/SortSelect';
import { StatusBadge } from '@/components/common/StatusBadge';
import { TableShell } from '@/components/common/TableShell';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useUrlState } from '@/hooks/useUrlState';
import { selectIsAdmin } from '@/redux/authSlice';
import { useAppSelector } from '@/redux/hooks';
import { DATA_SOURCE_LABELS } from '@/utils/labels';
import { formatDate } from '@/utils/utility';
import { DataSource, type RuleSortBy, type SortOrder } from '@/types';
import { ReminderRuleForm } from './ReminderRuleForm';
import { ruleListQuery } from './Remindersapi';

export default function Reminders() {
  const isAdmin = useAppSelector(selectIsAdmin);
  const { get, set } = useUrlState();
  const params = {
    search: get('search'),
    data_source: get('data_source') as DataSource | undefined,
    is_active: get('is_active') === undefined ? undefined : get('is_active') === 'true',
    sort_by: (get('sort_by') ?? 'name') as RuleSortBy,
    sort_order: (get('sort_order') ?? 'a_to_z') as SortOrder,
  };
  const rules = useQuery(ruleListQuery(params));
  return (
    <section>
      <PageHeader
        title="Reminders"
        description="Scheduled nudges for recurring HR work. Open a rule to see its recipients and import a new list."
        actions={
          isAdmin && (
            <ReminderRuleForm
              trigger={
                <Button>
                  <Plus className="size-4" /> Create rule
                </Button>
              }
            />
          )
        }
      />
      <FilterBar>
        <SearchInput label="Search rules" value={params.search} onSearch={(search) => set({ search })} />
        <FilterSelect
          label="Source"
          value={params.data_source}
          options={Object.values(DataSource).map((value) => ({ value, label: DATA_SOURCE_LABELS[value] }))}
          onChange={(data_source) => set({ data_source })}
        />
        <FilterSelect
          label="State"
          value={get('is_active')}
          options={[
            { value: 'true', label: 'Active' },
            { value: 'false', label: 'Paused' },
          ]}
          onChange={(is_active) => set({ is_active })}
        />
        <SortSelect
          options={[
            { label: 'Name A to Z', sort_by: 'name', sort_order: 'a_to_z' },
            { label: 'Newest first', sort_by: 'created_at', sort_order: 'latest' },
          ]}
          sortBy={params.sort_by}
          sortOrder={params.sort_order}
          onChange={(sort_by, sort_order) => set({ sort_by, sort_order })}
        />
      </FilterBar>
      {rules.isPending ? (
        <TableSkeleton />
      ) : rules.isError ? (
        <ErrorState error={rules.error} onRetry={() => rules.refetch()} />
      ) : !rules.data.length ? (
        <EmptyState
          title="No rules match"
          description="Try a different filter or create a rule for a recurring task."
        />
      ) : (
        <TableShell>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rule</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Open tasks</TableHead>
                <TableHead>Next run</TableHead>
                <TableHead>State</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.data.map((rule) => (
                <TableRow key={rule.reminder_rule_id}>
                  <TableCell>
                    <Link
                      to={`/reminders/${rule.reminder_rule_id}`}
                      className="font-medium hover:text-primary hover:underline"
                    >
                      {rule.name}
                    </Link>
                    <span className="block font-mono text-xs text-muted-foreground">{rule.rule_key}</span>
                  </TableCell>
                  <TableCell>{DATA_SOURCE_LABELS[rule.data_source]}</TableCell>
                  <TableCell className="tabular-nums">{rule.open_tasks}</TableCell>
                  <TableCell>{formatDate(rule.next_run_at)}</TableCell>
                  <TableCell>
                    <StatusBadge value={rule.is_active ? 'active' : 'paused'} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableShell>
      )}
    </section>
  );
}
