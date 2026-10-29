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

// Sample rows shown only when there isn't enough real data yet, so the table preview doesn't look empty.
const PLACEHOLDER_ITEMS: Partial<JoinerListItem>[] = [
  {
    case_id: 'sample-1',
    full_name: 'Sample Joiner',
    joining_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    docs_verified: 1,
    docs_total: 3,
  },
  {
    case_id: 'sample-2',
    full_name: 'Sample Candidate',
    joining_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    docs_verified: 0,
    docs_total: 3,
  },
];

const MIN_ROWS = 3;

interface OnboardingCardsProps {
  items?: Partial<JoinerListItem>[];
  loading: boolean;
  error: unknown;
  onRetry: () => void;
}

export function OnboardingCards({ items, loading, error, onRetry }: OnboardingCardsProps) {
  const rows = items?.length
    ? [...items, ...PLACEHOLDER_ITEMS.slice(0, Math.max(0, MIN_ROWS - items.length))]
    : items;
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
                const isSample = item.case_id?.startsWith('sample-');
                const nameplate = (
                  <>
                    <Avatar name={item.full_name ?? 'Joiner'} size="sm" />
                    <span className="min-w-0 truncate">{item.full_name}</span>
                  </>
                );
                return (
                  <TableRow key={item.case_id}>
                    <TableCell className="max-w-64 whitespace-normal">
                      {isSample ? (
                        <span className="flex items-center gap-3 font-medium">{nameplate}</span>
                      ) : (
                        <Link
                          to={`/cases/${item.case_id}`}
                          className="flex items-center gap-3 font-medium hover:text-primary hover:underline"
                        >
                          {nameplate}
                        </Link>
                      )}
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
