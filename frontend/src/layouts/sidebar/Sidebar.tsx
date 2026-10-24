import { useQuery } from '@tanstack/react-query';
import { Mail } from 'lucide-react';
import { NavLink } from 'react-router';
import { failuresQuery } from '@/components/admin/Adminapi';
import { approvalListQuery } from '@/components/approvals/Approvalsapi';
import { selectHasComplaintsAccess, selectIsAdmin } from '@/redux/authSlice';
import { useAppSelector } from '@/redux/hooks';
import { cn } from '@/utils/cn';
import { NAV_GROUPS, type NavItem } from './navItems';

function useNavCounts(): Record<NonNullable<NavItem['count']>, number | undefined> {
  const approvals = useQuery(approvalListQuery({ status: 'pending', limit: 1, offset: 0 }));
  const failures = useQuery(failuresQuery({ limit: 1, offset: 0 }));
  return { approvals: approvals.data?.total, failures: failures.data?.total };
}

export function BrandMark({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Mail className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block text-sm font-semibold tracking-tight">HR Desk</span>
        <span className="block text-xs text-muted-foreground">Mail Reply Engine</span>
      </span>
    </div>
  );
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const isAdmin = useAppSelector(selectIsAdmin);
  const hasComplaints = useAppSelector(selectHasComplaintsAccess);
  const allowed = { admin: isAdmin, complaints: hasComplaints };
  const counts = useNavCounts();

  return (
    <nav aria-label="Main" className="flex flex-col gap-5 px-3 py-4">
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="px-2 pb-1.5 text-xs font-medium text-muted-foreground">{group.label}</p>
          <ul className="flex flex-col gap-0.5">
            {group.items
              .filter((item) => !item.requires || allowed[item.requires])
              .map(({ to, label, icon: Icon, end, count }) => {
                const value = count ? counts[count] : undefined;
                return (
                  <li key={to}>
                    <NavLink
                      to={to}
                      end={end}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          'flex h-9 items-center gap-2.5 rounded-md px-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent lg:h-8',
                          isActive && 'bg-sidebar-accent font-medium text-sidebar-accent-foreground',
                        )
                      }
                    >
                      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate">{label}</span>
                      {value ? (
                        <span
                          className={cn(
                            'ml-auto min-w-5 rounded-sm px-1.5 text-center text-xs font-medium tabular-nums',
                            count === 'failures' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary',
                          )}
                        >
                          {value}
                          <span className="sr-only">{count === 'failures' ? ' failed' : ' waiting'}</span>
                        </span>
                      ) : null}
                    </NavLink>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-r bg-sidebar lg:flex">
      <div className="flex h-14 items-center border-b px-4">
        <BrandMark />
      </div>
      <div className="flex-1 overflow-y-auto">
        <SidebarNav />
      </div>
    </aside>
  );
}
