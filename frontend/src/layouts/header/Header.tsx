import { lazy, Suspense } from 'react';
import { Bell, Menu, Moon, Plus, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Link, useLocation } from 'react-router';
import { setSidebarOpen } from '@/redux/appSlice';
import { selectIsAdmin } from '@/redux/authSlice';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { BrandMark, SidebarNav } from '@/layouts/sidebar/Sidebar';
import { useNavCounts } from '@/layouts/sidebar/useNav';
import { activeGroup } from '@/layouts/sidebar/navItems';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/utils/cn';
import { QuickSearch } from './QuickSearch';
import { SectionTabs } from './SectionTabs';
import { UserMenu } from './UserMenu';

const ROUND_BUTTON =
  'pill flex size-11 shrink-0 items-center justify-center rounded-full text-foreground/80 transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none';

const JoinerFormDialog = lazy(() =>
  import('@/components/joiners/JoinerFormDialog').then((module) => ({ default: module.JoinerFormDialog })),
);

function AddJoinerButton() {
  const trigger = (
    <Button variant="outline" size="lg" className="hidden md:inline-flex">
      <Plus aria-hidden="true" />
      Add joiner
    </Button>
  );
  return (
    <Suspense fallback={trigger}>
      <JoinerFormDialog trigger={trigger} />
    </Suspense>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  return (
    <button
      type="button"
      className={ROUND_BUTTON}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={() => setTheme(dark ? 'light' : 'dark')}
    >
      {dark ? (
        <Sun className="size-4.5" aria-hidden="true" />
      ) : (
        <Moon className="size-4.5" aria-hidden="true" />
      )}
    </button>
  );
}

function ApprovalsBell() {
  const { approvals } = useNavCounts();
  return (
    <Link
      to="/approvals"
      className={cn(ROUND_BUTTON, 'relative')}
      aria-label={approvals ? `${approvals} approvals waiting` : 'Approvals'}
    >
      <Bell className="size-4.5" aria-hidden="true" />
      {approvals ? (
        <span className="absolute top-2.5 right-3 size-2 rounded-full bg-ember ring-2 ring-card" />
      ) : null}
    </Link>
  );
}

export function Header() {
  const dispatch = useAppDispatch();
  const isAdmin = useAppSelector(selectIsAdmin);
  const sidebarOpen = useAppSelector((state) => state.app.sidebarOpen);
  const { pathname } = useLocation();
  const inDesk = activeGroup(pathname).id === 'desk';

  return (
    <header className="sticky top-2 z-30 flex flex-col gap-2 rounded-[2rem] glass p-2 lg:top-4 lg:flex-row lg:items-center lg:p-2.5">
      <div className="flex items-center gap-2 lg:contents">
        <div className="flex items-center gap-2 lg:hidden">
          <Button
            variant="outline"
            size="icon-lg"
            aria-label="Open menu"
            onClick={() => dispatch(setSidebarOpen(true))}
          >
            <Menu aria-hidden="true" />
          </Button>
          <BrandMark compact />
        </div>
        <SectionTabs className="hidden min-w-0 flex-1 lg:block" />
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <QuickSearch />
          {isAdmin && inDesk && pathname !== '/joiners' && <AddJoinerButton />}
          <ThemeToggle />
          <ApprovalsBell />
          <UserMenu />
        </div>
      </div>
      <SectionTabs className="lg:hidden" />
      <Sheet open={sidebarOpen} onOpenChange={(open) => dispatch(setSidebarOpen(open))}>
        <SheetContent side="left" className="w-80 p-0">
          <SheetHeader className="border-b p-4">
            <SheetTitle asChild>
              <div>
                <BrandMark />
              </div>
            </SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto">
            <SidebarNav onNavigate={() => dispatch(setSidebarOpen(false))} />
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
