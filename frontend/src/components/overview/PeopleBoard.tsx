import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, DoorOpen, UserPlus } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { Link } from 'react-router';
import { exitListQuery } from '@/components/exits/Exitsapi';
import { joinerListQuery } from '@/components/joiners/Joinersapi';
import { SectionHeading } from '@/components/common/PageHeader';
import { ErrorState } from '@/components/common/QueryState';
import { Avatar } from '@/components/visual/Avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useToday } from '@/hooks/useToday';
import { cn } from '@/utils/cn';
import { EASE_FLUID } from '@/utils/animations';
import { dayKey, toDate } from '@/utils/utility';

const DAYS = 21;
const DAYS_BEFORE_TODAY = 3;
const MAX_ROWS = 8;
const WEEKDAY = new Intl.DateTimeFormat('en-IN', { weekday: 'short' });
const RANGE = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });
const READY_STAGES = new Set(['ready_for_signoff', 'it_requested', 'closed']);
const DONE_CLEARANCE = new Set(['done', 'not_applicable']);

type BarTone = 'azure' | 'iris' | 'mint' | 'ember' | 'sun';

const BAR_STYLES: Record<BarTone, string> = {
  azure: 'bg-[linear-gradient(135deg,color-mix(in_oklch,var(--azure),white_18%),var(--azure))] text-white',
  iris: 'bg-[linear-gradient(135deg,color-mix(in_oklch,var(--iris),white_18%),var(--iris))] text-white',
  mint: 'bg-[linear-gradient(135deg,color-mix(in_oklch,var(--mint),white_12%),var(--mint))] text-white dark:text-black',
  ember: 'bg-[linear-gradient(135deg,color-mix(in_oklch,var(--ember),white_15%),var(--ember))] text-white',
  sun: 'bg-[linear-gradient(135deg,color-mix(in_oklch,var(--sun),white_20%),var(--sun))] text-sun-foreground',
};

const LEGEND: { tone: BarTone; label: string }[] = [
  { tone: 'azure', label: 'No documents yet' },
  { tone: 'iris', label: 'Collecting' },
  { tone: 'mint', label: 'Ready to join' },
  { tone: 'sun', label: 'At risk' },
  { tone: 'ember', label: 'Leaving' },
];

interface BoardRow {
  key: string;
  caseId: string;
  name: string;
  subtitle: string;
  date: Date;
  kind: 'join' | 'exit';
  tone: BarTone;
  label: string;
  detail: string;
  pill: string;
}

function daysBetween(from: Date, to: Date) {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

export function PeopleBoard() {
  const reduced = useReducedMotion();
  const today = useToday();
  const scroller = useRef<HTMLDivElement>(null);
  const todayCell = useRef<HTMLSpanElement>(null);
  const start = new Date(today);
  start.setDate(today.getDate() - DAYS_BEFORE_TODAY);
  const end = new Date(start);
  end.setDate(start.getDate() + DAYS - 1);
  const days = Array.from({ length: DAYS }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
  const todayIndex = daysBetween(start, today);

  const joiners = useQuery(
    joinerListQuery({
      joining_from: dayKey(start),
      joining_to: dayKey(end),
      status: 'open',
      sort_by: 'joining_date',
      sort_order: 'oldest',
      limit: 20,
      offset: 0,
    }),
  );
  const exits = useQuery(
    exitListQuery({
      lwd_from: dayKey(start),
      lwd_to: dayKey(end),
      status: 'open',
      sort_by: 'last_working_day',
      sort_order: 'oldest',
      limit: 20,
      offset: 0,
    }),
  );

  const rows: BoardRow[] = [
    ...(joiners.data?.data ?? [])
      .filter((item) => item.joining_date)
      .map((item): BoardRow => {
        const ready = READY_STAGES.has(item.stage);
        const atRisk = item.flags?.includes('dropout_risk');
        const started = (item.docs_verified ?? 0) > 0;
        const tone: BarTone = atRisk ? 'sun' : ready ? 'mint' : started ? 'iris' : 'azure';
        return {
          key: `join-${item.case_id}`,
          caseId: item.case_id,
          name: item.full_name,
          subtitle: [item.level, item.location].filter(Boolean).join(' · ') || 'Joiner',
          date: toDate(item.joining_date!),
          kind: 'join',
          tone,
          label: 'Joins',
          detail: `${item.docs_verified ?? 0}/${item.docs_total ?? 0} docs`,
          pill: atRisk ? 'At risk' : ready ? 'Ready' : started ? 'Collecting' : 'Not started',
        };
      }),
    ...(exits.data?.data ?? [])
      .filter((item) => item.last_working_day)
      .map((item): BoardRow => {
        const teams = Object.values(item.clearances ?? {});
        const cleared = teams.filter((status) => DONE_CLEARANCE.has(status)).length;
        return {
          key: `exit-${item.case_id}`,
          caseId: item.case_id,
          name: item.full_name,
          subtitle: item.employee_code ?? 'Exit',
          date: toDate(item.last_working_day!),
          kind: 'exit',
          tone: 'ember',
          label: 'Last day',
          detail: `${cleared}/${teams.length} cleared`,
          pill: item.stage === 'all_cleared' ? 'Cleared' : 'Clearing',
        };
      }),
  ]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, MAX_ROWS);

  const loading = joiners.isPending || exits.isPending;
  const error = joiners.error ?? exits.error;
  const columns = `minmax(min(11.5rem, 36vw), 13rem) repeat(${DAYS}, minmax(3rem, 1fr))`;

  // On a phone the board scrolls sideways, so open it on today instead of the days already gone.
  useEffect(() => {
    const box = scroller.current;
    const cell = todayCell.current;
    if (loading || !box || !cell || box.scrollWidth <= box.clientWidth) return;
    const names = box.querySelector<HTMLElement>('[data-board-names]');
    const offset = cell.getBoundingClientRect().left - box.getBoundingClientRect().left + box.scrollLeft;
    box.scrollLeft = offset - (names?.offsetWidth ?? 0) - 12;
  }, [loading]);

  return (
    <section aria-labelledby="board-title" className="panel p-5 sm:p-6">
      <SectionHeading
        id="board-title"
        title="Joining and leaving"
        to="/#joiners"
        actions={
          <span className="hidden h-9 items-center gap-2 pill px-3.5 text-sm md:inline-flex">
            <CalendarDays className="size-4 text-muted-foreground" aria-hidden="true" />
            <span className="tabular-nums">
              {RANGE.format(start)} – {RANGE.format(end)}
            </span>
          </span>
        }
      />
      <ul className="mb-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground" aria-label="Legend">
        {LEGEND.map((item) => (
          <li key={item.tone} className="inline-flex items-center gap-1.5">
            <span className={cn('size-2.5 rounded-full', BAR_STYLES[item.tone])} />
            {item.label}
          </li>
        ))}
      </ul>

      {error ? (
        <ErrorState error={error} onRetry={() => (joiners.error ? joiners.refetch() : exits.refetch())} />
      ) : (
        <div ref={scroller} className="-mx-2 scrollbar-none overflow-x-auto px-2 pb-1">
          <div className="min-w-[56rem]">
            <div className="grid gap-1.5" style={{ gridTemplateColumns: columns }}>
              <span
                data-board-names
                className="sticky left-0 z-20 flex items-end self-stretch bg-card pb-2 text-sm text-muted-foreground"
              >
                People
              </span>
              {days.map((date, index) => {
                const weekend = date.getDay() === 0 || date.getDay() === 6;
                const isToday = index === todayIndex;
                return (
                  <span
                    key={dayKey(date)}
                    ref={isToday ? todayCell : undefined}
                    className={cn(
                      'flex flex-col items-center rounded-xl py-1.5 text-[0.7rem] leading-tight',
                      isToday
                        ? 'bg-primary text-primary-foreground shadow-[0_8px_18px_-10px_var(--primary)]'
                        : weekend
                          ? 'bg-muted text-muted-foreground'
                          : 'pill text-muted-foreground',
                    )}
                  >
                    <span>{WEEKDAY.format(date)}</span>
                    <span className={cn('text-sm', !isToday && 'text-foreground')}>{date.getDate()}</span>
                  </span>
                );
              })}
            </div>

            {loading ? (
              <div className="mt-3 space-y-2">
                {Array.from({ length: 4 }, (_, index) => (
                  <Skeleton key={index} className="h-14 w-full rounded-2xl" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <div className="relative mt-3 grid gap-1.5" style={{ gridTemplateColumns: columns }}>
                <p className="col-span-full panel-inset px-5 py-8 text-center text-sm text-muted-foreground">
                  Nobody joins or leaves in this window. New joiners and exits show up here with their
                  countdown.
                </p>
              </div>
            ) : (
              <ul className="mt-2 flex flex-col gap-1.5" aria-label="People joining and leaving">
                {rows.map((row, rowIndex) => {
                  const eventIndex = daysBetween(start, row.date);
                  const from = row.date >= today ? Math.max(0, todayIndex) : eventIndex;
                  const span = eventIndex - from + 1;
                  const narrow = span < 2;
                  const daysLeft = daysBetween(today, row.date);
                  const when =
                    daysLeft === 0 ? 'today' : daysLeft > 0 ? `in ${daysLeft} days` : `${-daysLeft} days ago`;
                  return (
                    <li key={row.key} className="grid gap-1.5" style={{ gridTemplateColumns: columns }}>
                      <div
                        className="sticky left-0 z-20 flex min-w-0 items-center gap-2.5 bg-card pr-2"
                        style={{ gridRow: 1, gridColumn: 1 }}
                      >
                        <Avatar name={row.name} size="md" />
                        <span className="min-w-0">
                          <Link
                            to={`/cases/${row.caseId}`}
                            className="block truncate text-sm font-medium hover:text-primary focus-visible:underline focus-visible:outline-none"
                          >
                            {row.name}
                          </Link>
                          <span className="block truncate text-xs text-muted-foreground">{row.subtitle}</span>
                        </span>
                      </div>
                      {days.map((date, index) => {
                        const weekend = date.getDay() === 0 || date.getDay() === 6;
                        return (
                          <span
                            key={dayKey(date)}
                            aria-hidden="true"
                            style={{ gridRow: 1, gridColumn: index + 2 }}
                            className={cn(
                              'relative h-14 rounded-xl',
                              weekend ? 'bg-muted hatch' : 'bg-muted/55',
                              index === todayIndex &&
                                'before:absolute before:-inset-y-1 before:left-1/2 before:-translate-x-1/2 before:border-l-2 before:border-dashed before:border-primary/70',
                            )}
                          />
                        );
                      })}
                      <motion.div
                        style={{ gridRow: 1, gridColumn: `${from + 2} / ${eventIndex + 3}` }}
                        className={cn(
                          'relative z-10 flex h-12 origin-left items-center gap-2 self-center overflow-hidden rounded-2xl px-1.5 shadow-[0_10px_22px_-14px_rgb(0_0_0/0.5),inset_0_1px_0_rgb(255_255_255/0.35),inset_0_-2px_6px_rgb(255_255_255/0.12)] ring-1 ring-white/25 backdrop-blur-md before:pointer-events-none before:absolute before:inset-x-2 before:top-0.5 before:h-1/2 before:rounded-full before:bg-linear-to-b before:from-white/35 before:to-transparent',
                          BAR_STYLES[row.tone],
                        )}
                        initial={reduced ? false : { scaleX: 0.2, opacity: 0 }}
                        animate={{ scaleX: 1, opacity: 1 }}
                        transition={{ duration: 0.5, delay: 0.05 + rowIndex * 0.05, ease: EASE_FLUID }}
                        aria-label={`${row.name}, ${row.label.toLowerCase()} ${when}, ${row.detail}`}
                        title={`${row.label} ${RANGE.format(row.date)} · ${row.detail}`}
                        role="img"
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/22">
                          {row.kind === 'join' ? (
                            <UserPlus className="size-4" aria-hidden="true" />
                          ) : (
                            <DoorOpen className="size-4" aria-hidden="true" />
                          )}
                        </span>
                        {!narrow && (
                          <>
                            <span className="min-w-0 truncate text-sm leading-tight">
                              {row.label} {RANGE.format(row.date)}
                              {span >= 3 && <span className="block text-xs opacity-80">{row.detail}</span>}
                            </span>
                            {span >= 5 && (
                              <span className="ml-auto inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-white/85 px-2 text-[0.7rem] font-medium text-neutral-800">
                                <span className="size-1.5 rounded-full bg-current" />
                                {row.pill}
                              </span>
                            )}
                          </>
                        )}
                      </motion.div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
