import { NavLink } from 'react-router';
import { selectHasComplaintsAccess, selectIsAdmin } from '@/redux/authSlice';
import { useAppSelector } from '@/redux/hooks';
import { cn } from '@/utils/cn';
import { NAV_GROUPS } from './navItems';

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const isAdmin = useAppSelector(selectIsAdmin);
  const hasComplaints = useAppSelector(selectHasComplaintsAccess);
  const allowed = { admin: isAdmin, complaints: hasComplaints };

  return (
    <nav aria-label="Main" className="flex flex-col gap-5 px-3 py-4">
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="px-2 pb-1.5 text-xs font-medium text-muted-foreground">{group.label}</p>
          <ul className="flex flex-col gap-0.5">
            {group.items
              .filter((item) => !item.requires || allowed[item.requires])
              .map(({ to, label, icon: Icon, end }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={end}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'flex h-8 items-center gap-2.5 rounded-md px-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent',
                        isActive && 'bg-sidebar-accent font-medium text-sidebar-accent-foreground',
                      )
                    }
                  >
                    <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    {label}
                  </NavLink>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-r bg-sidebar lg:flex">
      <div className="flex h-14 items-center border-b px-5">
        <span className="text-sm font-semibold tracking-tight">HR Desk</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        <SidebarNav />
      </div>
    </aside>
  );
}
