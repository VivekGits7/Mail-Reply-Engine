import { motion } from 'motion/react';
import { useToday } from '@/hooks/useToday';
import { cn } from '@/utils/cn';
import { riseIn, staggerParent } from '@/utils/animations';
import { dayKey } from '@/utils/utility';
import type { HolidayData } from '@/types';

const MONTH = new Intl.DateTimeFormat('en-IN', { month: 'long' });
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function monthCells(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  return [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, index) => new Date(year, month, index + 1)),
  ];
}

export function HolidayCalendar({ year, holidays }: { year: number; holidays: HolidayData[] }) {
  const byDay = new Map<string, string[]>();
  for (const holiday of holidays) {
    const key = holiday.holiday_date.slice(0, 10);
    byDay.set(key, [...(byDay.get(key) ?? []), holiday.name]);
  }
  const todayKey = dayKey(useToday());

  return (
    <motion.section
      aria-label={`${year} calendar`}
      variants={staggerParent}
      initial="hidden"
      animate="show"
      className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      {Array.from({ length: 12 }, (_, month) => {
        const count = [...byDay.keys()].filter((key) => Number(key.slice(5, 7)) === month + 1).length;
        return (
          <motion.div key={month} variants={riseIn} className="panel p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-normal tracking-tight">
                {MONTH.format(new Date(year, month, 1))}
              </h3>
              {count > 0 && (
                <span className="inline-flex h-6 items-center rounded-full bg-sun/30 px-2 text-xs font-medium text-sun-foreground dark:text-sun">
                  {count} {count === 1 ? 'holiday' : 'holidays'}
                </span>
              )}
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[0.7rem]">
              {WEEKDAYS.map((day, index) => (
                <span key={index} className="pb-1 text-muted-foreground">
                  {day}
                </span>
              ))}
              {monthCells(year, month).map((date, index) => {
                if (!date) return <span key={`blank-${index}`} />;
                const key = dayKey(date);
                const names = byDay.get(key);
                const weekend = date.getDay() === 0 || date.getDay() === 6;
                return (
                  <span
                    key={key}
                    title={names?.join(', ')}
                    className={cn(
                      'flex aspect-square items-center justify-center rounded-lg tabular-nums',
                      names
                        ? 'bg-sun font-semibold text-sun-foreground shadow-[0_6px_14px_-8px_var(--sun)]'
                        : weekend
                          ? 'text-muted-foreground/60'
                          : 'bg-muted/60',
                      key === todayKey && 'ring-2 ring-primary',
                    )}
                  >
                    {date.getDate()}
                    {names && <span className="sr-only">, {names.join(', ')}</span>}
                  </span>
                );
              })}
            </div>
          </motion.div>
        );
      })}
    </motion.section>
  );
}
