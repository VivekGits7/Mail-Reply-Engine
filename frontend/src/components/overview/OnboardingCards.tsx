import { FileCheck2 } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import { SectionHeading } from '@/components/common/PageHeader';
import { ErrorState } from '@/components/common/QueryState';
import { Avatar } from '@/components/visual/Avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/utils/cn';
import { riseIn, staggerParent } from '@/utils/animations';
import { formatDate } from '@/utils/utility';
import type { JoinerListItem } from '@/types';

interface OnboardingCardsProps {
  items?: Partial<JoinerListItem>[];
  loading: boolean;
  error: unknown;
  onRetry: () => void;
}

export function OnboardingCards({ items, loading, error, onRetry }: OnboardingCardsProps) {
  return (
    <section aria-labelledby="onboarding-title" className="flex min-w-0 flex-col panel p-5 sm:p-6">
      <SectionHeading id="onboarding-title" title="Onboarding" to="/#joiners" />
      {loading ? (
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-44 rounded-3xl" />
          ))}
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : items?.length ? (
        <motion.ul
          variants={staggerParent}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 gap-2"
        >
          {items.map((item) => {
            const verified = item.docs_verified ?? 0;
            const total = item.docs_total ?? 0;
            const done = total > 0 && verified >= total;
            return (
              <motion.li
                key={item.case_id}
                variants={riseIn}
                className="relative flex flex-col items-center rounded-3xl bg-card px-3 pt-5 pb-4 text-center shadow-[var(--pill-shadow)] ring-1 ring-border/60 transition-transform duration-200 ease-(--ease-fluid) focus-within:ring-3 focus-within:ring-ring/50 hover:-translate-y-0.5"
              >
                <Avatar name={item.full_name ?? 'Joiner'} size="lg" />
                <Link
                  to={`/cases/${item.case_id}`}
                  className="mt-3 line-clamp-1 font-medium after:absolute after:inset-0 after:rounded-3xl focus-visible:outline-none"
                >
                  {item.full_name}
                </Link>
                <span className="line-clamp-1 text-xs text-muted-foreground">
                  {item.joining_date
                    ? `Joins ${formatDate(item.joining_date)}`
                    : [item.level, item.location].filter(Boolean).join(' · ') || 'Joining date not set'}
                </span>
                <span
                  className={cn(
                    'mt-3 inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium tabular-nums',
                    done ? 'bg-mint/15 text-success' : 'pressed text-muted-foreground',
                  )}
                >
                  <FileCheck2 className="size-3.5" aria-hidden="true" />
                  {verified}/{total} docs done
                </span>
              </motion.li>
            );
          })}
        </motion.ul>
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
