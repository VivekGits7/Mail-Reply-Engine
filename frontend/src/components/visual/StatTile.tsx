import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/utils/cn';
import { riseIn } from '@/utils/animations';
import { TONE_STYLES, type VisualTone } from './tones';

interface StatTileProps {
  title: string;
  value?: number | string;
  icon: LucideIcon;
  tone?: VisualTone;
  hint?: ReactNode;
  to?: string;
  loading?: boolean;
  unavailable?: boolean;
  className?: string;
}

export function StatTile({
  title,
  value,
  icon: Icon,
  tone = 'azure',
  hint,
  to,
  loading,
  unavailable,
  className,
}: StatTileProps) {
  const body = (
    <>
      <span
        className={cn('flex size-11 shrink-0 items-center justify-center rounded-2xl', TONE_STYLES[tone].soft)}
      >
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span className="mt-5 text-sm text-muted-foreground">{title}</span>
      <div className="mt-1 flex h-11 items-center text-[2.5rem] leading-none font-light tracking-[-0.04em] tabular-nums">
        {loading ? (
          <Skeleton className="h-9 w-14" />
        ) : unavailable ? (
          <span className="text-sm font-normal tracking-normal text-muted-foreground">Unavailable</span>
        ) : (
          value
        )}
      </div>
      {hint && <span className="mt-1.5 text-xs text-pretty text-muted-foreground">{hint}</span>}
    </>
  );

  const classes = cn('panel flex min-w-0 flex-col p-5', className);
  return (
    <motion.div variants={riseIn} className="min-w-0">
      {to ? (
        <Link
          to={to}
          className={cn(
            classes,
            'h-full transition-[transform,box-shadow] duration-200 ease-(--ease-fluid) hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
          )}
        >
          {body}
        </Link>
      ) : (
        <div className={cn(classes, 'h-full')}>{body}</div>
      )}
    </motion.div>
  );
}
