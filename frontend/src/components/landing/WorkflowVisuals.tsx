import type { ReactNode } from 'react';
import {
  Angry,
  BellRing,
  CalendarCheck2,
  Check,
  Clock3,
  FileText,
  Frown,
  Laugh,
  LockKeyhole,
  Meh,
  Smile,
  TriangleAlert,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { Avatar } from '@/components/visual/Avatar';
import { RadialProgress } from '@/components/visual/RadialProgress';
import { cn } from '@/utils/cn';
import { EASE_FLUID } from '@/utils/animations';

function Float({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y: 18, scale: 0.96 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: '-80px 0px' }}
      transition={{ duration: 0.6, delay, ease: EASE_FLUID }}
    >
      {children}
    </motion.div>
  );
}

function Glow({ className }: { className: string }) {
  return <div aria-hidden="true" className={cn('absolute rounded-full blur-3xl', className)} />;
}

const DOCUMENTS = [
  { name: 'PAN card', done: true },
  { name: 'Aadhaar card', done: true },
  { name: 'Passport size photo', done: true },
  { name: 'Degree certificate', done: true },
  { name: 'Class 12 certificate', done: false },
];

export function OnboardingVisual() {
  return (
    <div className="relative mx-auto flex h-[25rem] w-full max-w-lg flex-col items-center justify-center">
      <Glow className="inset-10 bg-azure/20" />
      <div className="relative flex w-full max-w-sm flex-col gap-2.5">
        <Float delay={0.5} className="mb-1 ml-4 self-start">
          <div className="flex items-center gap-3 rounded-full glass py-2 pr-4 pl-2">
            <RadialProgress value={4} max={5} label="Documents verified" tone="mint" size={44} stroke={5} />
            <span className="text-sm leading-tight">
              <span className="block font-medium">4 of 5 in</span>
              <span className="text-xs text-muted-foreground">Reminder sent</span>
            </span>
          </div>
        </Float>
        {DOCUMENTS.map((doc, index) => (
          <Float key={doc.name} delay={index * 0.09} className={cn(index % 2 ? 'ml-8' : 'mr-8')}>
            <div className="flex items-center gap-3 rounded-2xl glass px-3.5 py-2.5">
              <span className="flex size-9 items-center justify-center rounded-xl bg-azure/12 text-azure">
                <FileText className="size-4" />
              </span>
              <span className="flex-1 text-sm">{doc.name}</span>
              <span
                className={cn(
                  'inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-medium',
                  doc.done ? 'bg-mint/15 text-success' : 'bg-sun/30 text-sun-foreground dark:text-sun',
                )}
              >
                {doc.done ? <Check className="size-3" /> : <Clock3 className="size-3" />}
                {doc.done ? 'Verified' : 'Asked again'}
              </span>
            </div>
          </Float>
        ))}
      </div>
    </div>
  );
}

const TEAMS = [
  { name: 'IT', done: true },
  { name: 'Finance', done: true },
  { name: 'Admin', done: true },
  { name: 'Manager', done: false },
];

export function ExitVisual() {
  return (
    <div className="relative mx-auto flex h-[25rem] w-full max-w-lg items-center justify-center">
      <Glow className="inset-12 bg-ember/15" />
      <div className="relative flex items-center">
        <Float delay={0.05} className="relative z-10">
          <Avatar name="Priya Sharma" size="xl" className="ring-4 sm:size-20 sm:text-xl" />
          <span className="absolute top-full left-1/2 mt-2 -translate-x-1/2 rounded-full glass px-3 py-1 text-xs font-medium whitespace-nowrap">
            Last day Friday
          </span>
        </Float>
        <span aria-hidden="true" className="w-6 border-t-2 border-dashed border-mint sm:w-14" />
        <ul className="relative flex flex-col gap-4 sm:gap-5">
          {TEAMS.map((team, index) => {
            const next = TEAMS[index + 1];
            return (
              <li key={team.name} className="relative flex h-10 items-center pl-6 sm:h-12 sm:pl-14">
                {next && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute top-1/2 left-0 h-[calc(100%+1rem)] border-l-2 border-dashed sm:h-[calc(100%+1.25rem)]',
                      next.done ? 'border-mint' : 'border-border',
                    )}
                  />
                )}
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute top-1/2 left-0 w-6 border-t-2 border-dashed sm:w-14',
                    team.done ? 'border-mint' : 'border-border',
                  )}
                />
                <Float delay={0.15 + index * 0.12}>
                  <span
                    className={cn(
                      'inline-flex h-9 items-center gap-1.5 rounded-full glass px-3.5 text-sm font-medium whitespace-nowrap sm:h-12 sm:gap-2 sm:px-5 sm:text-base',
                      team.done ? 'text-success' : 'text-muted-foreground',
                    )}
                  >
                    {team.done ? <Check className="size-4" /> : <Clock3 className="size-4" />}
                    {team.name}
                  </span>
                </Float>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

const SESSIONS = [
  {
    day: 'Monday',
    items: [
      { title: 'HR orientation', time: '10:00' },
      { title: 'IT setup', time: '11:15' },
    ],
  },
  {
    day: 'Tuesday',
    items: [
      { title: 'Meet your manager', time: '10:00' },
      { title: 'Policies and security', time: '14:30' },
    ],
  },
];

export function InductionVisual() {
  return (
    <div className="relative mx-auto flex h-[25rem] w-full max-w-lg items-center justify-center">
      <Glow className="inset-12 bg-iris/20" />
      <div className="relative grid w-full max-w-md grid-cols-2 gap-4">
        {SESSIONS.map((day, dayIndex) => (
          <div key={day.day} className={cn('flex flex-col gap-2.5', dayIndex === 1 && 'mt-12')}>
            <Float delay={dayIndex * 0.15}>
              <span className="text-sm font-medium text-muted-foreground">{day.day}</span>
            </Float>
            {day.items.map((session, index) => (
              <Float key={session.title} delay={0.1 + dayIndex * 0.15 + index * 0.1}>
                <div className="rounded-2xl glass px-3.5 py-3">
                  <p className="text-sm font-medium">{session.title}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock3 className="size-3" />
                    {session.time}
                  </p>
                </div>
              </Float>
            ))}
          </div>
        ))}
      </div>
      <Float delay={0.6} className="absolute bottom-6 left-1/4 -translate-x-1/2 sm:left-[27%]">
        <span className="inline-flex h-10 items-center gap-2 rounded-full bg-iris px-4 text-sm font-medium whitespace-nowrap text-white shadow-[0_12px_28px_-12px_var(--iris)]">
          <CalendarCheck2 className="size-4" />
          Invites booked
        </span>
      </Float>
    </div>
  );
}

const PEOPLE = [
  { name: 'Sameer Khan', note: 'Timesheet due Friday', round: 'Reminder 1 of 3' },
  { name: 'Riya Kapoor', note: 'Appraisal form pending', round: 'Reminder 2 of 3' },
  { name: 'Farah Ali', note: 'Training not started', round: 'Escalated to manager' },
];

export function RemindersVisual() {
  return (
    <div className="relative mx-auto flex h-[25rem] w-full max-w-lg items-center justify-center">
      <Glow className="inset-12 bg-sun/25" />
      <div className="relative flex w-full max-w-sm flex-col gap-3">
        {PEOPLE.map((person, index) => (
          <Float key={person.name} delay={index * 0.12} className={cn(index === 1 && 'ml-12 sm:ml-10')}>
            <div className="flex items-center gap-3 rounded-2xl glass px-3.5 py-3">
              <Avatar name={person.name} size="md" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{person.note}</span>
                <span className="block text-xs text-muted-foreground">{person.name}</span>
              </span>
              <span
                className={cn(
                  'rounded-full px-2.5 py-1 text-[0.7rem] font-medium whitespace-nowrap',
                  index === 2 ? 'bg-ember/12 text-ember' : 'bg-sun/30 text-sun-foreground dark:text-sun',
                )}
              >
                {person.round}
              </span>
            </div>
          </Float>
        ))}
      </div>
      <Float delay={0.45} className="absolute top-1/2 left-0 -translate-y-1/2 sm:left-10">
        <span className="flex size-10 animate-orb-float items-center justify-center rounded-full glass text-warning sm:size-14">
          <BellRing className="size-5 sm:size-6" />
        </span>
      </Float>
    </div>
  );
}

const MOODS = [Angry, Frown, Meh, Smile, Laugh];

export function FeedbackVisual() {
  return (
    <div className="relative mx-auto flex h-[25rem] w-full max-w-lg flex-col items-center justify-center gap-8">
      <Glow className="inset-12 bg-mint/20" />
      <Float className="relative flex gap-2 sm:gap-3">
        {MOODS.map((Mood, index) => (
          <span
            key={index}
            className={cn(
              'flex size-11 items-center justify-center rounded-full glass sm:size-14',
              index === 3 ? 'text-ember ring-2 ring-ember/40' : 'text-muted-foreground',
            )}
          >
            <Mood className="size-5 sm:size-6" />
          </span>
        ))}
      </Float>
      <Float delay={0.15} className="relative flex w-full max-w-sm gap-1.5">
        {MOODS.map((_, index) => (
          <span
            key={index}
            className={cn('h-2.5 flex-1 rounded-full', index <= 3 ? 'bg-ember' : 'bg-muted')}
          />
        ))}
      </Float>
      <Float delay={0.3} className="relative flex flex-wrap justify-center gap-2.5">
        {['30 days · 4.2', '60 days · 3.9', '90 days · 4.4'].map((label) => (
          <span key={label} className="rounded-full glass px-3.5 py-2 text-sm tabular-nums">
            {label}
          </span>
        ))}
      </Float>
      <Float delay={0.45} className="relative">
        <span className="inline-flex items-center gap-2 rounded-full bg-sun/30 px-3.5 py-2 text-sm font-medium text-sun-foreground dark:text-sun">
          <TriangleAlert className="size-4" />
          One low score flagged for HR
        </span>
      </Float>
    </div>
  );
}

export function ComplaintsVisual() {
  return (
    <div className="relative mx-auto flex h-[25rem] w-full max-w-lg items-center justify-center">
      <Glow className="inset-14 bg-ember/15" />
      <Float className="relative flex flex-col items-center gap-5">
        <span className="flex size-24 items-center justify-center rounded-full glass text-ember shadow-[0_20px_40px_-20px_var(--ember)]">
          <LockKeyhole className="size-10" />
        </span>
        <div className="flex w-72 flex-col gap-2" aria-hidden="true">
          {[90, 70, 82, 55].map((width, index) => (
            <span
              key={index}
              className="h-3 rounded-full bg-foreground/10 backdrop-blur-sm"
              style={{ width: `${width}%` }}
            />
          ))}
        </div>
        <span className="rounded-full glass px-4 py-2 text-sm">Only people HR chooses can open this</span>
      </Float>
    </div>
  );
}
