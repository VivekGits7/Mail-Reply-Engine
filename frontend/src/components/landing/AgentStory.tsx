import { useEffect, useState } from 'react';
import { FileCheck2, Inbox, MailCheck, ScanFace, Tags, type LucideIcon } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { TONE_STYLES, type VisualTone } from '@/components/visual/tones';
import { cn } from '@/utils/cn';
import { EASE_FLUID } from '@/utils/animations';

const STEP_MS = 1700;

const STEPS: { icon: LucideIcon; title: string; detail: string; tone: VisualTone }[] = [
  {
    icon: Inbox,
    title: 'Email arrives',
    detail: 'A new joiner replies with three attachments',
    tone: 'azure',
  },
  {
    icon: ScanFace,
    title: 'Personal data masked',
    detail: 'Names, phone numbers and IDs are hidden from the AI',
    tone: 'iris',
  },
  {
    icon: Tags,
    title: 'Understood as documents',
    detail: 'Matched to the right onboarding case',
    tone: 'mint',
  },
  {
    icon: FileCheck2,
    title: 'Documents checked',
    detail: 'PAN, Aadhaar and photo verified, 3 of 7 done',
    tone: 'sun',
  },
  {
    icon: MailCheck,
    title: 'Reply drafted',
    detail: 'Waits for an HR approval before it goes out',
    tone: 'ember',
  },
];

export function AgentStory() {
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const timer = setInterval(() => setStep((current) => (current + 1) % (STEPS.length + 1)), STEP_MS);
    return () => clearInterval(timer);
  }, [reduced]);

  const reached = reduced ? STEPS.length - 1 : Math.min(step, STEPS.length - 1);

  return (
    <div
      className="relative w-full max-w-md rounded-[2rem] glass p-5 sm:p-6"
      role="img"
      aria-label="How the agent handles one email, from arrival to a drafted reply"
    >
      <div className="mb-5 flex items-center justify-between">
        <span className="text-sm font-medium">Agent at work</span>
        <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-mint/15 px-2.5 text-xs font-medium text-success">
          <span className="size-1.5 animate-pulse rounded-full bg-mint" />
          Live
        </span>
      </div>
      <ol className="relative flex flex-col gap-3">
        <span
          className="absolute top-7 bottom-7 left-7 w-0.5 -translate-x-1/2 rounded-full bg-border"
          aria-hidden="true"
        />
        <motion.span
          aria-hidden="true"
          className="absolute top-7 left-7 w-0.5 origin-top -translate-x-1/2 rounded-full bg-linear-to-b from-azure via-iris to-ember"
          style={{ height: 'calc(100% - 3.5rem)' }}
          animate={{ scaleY: reached / (STEPS.length - 1) }}
          transition={{ duration: 0.6, ease: EASE_FLUID }}
        />
        {STEPS.map((item, index) => {
          const Icon = item.icon;
          const done = index <= reached;
          return (
            <li
              key={item.title}
              className={cn(
                'relative flex items-center gap-3 rounded-2xl p-1.5 pr-3 transition-colors duration-500',
                index === reached && 'bg-card/80 shadow-[var(--pill-shadow)]',
              )}
            >
              <span className="relative z-10 flex size-11 shrink-0 rounded-2xl bg-card">
                <span
                  className={cn(
                    'flex size-full items-center justify-center rounded-2xl transition-colors duration-500',
                    done ? TONE_STYLES[item.tone].soft : 'bg-muted text-muted-foreground/60',
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" />
                </span>
              </span>
              <motion.span
                className="min-w-0"
                animate={{ opacity: done ? 1 : 0.4 }}
                transition={{ duration: 0.4 }}
              >
                <span className="block text-sm font-medium">{item.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>
              </motion.span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
