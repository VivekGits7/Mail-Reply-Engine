import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useToday } from '@/hooks/useToday';
import { cn } from '@/utils/cn';
import { EASE_FLUID } from '@/utils/animations';
import { dayKey, toDate } from '@/utils/utility';

const MONTH_YEAR = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' });
const MONTH_SHORT = new Intl.DateTimeFormat('en-IN', { month: 'short' });
const FULL_DAY = new Intl.DateTimeFormat('en-IN', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const YEARS_PER_PAGE = 12;

type View = 'days' | 'months' | 'years';

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(date.getDate() + days);
  return next;
}

function monthGrid(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = addDays(first, -((first.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

interface CalendarProps {
  value?: string;
  min?: string;
  max?: string;
  onSelect: (value: string) => void;
  onClear?: () => void;
}

export function Calendar({ value, min, max, onSelect, onClear }: CalendarProps) {
  const reduced = useReducedMotion();
  const today = useToday();
  const selected = value ? toDate(value) : undefined;
  const [view, setView] = useState<View>('days');
  const [month, setMonth] = useState(() => {
    const base = selected ?? today;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const [focused, setFocused] = useState<Date>(() => selected ?? today);
  const [direction, setDirection] = useState(0);
  const grid = useRef<HTMLDivElement>(null);
  const keyboard = useRef(false);

  useEffect(() => {
    if (!keyboard.current) return;
    keyboard.current = false;
    grid.current?.querySelector<HTMLButtonElement>(`[data-day="${dayKey(focused)}"]`)?.focus();
  }, [focused, month]);

  const outOfRange = (date: Date) => Boolean((min && dayKey(date) < min) || (max && dayKey(date) > max));

  function shiftMonth(step: number) {
    setDirection(step);
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + step, 1));
  }

  function moveFocus(next: Date) {
    keyboard.current = true;
    setFocused(next);
    if (next.getMonth() !== month.getMonth() || next.getFullYear() !== month.getFullYear()) {
      setDirection(next > month ? 1 : -1);
      setMonth(new Date(next.getFullYear(), next.getMonth(), 1));
    }
  }

  function onGridKey(event: KeyboardEvent<HTMLDivElement>) {
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (event.key in steps) {
      event.preventDefault();
      moveFocus(addDays(focused, steps[event.key]));
    } else if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault();
      const step = event.key === 'PageUp' ? -1 : 1;
      moveFocus(new Date(focused.getFullYear(), focused.getMonth() + step, focused.getDate()));
    }
  }

  const yearStart = month.getFullYear() - (month.getFullYear() % YEARS_PER_PAGE);
  const title =
    view === 'days'
      ? MONTH_YEAR.format(month)
      : view === 'months'
        ? String(month.getFullYear())
        : `${yearStart} – ${yearStart + YEARS_PER_PAGE - 1}`;
  const step = view === 'days' ? 1 : view === 'months' ? 12 : YEARS_PER_PAGE * 12;

  return (
    <div className="w-[18.5rem] select-none">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Previous"
          onClick={() => shiftMonth(-step)}
          className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => setView(view === 'days' ? 'months' : view === 'months' ? 'years' : 'days')}
          className="rounded-full px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          aria-live="polite"
        >
          {title}
        </button>
        <button
          type="button"
          aria-label="Next"
          onClick={() => shiftMonth(step)}
          className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>

      <AnimatePresence mode="popLayout" initial={false} custom={direction}>
        <motion.div
          key={`${view}-${view === 'days' ? dayKey(month) : view === 'months' ? month.getFullYear() : yearStart}`}
          initial={reduced ? false : { opacity: 0, x: direction * 14 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction * -14 }}
          transition={{ duration: 0.18, ease: EASE_FLUID }}
        >
          {view === 'days' && (
            <div ref={grid} role="grid" aria-label={MONTH_YEAR.format(month)} onKeyDown={onGridKey}>
              <div
                role="row"
                className="mb-1 grid grid-cols-7 text-center text-[0.7rem] text-muted-foreground"
              >
                {WEEKDAYS.map((day) => (
                  <span key={day} role="columnheader" className="py-1">
                    {day}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {monthGrid(month).map((date) => {
                  const key = dayKey(date);
                  const inMonth = date.getMonth() === month.getMonth();
                  const isSelected = selected && key === dayKey(selected);
                  const isToday = key === dayKey(today);
                  const disabled = outOfRange(date);
                  return (
                    <button
                      key={key}
                      type="button"
                      role="gridcell"
                      data-day={key}
                      tabIndex={key === dayKey(focused) ? 0 : -1}
                      disabled={disabled}
                      aria-selected={isSelected || undefined}
                      aria-label={FULL_DAY.format(date)}
                      onClick={() => onSelect(key)}
                      onFocus={() => setFocused(date)}
                      className={cn(
                        'relative flex aspect-square items-center justify-center rounded-xl text-sm tabular-nums transition-[background-color,color,transform] duration-150 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-95 disabled:cursor-not-allowed disabled:opacity-30',
                        isSelected
                          ? 'bg-primary font-semibold text-primary-foreground shadow-[0_8px_18px_-10px_var(--primary)]'
                          : inMonth
                            ? 'hover:bg-muted'
                            : 'text-muted-foreground/50 hover:bg-muted/60',
                        isToday && !isSelected && 'font-semibold text-primary ring-1 ring-primary/40',
                      )}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {view === 'months' && (
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 12 }, (_, index) => {
                const candidate = new Date(month.getFullYear(), index, 1);
                const current =
                  selected &&
                  selected.getFullYear() === candidate.getFullYear() &&
                  selected.getMonth() === index;
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => {
                      setMonth(candidate);
                      setView('days');
                    }}
                    className={cn(
                      'rounded-2xl py-3 text-sm transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                      current ? 'bg-primary font-medium text-primary-foreground' : 'hover:bg-muted',
                    )}
                  >
                    {MONTH_SHORT.format(candidate)}
                  </button>
                );
              })}
            </div>
          )}

          {view === 'years' && (
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: YEARS_PER_PAGE }, (_, index) => {
                const year = yearStart + index;
                return (
                  <button
                    key={year}
                    type="button"
                    onClick={() => {
                      setMonth(new Date(year, month.getMonth(), 1));
                      setView('months');
                    }}
                    className={cn(
                      'rounded-2xl py-3 text-sm tabular-nums transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                      selected?.getFullYear() === year
                        ? 'bg-primary font-medium text-primary-foreground'
                        : 'hover:bg-muted',
                      year === today.getFullYear() && selected?.getFullYear() !== year && 'text-primary',
                    )}
                  >
                    {year}
                  </button>
                );
              })}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-3 flex items-center justify-between border-t pt-3">
        <button
          type="button"
          onClick={() => onClear?.()}
          className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          Clear
        </button>
        <button
          type="button"
          disabled={outOfRange(today)}
          onClick={() => onSelect(dayKey(today))}
          className="rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/15 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-40"
        >
          Today
        </button>
      </div>
    </div>
  );
}
