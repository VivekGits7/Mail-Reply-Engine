import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Mail } from 'lucide-react';
import { Link } from 'react-router';
import { selectActiveSection, setActiveSection } from '@/redux/appSlice';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { cn } from '@/utils/cn';
import { isActiveSection, NAV_GROUPS, sectionHref, sectionId, type NavItem } from './navItems';
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

function NavItemLink({
  to,
  label,
  Icon,
  count,
  active,
  counts,
  onItemClick,
}: {
  to: string;
  label: string;
  Icon: NavItem['icon'];
  count: NavItem['count'];
  active: boolean;
  counts: Record<CountKey, number | undefined>;
  onItemClick: (to: string) => void;
}) {
  const ref = useRef<HTMLAnchorElement>(null);

  // Keep the highlighted item visible inside the sidebar's own scroll area as
  // the scroll-spy moves it, without touching the page's own scroll position.
  useEffect(() => {
    if (!active) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    ref.current?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
  }, [active]);

  return (
    <li>
      <Link
        ref={ref}
        to={sectionHref(to)}
        onClick={() => onItemClick(to)}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'relative flex h-11 items-center gap-3 rounded-full pr-3 pl-4 text-sm transition-colors',
          active
            ? 'bg-primary/12 font-semibold text-primary'
            : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
        )}
      >
        {active && (
          <span
            aria-hidden="true"
            className="absolute top-1/2 left-0 h-5 w-1 -translate-y-1/2 rounded-full bg-primary"
          />
        )}
        <Icon className={cn('size-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {count && <CountBadge value={counts[count]} kind={count} />}
      </Link>
    </li>
  );
}

function GroupDropdown({
  group,
  items,
  activeId,
  counts,
  defaultOpen = false,
  onItemClick,
}: {
  group: (typeof NAV_GROUPS)[number];
  items: NavItem[];
  activeId: string;
  counts: Record<CountKey, number | undefined>;
  defaultOpen?: boolean;
  onItemClick: (to: string) => void;
}) {
  const containsActive = items.some((item) => isActiveSection(item.to, activeId));
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className={cn(
          'flex w-full items-center gap-1.5 rounded-lg px-3 py-1.5 text-[0.7rem] font-medium tracking-[0.08em] uppercase transition-colors',
          containsActive && !open
            ? 'text-primary font-semibold'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <span className="min-w-0 flex-1 truncate text-left">{group.label}</span>
        {containsActive && !open && (
          <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
        )}
        <ChevronDown
          className={cn('size-3.5 shrink-0 transition-transform duration-200', !open && '-rotate-90')}
          aria-hidden="true"
        />
      </button>
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-300 ease-(--ease-fluid)',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <ul className="flex flex-col gap-0.5 overflow-hidden">
          {items.map(({ to, label, icon: Icon, count }) => (
            <NavItemLink
              key={to}
              to={to}
              label={label}
              Icon={Icon}
              count={count}
              active={isActiveSection(to, activeId)}
              counts={counts}
              onItemClick={onItemClick}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

// Every item scrolls to its section on the single dashboard page instead of
// routing to its own page. The scroll-spy in useScrollSpy keeps `activeId`
// current, so highlighting follows scroll position, not just clicks.
export function SidebarNav({ onNavigate, className }: { onNavigate?: () => void; className?: string }) {
  const dispatch = useAppDispatch();
  const filter = useAllowedItems();
  const counts = useNavCounts();
  const activeId = useAppSelector(selectActiveSection);

  function handleItemClick(to: string) {
    // Optimistic: highlight immediately on click, then the scroll-spy
    // confirms (or corrects) it once the smooth scroll settles.
    dispatch(setActiveSection(sectionId(to)));
    onNavigate?.();
  }

  return (
    <nav aria-label="Main" className={cn('flex flex-col gap-5 px-3 py-4', className)}>
      {NAV_GROUPS.map((group, index) => {
        const items = filter(group.items);
        if (!items.length) return null;
        return (
          <GroupDropdown
            key={group.id}
            group={group}
            items={items}
            activeId={activeId}
            counts={counts}
            defaultOpen={index === 0}
            onItemClick={handleItemClick}
          />
        );
      })}
    </nav>
  );
}
