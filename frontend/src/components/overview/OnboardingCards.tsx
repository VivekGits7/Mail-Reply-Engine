import { Link } from 'react-router';
import { DocProgress } from '@/components/common/DocProgress';
import { SectionHeading } from '@/components/common/PageHeader';
import { ErrorState } from '@/components/common/QueryState';
import { TableShell } from '@/components/common/TableShell';
import { Avatar } from '@/components/visual/Avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate } from '@/utils/utility';
import type { JoinerListItem } from '@/types';

interface OnboardingCardsProps {
  items?: JoinerListItem[];
  loading: boolean;
  error: unknown;
  onRetry: () => void;
}

export function OnboardingCards({ items, loading, error, onRetry }: OnboardingCardsProps) {
  const rows = items;
  return (
    <section aria-labelledby="onboarding-title" className="flex min-w-0 flex-col panel p-5 sm:p-6">
      <SectionHeading
        id="onboarding-title"
        title="New joiners"
        subtitle="Document checklist progress for each new hire."
        to="/#joiners"
      />
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : rows?.length ? (
        <TableShell>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Joiner</TableHead>
                <TableHead>Joining</TableHead>
                <TableHead>Documents</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((item) => {
                const nameplate = (
                  <>
                    <Avatar name={item.full_name ?? 'Joiner'} size="sm" />
                    <span className="min-w-0 truncate">{item.full_name}</span>
                  </>
                );
                return (
                  <TableRow key={item.case_id}>
                    <TableCell className="max-w-64 whitespace-normal">
                      <Link
                        to={`/cases/${item.case_id}`}
                        className="flex items-center gap-3 font-medium hover:text-primary hover:underline"
                      >
                        {nameplate}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.joining_date ? formatDate(item.joining_date) : 'Not set'}
                    </TableCell>
                    <TableCell>
                      <DocProgress verified={item.docs_verified ?? 0} total={item.docs_total ?? 0} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableShell>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 panel-inset px-5 py-10 text-center">
          <p className="text-sm font-medium">No joiners yet</p>
          <p className="text-sm text-pretty text-muted-foreground">
            Each joiner you add gets a document checklist and automatic follow-ups.
          </p>
        </div>
      )}
    </section>
  );
}
