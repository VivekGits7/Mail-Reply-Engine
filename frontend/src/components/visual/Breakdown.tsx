import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/utils/cn';
import { riseIn, staggerParent } from '@/utils/animations';
import { SegmentedBar, type Segment } from './SegmentedBar';
import { TONE_STYLES, type VisualTone } from './tones';

interface BreakdownProps {
  title: string;
  totalLabel: string;
  total?: number;
  loading: boolean;
  segments: Segment[];
  active?: string;
  onSelect?: (key: string | undefined) => void;
  aside?: ReactNode;
  className?: string;
}

export function Breakdown({
  title,
  totalLabel,
  total,
  loading,
  segments,
  active,
  onSelect,
  aside,
  className,
}: BreakdownProps) {
  const sum = total ?? segments.reduce((value, segment) => value + segment.value, 0);
  return (
    <motion.section
      variants={staggerParent}
      initial="hidden"
      animate="show"
      aria-label={title}
      className={cn('mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]', className)}
    >
      <motion.div
        variants={riseIn}
        className="flex min-w-0 flex-col gap-5 panel p-5 sm:flex-row sm:items-center sm:gap-8 sm:p-6"
      >
        <div className="shrink-0">
          <p className="text-sm text-muted-foreground">{totalLabel}</p>
          <div className="mt-1 text-[2.75rem] leading-none font-light tracking-[-0.04em] tabular-nums">
            {loading ? <Skeleton className="h-11 w-16" /> : sum}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          {loading ? (
            <Skeleton className="h-3 w-full" />
          ) : (
            <SegmentedBar segments={segments} label={title} showLegend={false} />
          )}
          <div
            className="mt-4 flex flex-wrap gap-2"
            role={onSelect ? 'group' : undefined}
            aria-label={onSelect ? `Filter by ${title.toLowerCase()}` : undefined}
          >
            {segments.map((segment) => {
              const selected = active === segment.key;
              const content = (
                <>
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: TONE_STYLES[segment.tone].fill }}
                  />
                  <span className="text-muted-foreground">{segment.label}</span>
                  <span className="font-medium tabular-nums">{loading ? '–' : segment.value}</span>
                </>
              );
              return onSelect ? (
                <button
                  key={segment.key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelect(selected ? undefined : segment.key)}
                  className={cn(
                    'inline-flex h-8 items-center gap-2 rounded-full px-3 text-xs transition-[background-color,box-shadow] duration-200 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                    selected ? 'liquid-glass' : 'pill hover:bg-muted',
                  )}
                >
                  {content}
                </button>
              ) : (
                <span
                  key={segment.key}
                  className="inline-flex h-8 items-center gap-2 pill rounded-full px-3 text-xs"
                >
                  {content}
                </span>
              );
            })}
          </div>
        </div>
      </motion.div>
      {aside && (
        <motion.div variants={riseIn} className="grid grid-cols-2 gap-4 lg:w-[22rem]">
          {aside}
        </motion.div>
      )}
    </motion.section>
  );
}

interface MiniStatProps {
  label: string;
  value?: number | string;
  icon: LucideIcon;
  tone: VisualTone;
  loading?: boolean;
  active?: boolean;
  onClick?: () => void;
}

export function MiniStat({ label, value, icon: Icon, tone, loading, active, onClick }: MiniStatProps) {
  const body = (
    <>
      <span className={cn('flex size-10 items-center justify-center rounded-2xl', TONE_STYLES[tone].soft)}>
        <Icon className="size-4.5" aria-hidden="true" />
      </span>
      <span className="mt-auto pt-4 text-xs text-muted-foreground">{label}</span>
      <span className="text-3xl leading-tight font-light tracking-[-0.03em] tabular-nums">
        {loading ? <span className="text-muted-foreground">–</span> : value}
      </span>
    </>
  );
  const classes = 'panel flex min-h-36 flex-col items-start p-4 text-left';
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        classes,
        'transition-[transform,box-shadow] duration-200 ease-(--ease-fluid) hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
        active && 'ring-2 ring-primary/60',
      )}
    >
      {body}
    </button>
  ) : (
    <div className={classes}>{body}</div>
  );
}
