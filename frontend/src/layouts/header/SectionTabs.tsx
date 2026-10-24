import { useId } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { NavLink, useLocation } from 'react-router';
import { activeGroup, activeItem } from '@/layouts/sidebar/navItems';
import { useAllowedItems, useNavCounts } from '@/layouts/sidebar/useNav';
import { LiquidPill } from '@/components/visual/LiquidPill';
import { cn } from '@/utils/cn';
import { EASE_FLUID } from '@/utils/animations';

export function SectionTabs({ className }: { className?: string }) {
  const { pathname } = useLocation();
  const reduced = useReducedMotion();
  const group = activeGroup(pathname);
  const current = activeItem(pathname);
  const filter = useAllowedItems();
  const counts = useNavCounts();
  // The header renders a desktop and a phone copy, and a shared layoutId would make motion hide one pill.
  const pillId = `section-tab-${useId()}`;

  return (
    <nav
      aria-label={`${group.label} pages`}
      className={cn(
        'scrollbar-none min-w-0 overflow-x-auto [mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)]',
        className,
      )}
    >
      <motion.ul
        key={group.id}
        className="flex items-center gap-2 p-1 pr-8"
        initial={reduced ? false : { opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.22, ease: EASE_FLUID }}
      >
        {filter(group.items).map(({ to, label, icon: Icon, end, count }) => {
          const active = current?.to === to;
          const value = count ? counts[count] : undefined;
          return (
            <li key={to} className="shrink-0">
              <NavLink
                to={to}
                end={end}
                className={cn(
                  'relative flex h-11 items-center gap-2 pill rounded-full px-4 text-sm transition-colors duration-200 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                  active ? 'font-medium text-foreground' : 'text-foreground/75 hover:text-foreground',
                )}
              >
                {active && <LiquidPill layoutId={pillId} settleKey={to} />}
                <Icon
                  className={cn('relative z-10 size-4', active ? 'text-primary' : 'text-muted-foreground')}
                  aria-hidden="true"
                />
                <span className="relative z-10">{label}</span>
                {value ? (
                  <span
                    className={cn(
                      'relative z-10 min-w-5 rounded-full px-1.5 text-center text-[0.7rem] leading-5 font-semibold tabular-nums',
                      count === 'failures'
                        ? 'bg-destructive text-white'
                        : 'bg-primary text-primary-foreground',
                    )}
                  >
                    {value > 99 ? '99+' : value}
                    <span className="sr-only">{count === 'failures' ? ' failed' : ' waiting'}</span>
                  </span>
                ) : null}
              </NavLink>
            </li>
          );
        })}
      </motion.ul>
    </nav>
  );
}
