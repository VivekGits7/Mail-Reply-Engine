import { motion, useReducedMotion, type Transition } from 'motion/react';
import { cn } from '@/utils/cn';

const FLOW: Transition = { type: 'spring', stiffness: 300, damping: 27, mass: 0.9 };
const WOBBLE: Transition = { type: 'spring', stiffness: 420, damping: 12, mass: 0.55 };

interface LiquidPillProps {
  layoutId: string;
  settleKey: string;
  className?: string;
}

export function LiquidPill({ layoutId, settleKey, className }: LiquidPillProps) {
  const reduced = useReducedMotion();
  return (
    <motion.span
      layoutId={layoutId}
      transition={FLOW}
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 rounded-full', className)}
    >
      <motion.span
        key={settleKey}
        className="absolute inset-0 overflow-hidden rounded-[inherit] liquid-glass"
        initial={reduced ? false : { scaleX: 1.1, scaleY: 0.84 }}
        animate={{ scaleX: 1, scaleY: 1 }}
        transition={WOBBLE}
      >
        <span className="absolute -inset-y-3 left-0 w-3/4 animate-water rounded-full bg-[radial-gradient(closest-side,var(--glass-sheen),transparent)] opacity-70 blur-[3px]" />
        <span className="absolute -inset-y-4 right-0 w-2/3 animate-water-slow rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--primary)_22%,transparent),transparent)] blur-[4px]" />
        <span className="absolute inset-x-2 top-px h-1/2 rounded-full bg-linear-to-b from-white/60 to-transparent dark:from-white/12" />
      </motion.span>
      {!reduced && (
        <motion.span
          key={`ripple-${settleKey}`}
          className="absolute inset-0 rounded-[inherit] ring-2 ring-primary/35"
          initial={{ opacity: 0.8, scale: 0.92 }}
          animate={{ opacity: 0, scale: 1.18 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
      )}
    </motion.span>
  );
}
