import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { FilterBar } from '@/components/common/FilterBar';
import { FilterSelect } from '@/components/common/FilterSelect';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/common/QueryState';
import { SearchInput } from '@/components/common/SearchInput';
import { StatusBadge } from '@/components/common/StatusBadge';
import { TableShell } from '@/components/common/TableShell';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useUrlState } from '@/hooks/useUrlState';
import { formatDate } from '@/utils/utility';
import { templatesQuery } from './Adminapi';

export default function Templates() {
  const { get, set } = useUrlState();
  const params = {
    search: get('search'),
    is_active: get('is_active') === undefined ? undefined : get('is_active') === 'true',
  };
  const templates = useQuery(templatesQuery(params));
  return (
    <section>
      <PageHeader
        title="Mail templates"
        description="Review the subjects and message bodies the agent uses for automated mail."
      />
      <FilterBar>
        <SearchInput label="Search templates" value={params.search} onSearch={(search) => set({ search })} />
        <FilterSelect
          label="State"
          value={get('is_active')}
          options={[
            { value: 'true', label: 'Active' },
            { value: 'false', label: 'Paused' },
          ]}
          onChange={(is_active) => set({ is_active })}
        />
      </FilterBar>
      {templates.isPending ? (
        <TableSkeleton />
      ) : templates.isError ? (
        <ErrorState error={templates.error} onRetry={() => templates.refetch()} />
      ) : !templates.data.length ? (
        <EmptyState title="No templates match" description="Try another search or state filter." />
      ) : (
        <TableShell>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.data.map((item) => (
                <TableRow key={item.template_key}>
                  <TableCell>
                    <Link
                      to={`/admin/templates/${encodeURIComponent(item.template_key)}`}
                      className="font-medium hover:text-primary hover:underline"
                    >
                      {item.name}
                    </Link>
                    <span className="block font-mono text-xs text-muted-foreground">{item.template_key}</span>
                  </TableCell>
                  <TableCell className="max-w-sm whitespace-normal">{item.subject}</TableCell>
                  <TableCell>
                    <StatusBadge value={item.is_active ? 'active' : 'paused'} />
                  </TableCell>
                  <TableCell>{formatDate(item.updated_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableShell>
      )}
    </section>
  );
}
