import { CalendarClock, MailCheck, Presentation } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import { SectionHeading } from '@/components/common/PageHeader';
import { ErrorState } from '@/components/common/QueryState';
import { Avatar } from '@/components/visual/Avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/utils/cn';
import { riseIn, staggerParent } from '@/utils/animations';
import { formatDate, formatRelative } from '@/utils/utility';
import type { ApprovalListItem } from '@/types';

const TYPE_LABELS: Record<string, string> = { reply: 'Reply draft', induction_schedule: 'Induction plan' };

interface WaitingForHrProps {
  items?: Partial<ApprovalListItem>[];
  loading: boolean;
  error: unknown;
  onRetry: () => void;
}

export function WaitingForHr({ items, loading, error, onRetry }: WaitingForHrProps) {
  return (
    <section aria-labelledby="waiting-title" className="flex min-w-0 flex-col panel p-5 sm:p-6">
      <SectionHeading id="waiting-title" title="Waiting for HR" to="/#approvals" />
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-36 w-full rounded-3xl" />
          <Skeleton className="h-24 w-full rounded-3xl" />
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : items?.length ? (
        <motion.ul variants={staggerParent} initial="hidden" animate="show" className="flex flex-col gap-2">
          {items.map((item, index) => {
            const featured = index === 0;
            const type = item.approval_type ?? 'reply';
            const Icon = type === 'reply' ? MailCheck : Presentation;
            return (
              <motion.li
                key={item.approval_id}
                variants={riseIn}
                className={cn(
                  'relative rounded-3xl p-4 transition-transform duration-200 ease-(--ease-fluid) focus-within:ring-3 focus-within:ring-ring/50 hover:-translate-y-0.5',
                  featured
                    ? 'bg-sun text-sun-foreground shadow-[0_14px_30px_-20px_var(--sun)]'
                    : 'panel-inset',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <Link
                    to={`/approvals/${item.approval_id}`}
                    className="line-clamp-2 font-medium after:absolute after:inset-0 after:rounded-3xl focus-visible:outline-none"
                  >
                    {item.summary || TYPE_LABELS[type] || 'Draft to review'}
                  </Link>
                  {item.created_at && (
                    <span
                      className={cn(
                        'inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-[0.7rem] font-medium',
                        featured ? 'bg-white/70 text-sun-foreground' : 'pill text-muted-foreground',
                      )}
                    >
                      <span className="size-1.5 rounded-full bg-current" />
                      {formatRelative(item.created_at)}
                    </span>
                  )}
                </div>
                {item.person_name && (
                  <p className={cn('mt-1 text-sm', featured ? 'opacity-80' : 'text-muted-foreground')}>
                    {item.person_name}
                  </p>
                )}
                {featured && (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="inline-flex h-9 items-center gap-2 rounded-full bg-white/55 px-3 text-xs font-medium ring-1 ring-black/5">
                      <Icon className="size-4" aria-hidden="true" />
                      {TYPE_LABELS[type]}
                    </span>
                    {item.created_at && (
                      <span className="inline-flex h-9 items-center gap-2 rounded-full bg-white/55 px-3 text-xs font-medium ring-1 ring-black/5">
                        <CalendarClock className="size-4" aria-hidden="true" />
                        {formatDate(item.created_at)}
                      </span>
                    )}
                    {item.person_name && (
                      <Avatar name={item.person_name} size="sm" className="ml-auto ring-sun" />
                    )}
                  </div>
                )}
              </motion.li>
            );
          })}
        </motion.ul>
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
