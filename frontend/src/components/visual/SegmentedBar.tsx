import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/utils/cn';
import { EASE_FLUID } from '@/utils/animations';
import { TONE_STYLES, type VisualTone } from './tones';

export interface Segment {
  key: string;
  label: string;
  value: number;
  tone: VisualTone;
}

interface SegmentedBarProps {
  segments: Segment[];
  label: string;
  showLegend?: boolean;
  className?: string;
}

export function SegmentedBar({ segments, label, showLegend = true, className }: SegmentedBarProps) {
  const reduced = useReducedMotion();
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const visible = segments.filter((segment) => segment.value > 0);

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div
        role="img"
        aria-label={`${label}: ${segments.map((segment) => `${segment.label} ${segment.value}`).join(', ')}`}
        className="flex h-3 w-full gap-1.5"
      >
        {total === 0 ? (
          <span className="h-full w-full rounded-full bg-muted" />
        ) : (
          visible.map((segment, index) => (
            <motion.span
              key={segment.key}
              className="h-full origin-left rounded-full"
              style={{
                flexGrow: segment.value,
                flexBasis: 0,
                backgroundColor: TONE_STYLES[segment.tone].fill,
              }}
              initial={reduced ? false : { scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.6, delay: index * 0.06, ease: EASE_FLUID }}
            />
          ))
        )}
      </div>
      {showLegend && (
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {segments.map((segment) => (
            <li key={segment.key} className="inline-flex items-center gap-2">
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: TONE_STYLES[segment.tone].fill }}
              />
              <span className="text-muted-foreground">{segment.label}</span>
              <span className="font-medium tabular-nums">{segment.value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
