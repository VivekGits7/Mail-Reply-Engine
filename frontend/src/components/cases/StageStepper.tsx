import { Check } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/utils/cn';
import { EASE_FLUID } from '@/utils/animations';
import { statusLabel } from '@/utils/labels';

const FLOWS: Record<string, string[]> = {
  onboarding: ['docs_requested', 'docs_in_progress', 'ready_for_signoff', 'it_requested', 'closed'],
  exit: ['clearance_requested', 'clearances_in_progress', 'all_cleared', 'closed'],
  induction: ['drafting', 'awaiting_approval', 'booking', 'booked', 'welcome_sent', 'closed'],
};

export function StageStepper({ caseType, stage }: { caseType: string; stage: string }) {
  const reduced = useReducedMotion();
  const flow = FLOWS[caseType];
  if (!flow) return null;
  const current = flow.indexOf(stage);
  if (current === -1) return null;

  return (
    <ol
      aria-label="Case progress"
      className="mt-6 grid gap-2"
      style={{ gridTemplateColumns: `repeat(${flow.length}, minmax(0, 1fr))` }}
    >
      {flow.map((step, index) => {
        const done = index < current || (index === current && step === 'closed');
        const active = index === current && !done;
        return (
          <li key={step} className="min-w-0" aria-current={active ? 'step' : undefined}>
            <div className="relative h-2 overflow-hidden rounded-full bg-muted">
              {(done || active) && (
                <motion.span
                  className={cn('absolute inset-0 origin-left rounded-full', done ? 'bg-mint' : 'bg-primary')}
                  initial={reduced ? false : { scaleX: 0 }}
                  animate={{ scaleX: active ? 0.5 : 1 }}
                  transition={{ duration: 0.5, delay: index * 0.08, ease: EASE_FLUID }}
                />
              )}
            </div>
            <span
              className={cn(
                'mt-2 flex items-center gap-1.5 text-xs',
                active
                  ? 'font-medium text-foreground'
                  : done
                    ? 'text-foreground/80'
                    : 'text-muted-foreground',
              )}
            >
              {done && <Check className="size-3.5 shrink-0 text-success" aria-hidden="true" />}
              <span className="truncate">{statusLabel(step).label}</span>
              {done && <span className="sr-only">, done</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
