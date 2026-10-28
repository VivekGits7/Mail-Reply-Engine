import { Bell, Menu } from 'lucide-react';
import { Link } from 'react-router';
import { setSidebarOpen } from '@/redux/appSlice';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { SendingMenuIndicator } from '@/layouts/sidebar/SendingIndicator';
import { BrandMark, SidebarNav } from '@/layouts/sidebar/Sidebar';
import { sectionHref } from '@/layouts/sidebar/navItems';
import { useNavCounts, useSendingAlert } from '@/layouts/sidebar/useNav';
import { ThemeMenu } from '@/components/common/ThemeMenu';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/utils/cn';
import { QuickSearch } from './QuickSearch';
import { SectionTabs } from './SectionTabs';
import { UserMenu } from './UserMenu';

const ROUND_BUTTON =
  'pill flex size-11 shrink-0 items-center justify-center rounded-full text-foreground/80 transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none';

function ApprovalsBell() {
  const { approvals } = useNavCounts();
  return (
    <Link
      to={sectionHref('/approvals')}
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
  const sidebarOpen = useAppSelector((state) => state.app.sidebarOpen);
  const sending = useSendingAlert();
  const closeMenu = () => dispatch(setSidebarOpen(false));

  return (
    <header className="sticky top-2 z-30 flex flex-col gap-2 rounded-[2rem] glass p-2 lg:top-4 lg:flex-row lg:items-center lg:p-2.5">
      <div className="flex items-center gap-2 lg:contents">
        <div className="flex items-center gap-2 lg:hidden">
          <Button
            variant="outline"
            size="icon-lg"
            aria-label={sending ? `Open menu. ${sending.title}` : 'Open menu'}
            className="relative"
            onClick={() => dispatch(setSidebarOpen(true))}
          >
            <Menu aria-hidden="true" />
            {sending && (
              <span
                aria-hidden="true"
                className={cn(
                  'absolute top-2 right-2 size-2 rounded-full ring-2 ring-card',
                  sending.tone === 'danger' ? 'bg-ember' : 'bg-warning',
                )}
              />
            )}
          </Button>
          <BrandMark compact />
        </div>
        <SectionTabs className="hidden min-w-0 flex-1 lg:block" />
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <QuickSearch />
          <ThemeMenu className={ROUND_BUTTON} />
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
            <SendingMenuIndicator className="mx-3 mt-4" onNavigate={closeMenu} />
            <SidebarNav onNavigate={closeMenu} />
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
