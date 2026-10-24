import { useEffect, useState } from 'react';
import {
  CircleCheck,
  FileCheck2,
  MailCheck,
  Presentation,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Avatar } from '@/components/visual/Avatar';
import { TONE_STYLES, type VisualTone } from '@/components/visual/tones';
import { cn } from '@/utils/cn';
import { EASE_FLUID } from '@/utils/animations';

const CYCLE_MS = 2800;
const VISIBLE = 3;
const STEP_Y = 62;

const NOTES: {
  id: string;
  name: string;
  action: string;
  meta: string;
  icon: LucideIcon;
  tone: VisualTone;
}[] = [
  {
    id: 'docs',
    name: 'Aarav Mehta',
    action: 'sent 3 documents',
    meta: 'Onboarding · all names match',
    icon: FileCheck2,
    tone: 'mint',
  },
  {
    id: 'clear',
    name: 'Finance',
    action: 'cleared Priya Sharma',
    meta: 'Exit · 3 of 4 teams done',
    icon: CircleCheck,
    tone: 'ember',
  },
  {
    id: 'reply',
    name: 'Rohan Das',
    action: 'asked about his joining date',
    meta: 'Reply drafted · waiting for approval',
    icon: MailCheck,
    tone: 'azure',
  },
  {
    id: 'plan',
    name: 'Meera Pillai',
    action: 'has an induction plan',
    meta: 'Induction · 4 sessions over 2 days',
    icon: Presentation,
    tone: 'iris',
  },
  {
    id: 'risk',
    name: 'Kabir Nair',
    action: 'has not replied in 5 days',
    meta: 'Flagged as a dropout risk',
    icon: TriangleAlert,
    tone: 'sun',
  },
];

export function NotificationStack() {
  const reduced = useReducedMotion();
  const [start, setStart] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const timer = setInterval(() => setStart((value) => (value + 1) % NOTES.length), CYCLE_MS);
    return () => clearInterval(timer);
  }, [reduced]);

  const visible = Array.from({ length: VISIBLE }, (_, index) => NOTES[(start + index) % NOTES.length]);

  return (
    <div
      className="relative mx-auto h-[14rem] w-full max-w-[27rem]"
      aria-label="Things the agent did recently"
      role="img"
    >
      <div
        className="absolute inset-x-6 top-6 bottom-0 rounded-full bg-primary/25 blur-3xl"
        aria-hidden="true"
      />
      <AnimatePresence initial={false}>
        {visible.map((note, index) => {
          const Icon = note.icon;
          return (
            <motion.div
              key={note.id}
              className="absolute inset-x-0 top-0 mx-auto"
              style={{ zIndex: VISIBLE - index, width: `${100 - index * 7}%` }}
              initial={reduced ? false : { opacity: 0, y: VISIBLE * STEP_Y, scale: 0.9 }}
              animate={{ opacity: 1 - index * 0.22, y: index * STEP_Y, scale: 1 - index * 0.03 }}
              exit={{ opacity: 0, y: -24, scale: 1.02, transition: { duration: 0.35 } }}
              transition={{ duration: 0.55, ease: EASE_FLUID }}
            >
              <div className="flex items-center gap-3 rounded-2xl glass px-3.5 py-3 text-left">
                <span className="relative">
                  <Avatar name={note.name} size="md" />
                  <span
                    className={cn(
                      'absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full ring-2 ring-card',
                      TONE_STYLES[note.tone].solid,
                    )}
                  >
                    <Icon className="size-3" aria-hidden="true" />
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm">
                    <span className="font-semibold">{note.name}</span> {note.action}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{note.meta}</span>
                </span>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
