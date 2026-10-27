import { Mail } from 'lucide-react';
import { Link, NavLink, useLocation } from 'react-router';
import { LiquidPill } from '@/components/visual/LiquidPill';
import { cn } from '@/utils/cn';
import { ADMIN_GROUP_ID, NAV_GROUPS, activeGroup, type NavGroup, type NavItem } from './navItems';
import { SendingRailIndicator } from './SendingIndicator';
import { useAllowedItems, useNavCounts } from './useNav';

type CountKey = NonNullable<NavItem['count']>;

export function BrandMark({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <Link
      to="/welcome"
      title="About HR Desk"
      className={cn(
        'group/brand flex items-center gap-2.5 rounded-2xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
        className,
      )}
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_8px_20px_-10px_var(--primary)] transition-transform duration-200 ease-(--ease-fluid) group-hover/brand:scale-105">
        <Mail className="size-5" aria-hidden="true" />
      </span>
      <span className={cn('min-w-0 leading-tight', compact && 'sr-only')}>
        <span className="block text-sm font-semibold tracking-tight">HR Desk</span>
        <span className="block text-xs text-muted-foreground">Mail Reply Engine</span>
      </span>
    </Link>
  );
}

function CountBadge({ value, kind }: { value?: number; kind: CountKey }) {
  if (!value) return null;
  return (
    <span
      className={cn(
        'min-w-5 rounded-full px-1.5 text-center text-[0.7rem] leading-5 font-semibold tabular-nums',
        kind === 'failures' ? 'bg-destructive text-white' : 'bg-primary text-primary-foreground',
      )}
    >
      {value > 99 ? '99+' : value}
      <span className="sr-only">{kind === 'failures' ? ' failed' : ' waiting'}</span>
    </span>
  );
}

interface CategoryLinkProps {
  group: NavGroup;
  active: boolean;
  count?: number;
}

function CategoryLink({ group, active, count }: CategoryLinkProps) {
  const filter = useAllowedItems();
  const first = filter(group.items)[0];
  if (!first) return null;
  const Icon = group.icon;
  const kind = group.count;
  return (
    <Link
      to={first.to}
      aria-current={active ? 'page' : undefined}
      aria-label={
        count && kind ? `${group.label}, ${count} ${kind === 'failures' ? 'failed' : 'waiting'}` : group.label
      }
      className={cn(
        'group/rail flex w-16 shrink-0 flex-col items-center gap-1 rounded-2xl py-1 transition-colors duration-200 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
        active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <span
        className={cn(
          'relative flex size-11 items-center justify-center rounded-full transition-colors duration-200',
          !active && 'group-hover/rail:bg-muted/70',
        )}
      >
        {active && <LiquidPill layoutId="rail-active" settleKey={group.id} />}
        <Icon className={cn('relative z-10 size-5', active && 'text-primary')} aria-hidden="true" />
        {count && kind ? (
          <span
            aria-hidden="true"
            className={cn(
              'absolute -top-0.5 -right-0.5 z-10 flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 text-[0.6rem] leading-none font-semibold tabular-nums ring-2 ring-card',
              kind === 'failures' ? 'bg-destructive text-white' : 'bg-primary text-primary-foreground',
            )}
          >
            {count > 99 ? '99+' : count}
          </span>
        ) : null}
      </span>
      <span className={cn('text-[0.65rem] leading-tight', active ? 'font-semibold' : 'font-medium')}>
        {group.label}
      </span>
    </Link>
  );
}

export function Sidebar() {
  const { pathname } = useLocation();
  const current = activeGroup(pathname);
  const counts = useNavCounts();
  const admin = NAV_GROUPS.find((group) => group.id === ADMIN_GROUP_ID);

  return (
    <aside className="sticky top-4 hidden h-[calc(100svh-2rem)] w-[4.75rem] shrink-0 flex-col items-center rounded-[2rem] glass py-4 lg:flex">
      <BrandMark compact />
      <nav
        aria-label="Categories"
        className="my-3 scrollbar-none flex min-h-0 w-full flex-1 flex-col overflow-y-auto"
      >
        <div className="my-auto flex flex-col items-center gap-3 py-2">
          {NAV_GROUPS.filter((group) => group.id !== ADMIN_GROUP_ID).map((group) => (
            <CategoryLink
              key={group.id}
              group={group}
              active={group.id === current.id}
              count={group.count ? counts[group.count] : undefined}
            />
          ))}
        </div>
      </nav>
      <div className="flex flex-col items-center gap-3">
        <SendingRailIndicator />
        {admin && <CategoryLink group={admin} active={current.id === ADMIN_GROUP_ID} />}
      </div>
    </aside>
  );
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const filter = useAllowedItems();
  const counts = useNavCounts();

  return (
    <nav aria-label="Main" className="flex flex-col gap-5 px-3 py-4">
      {NAV_GROUPS.map((group) => (
        <div key={group.id}>
          <p className="px-3 pb-1.5 text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">
            {group.label}
          </p>
          <ul className="flex flex-col gap-0.5">
            {filter(group.items).map(({ to, label, icon: Icon, end, count }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'flex h-11 items-center gap-3 rounded-full px-3 text-sm transition-colors hover:bg-muted',
                      isActive && 'liquid-glass font-medium',
                    )
                  }
                >
                  <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  {count && <CountBadge value={counts[count]} kind={count} />}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
