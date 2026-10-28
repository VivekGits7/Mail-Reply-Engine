import { Mail } from 'lucide-react';
import { Link } from 'react-router';
import { cn } from '@/utils/cn';
import { NAV_GROUPS, sectionHref, type NavItem } from './navItems';
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

// Every item now scrolls to its section on the single dashboard page instead of routing to its own page.
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
            {filter(group.items).map(({ to, label, icon: Icon, count }) => (
              <li key={to}>
                <Link
                  to={sectionHref(to)}
                  onClick={onNavigate}
                  className="flex h-11 items-center gap-3 rounded-full px-3 text-sm transition-colors hover:bg-muted"
                >
                  <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  {count && <CountBadge value={counts[count]} kind={count} />}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
