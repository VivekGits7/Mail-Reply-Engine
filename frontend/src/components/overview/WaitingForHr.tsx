import { MailCheck, Presentation } from 'lucide-react';
import { Link } from 'react-router';
import { SectionHeading } from '@/components/common/PageHeader';
import { ErrorState } from '@/components/common/QueryState';
import { TableShell } from '@/components/common/TableShell';
import { Avatar } from '@/components/visual/Avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/utils/cn';
import { formatRelative } from '@/utils/utility';
import type { ApprovalListItem } from '@/types';

const TYPE_LABELS: Record<string, string> = { reply: 'Reply draft', induction_schedule: 'Induction plan' };

interface WaitingForHrProps {
  items?: ApprovalListItem[];
  loading: boolean;
  error: unknown;
  onRetry: () => void;
}

export function WaitingForHr({ items, loading, error, onRetry }: WaitingForHrProps) {
  const rows = items;
  return (
    <section aria-labelledby="waiting-title" className="flex min-w-0 flex-col panel p-5 sm:p-6">
      <SectionHeading
        id="waiting-title"
        title="Needs your approval"
        subtitle="AI-written replies wait here until you approve them."
        to="/#approvals"
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
                <TableHead>Draft</TableHead>
                <TableHead>For</TableHead>
                <TableHead>Waiting since</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((item) => {
                const type = item.approval_type ?? 'reply';
                const Icon = type === 'reply' ? MailCheck : Presentation;
                const draftplate = (
                  <>
                    <span
                      className={cn(
                        'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-xl',
                        type === 'reply' ? 'bg-iris/12 text-iris' : 'bg-azure/12 text-azure',
                      )}
                    >
                      <Icon className="size-3.5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      {item.summary || TYPE_LABELS[type] || 'Draft to review'}
                      <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                        {TYPE_LABELS[type]}
                      </span>
                    </span>
                  </>
                );
                return (
                  <TableRow key={item.approval_id}>
                    <TableCell className="max-w-72 whitespace-normal">
                      <Link
                        to={`/approvals/${item.approval_id}`}
                        className="flex items-start gap-2.5 font-medium hover:text-primary hover:underline"
                      >
                        {draftplate}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {item.person_name ? (
                        <span className="flex items-center gap-2">
                          <Avatar name={item.person_name} size="sm" />
                          {item.person_name}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {item.created_at ? formatRelative(item.created_at) : '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableShell>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 panel-inset px-5 py-10 text-center">
          <MailCheck className="mb-1 size-6 text-success" aria-hidden="true" />
          <p className="text-sm font-medium">Nothing to approve</p>
          <p className="text-sm text-pretty text-muted-foreground">
            Replies the agent writes itself wait here until an admin approves them.
          </p>
        </div>
      )}
    </section>
  );
}
