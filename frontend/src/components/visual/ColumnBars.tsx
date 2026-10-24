import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/utils/cn';
import { EASE_FLUID } from '@/utils/animations';
import { TONE_STYLES, type VisualTone } from './tones';

const BAR_HEADROOM = 86;

export interface ColumnGroup {
  key: string;
  label: string;
  values: { tone: VisualTone; value: number; label: string }[];
}

interface ColumnBarsProps {
  groups: ColumnGroup[];
  label: string;
  height?: number;
  className?: string;
}

export function ColumnBars({ groups, label, height = 160, className }: ColumnBarsProps) {
  const reduced = useReducedMotion();
  const peak = Math.max(1, ...groups.flatMap((group) => group.values.map((item) => item.value)));

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div
        role="img"
        aria-label={`${label}: ${groups
          .map(
            (group) =>
              `${group.label} ${group.values.map((item) => `${item.label} ${item.value}`).join(' and ')}`,
          )
          .join(', ')}`}
        className="relative grid items-end gap-4 border-b border-dashed border-border pb-px"
        style={{ height, gridTemplateColumns: `repeat(${groups.length}, minmax(0, 1fr))` }}
      >
        {groups.map((group, groupIndex) => (
          <div key={group.key} className="flex h-full items-end justify-center gap-1.5">
            {group.values.map((item, index) => (
              <div key={item.label} className="flex h-full w-full max-w-9 flex-col items-center justify-end">
                {item.value > 0 && (
                  <span className="pb-1 text-[0.7rem] font-medium text-muted-foreground tabular-nums">
                    {item.value}
                  </span>
                )}
                <motion.div
                  className="relative w-full origin-bottom overflow-hidden rounded-xl"
                  style={{
                    height: `${Math.max(item.value ? 8 : 4, (item.value / peak) * BAR_HEADROOM)}%`,
                    backgroundColor: item.value ? TONE_STYLES[item.tone].fill : 'var(--muted)',
                  }}
                  initial={reduced ? false : { scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: 0.55, delay: groupIndex * 0.05 + index * 0.04, ease: EASE_FLUID }}
                >
                  <span className="absolute inset-x-0 top-0 h-1/2 bg-white/18" />
                </motion.div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${groups.length}, minmax(0, 1fr))` }}>
        {groups.map((group) => (
          <span key={group.key} className="truncate text-center text-xs text-muted-foreground">
            {group.label}
          </span>
        ))}
      </div>
    </div>
  );
}
