import { Link } from 'react-router';
import { NAV_GROUPS, sectionHref } from '@/layouts/sidebar/navItems';
import { useAllowedItems, useNavCounts } from '@/layouts/sidebar/useNav';
import { cn } from '@/utils/cn';

// Every section now lives on the single dashboard page, so this is a flat
// list of scroll links grouped with a divider, not a per-route tab strip.
export function SectionTabs({ className }: { className?: string }) {
  const filter = useAllowedItems();
  const counts = useNavCounts();

  return (
    <nav
      aria-label="Dashboard sections"
      className={cn(
        'scrollbar-none min-w-0 overflow-x-auto [mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)]',
        className,
      )}
    >
      <ul className="flex items-center gap-1.5 p-1 pr-8">
        {NAV_GROUPS.map((group, index) => {
          const items = filter(group.items);
          if (items.length === 0) return null;
          return (
            <li key={group.id} className="flex items-center gap-1.5">
              {index > 0 && <span aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-border" />}
              <ul className="flex items-center gap-1.5">
                {items.map(({ to, label, icon: Icon, count }) => {
                  const value = count ? counts[count] : undefined;
                  return (
                    <li key={to} className="shrink-0">
                      <Link
                        to={sectionHref(to)}
                        className="relative flex h-11 items-center gap-2 pill rounded-full px-4 text-sm text-foreground/75 transition-colors duration-200 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                      >
                        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                        <span>{label}</span>
                        {value ? (
                          <span
                            className={cn(
                              'min-w-5 rounded-full px-1.5 text-center text-[0.7rem] leading-5 font-semibold tabular-nums',
                              count === 'failures'
                                ? 'bg-destructive text-white'
                                : 'bg-primary text-primary-foreground',
                            )}
                          >
                            {value > 99 ? '99+' : value}
                            <span className="sr-only">{count === 'failures' ? ' failed' : ' waiting'}</span>
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
