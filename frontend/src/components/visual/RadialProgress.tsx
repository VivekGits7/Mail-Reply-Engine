import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/utils/cn';
import { EASE_FLUID } from '@/utils/animations';
import { TONE_STYLES, type VisualTone } from './tones';

interface RadialProgressProps {
  value: number;
  max: number;
  label: string;
  tone?: VisualTone;
  size?: number;
  stroke?: number;
  children?: ReactNode;
  className?: string;
}

export function RadialProgress({
  value,
  max,
  label,
  tone = 'azure',
  size = 56,
  stroke = 6,
  children,
  className,
}: RadialProgressProps) {
  const reduced = useReducedMotion();
  const ratio = max > 0 ? Math.min(1, value / max) : 0;
  const radius = (size - stroke) / 2;

  return (
    <div
      role="img"
      aria-label={`${label}: ${value} of ${max}`}
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke={TONE_STYLES[tone].fill}
          initial={reduced ? false : { pathLength: 0 }}
          animate={{ pathLength: ratio }}
          transition={{ duration: 0.8, ease: EASE_FLUID }}
          style={{ opacity: ratio === 0 ? 0 : 1 }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums">
        {children ?? `${Math.round(ratio * 100)}%`}
      </span>
    </div>
  );
}
