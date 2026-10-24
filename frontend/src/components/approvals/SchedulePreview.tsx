import { CalendarDays, Clock } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/utils/cn';
import { riseIn, staggerParent } from '@/utils/animations';

const DAY = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const TIME = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' });
const CHIP_TONES = [
  'bg-azure/12 text-azure',
  'bg-iris/12 text-iris',
  'bg-mint/15 text-success',
  'bg-ember/12 text-ember',
  'bg-sun/25 text-sun-foreground dark:text-sun',
];

interface PreviewSession {
  title: string;
  owner_email: string;
  start: string;
  end: string;
}

function toneFor(owner: string, owners: string[]) {
  return CHIP_TONES[Math.max(0, owners.indexOf(owner)) % CHIP_TONES.length];
}

export function SchedulePreview({ sessions }: { sessions: PreviewSession[] }) {
  const valid = sessions
    .filter((session) => session.start && session.end && !Number.isNaN(new Date(session.start).getTime()))
    .sort((a, b) => a.start.localeCompare(b.start));
  if (!valid.length) return null;
  const owners = [...new Set(valid.map((session) => session.owner_email))];
  const days = new Map<string, PreviewSession[]>();
  for (const session of valid) {
    const key = session.start.slice(0, 10);
    days.set(key, [...(days.get(key) ?? []), session]);
  }

  return (
    <section aria-labelledby="schedule-title" className="mb-6 panel p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="schedule-title" className="text-xl font-normal tracking-[-0.02em]">
          Schedule preview
        </h2>
        <span className="inline-flex h-8 items-center gap-2 pill px-3 text-xs text-muted-foreground">
          <CalendarDays className="size-3.5" aria-hidden="true" />
          {valid.length} sessions over {days.size} {days.size === 1 ? 'day' : 'days'}
        </span>
      </div>
      <motion.ol
        variants={staggerParent}
        initial="hidden"
        animate="show"
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(auto-fill, minmax(15rem, 1fr))` }}
      >
        {[...days.entries()].map(([day, items]) => (
          <motion.li key={day} variants={riseIn} className="panel-inset p-4">
            <p className="mb-3 text-sm font-medium">{DAY.format(new Date(`${day}T00:00:00`))}</p>
            <ul className="flex flex-col gap-2">
              {items.map((session, index) => (
                <li
                  key={`${session.start}-${index}`}
                  className={cn('rounded-2xl px-3 py-2.5', toneFor(session.owner_email, owners))}
                >
                  <p className="truncate text-sm font-medium">{session.title || 'Untitled session'}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs opacity-80">
                    <Clock className="size-3" aria-hidden="true" />
                    {TIME.format(new Date(session.start))} – {TIME.format(new Date(session.end))}
                    <span className="truncate">· {session.owner_email || 'No owner'}</span>
                  </p>
                </li>
              ))}
            </ul>
          </motion.li>
        ))}
      </motion.ol>
    </section>
  );
}
