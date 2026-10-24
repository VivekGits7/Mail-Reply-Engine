import { useQueries, useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { Heatmap } from '@/components/visual/Heatmap';
import { SegmentedBar } from '@/components/visual/SegmentedBar';
import { Skeleton } from '@/components/ui/skeleton';
import { useToday } from '@/hooks/useToday';
import { cn } from '@/utils/cn';
import { riseIn, staggerParent } from '@/utils/animations';
import { ACTOR_LABELS } from '@/utils/labels';
import { dayKey, toDate } from '@/utils/utility';
import { ActorType } from '@/types';
import { actionLogQuery } from './Adminapi';

const WEEKS = 26;
const PAGE_SIZE = 100;
const MAX_PAGES = 3;
const ACTOR_TONES = { agent: 'iris', user: 'azure', system: 'neutral' } as const;

interface ActivityStatsProps {
  actor?: string;
  onActor: (actor: string | undefined) => void;
}

export function ActivityStats({ actor, onActor }: ActivityStatsProps) {
  const since = new Date(useToday());
  since.setDate(since.getDate() - WEEKS * 7);
  const date_from = `${dayKey(since)}T00:00:00`;

  const pages = useQueries({
    queries: Array.from({ length: MAX_PAGES }, (_, index) =>
      actionLogQuery({ date_from, sort_order: 'latest', limit: PAGE_SIZE, offset: index * PAGE_SIZE }),
    ),
  });
  const agent = useQuery(actionLogQuery({ date_from, actor_type: ActorType.AGENT, limit: 1, offset: 0 }));
  const user = useQuery(actionLogQuery({ date_from, actor_type: ActorType.USER, limit: 1, offset: 0 }));
  const system = useQuery(actionLogQuery({ date_from, actor_type: ActorType.SYSTEM, limit: 1, offset: 0 }));

  const entries = pages.flatMap((page) => page.data?.data ?? []);
  const counts: Record<string, number> = {};
  for (const entry of entries) {
    const key = dayKey(toDate(entry.occurred_at));
    counts[key] = (counts[key] ?? 0) + 1;
  }
  const total = pages[0].data?.total ?? 0;
  const loading = pages[0].isPending;
  const actors = [
    { key: ActorType.AGENT, query: agent },
    { key: ActorType.USER, query: user },
    { key: ActorType.SYSTEM, query: system },
  ];

  return (
    <motion.section
      variants={staggerParent}
      initial="hidden"
      animate="show"
      aria-label="Activity summary"
      className="mb-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]"
    >
      <motion.div variants={riseIn} className="min-w-0 panel p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-normal tracking-[-0.02em]">Activity report</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Actions per day over the last {WEEKS} weeks
              {entries.length < total && `, based on the latest ${entries.length} of ${total}`}.
            </p>
          </div>
          <div className="text-[2.5rem] leading-none font-light tracking-[-0.04em] tabular-nums">
            {loading ? <Skeleton className="h-10 w-16" /> : total}
          </div>
        </div>
        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <Heatmap counts={counts} weeks={WEEKS} label="Activity heatmap" />
        )}
      </motion.div>

      <motion.div variants={riseIn} className="flex flex-col panel p-5 sm:p-6">
        <h2 className="text-xl font-normal tracking-[-0.02em]">Who did the work</h2>
        <p className="mt-1 text-sm text-muted-foreground">Click one to filter the log.</p>
        <SegmentedBar
          className="mt-6"
          showLegend={false}
          label="Actions by who did them"
          segments={actors.map(({ key, query }) => ({
            key,
            label: ACTOR_LABELS[key] ?? key,
            tone: ACTOR_TONES[key],
            value: query.data?.total ?? 0,
          }))}
        />
        <ul className="mt-5 flex flex-col gap-2">
          {actors.map(({ key, query }) => {
            const selected = actor === key;
            return (
              <li key={key}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onActor(selected ? undefined : key)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                    selected ? 'liquid-glass' : 'panel-inset hover:bg-muted/70',
                  )}
                >
                  <span
                    className={cn(
                      'size-2.5 rounded-full',
                      key === ActorType.AGENT
                        ? 'bg-iris'
                        : key === ActorType.USER
                          ? 'bg-azure'
                          : 'bg-muted-foreground/50',
                    )}
                  />
                  <span className="flex-1">{ACTOR_LABELS[key] ?? key}</span>
                  <span className="font-medium tabular-nums">
                    {query.isPending ? '–' : query.data?.total}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </motion.div>
    </motion.section>
  );
}
