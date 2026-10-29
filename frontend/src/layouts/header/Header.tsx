import { Menu } from 'lucide-react';
import { setSidebarOpen } from '@/redux/appSlice';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { SendingMenuIndicator } from '@/layouts/sidebar/SendingIndicator';
import { BrandMark, SidebarNav } from '@/layouts/sidebar/Sidebar';
import { useSendingAlert } from '@/layouts/sidebar/useNav';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/utils/cn';
import { Breadcrumb } from './Breadcrumb';
import { QuickSearch } from './QuickSearch';
import { SectionTabs } from './SectionTabs';
import { UserMenu } from './UserMenu';

export function Header() {
  const dispatch = useAppDispatch();
  const sidebarOpen = useAppSelector((state) => state.app.sidebarOpen);
  const sending = useSendingAlert();
  const closeMenu = () => dispatch(setSidebarOpen(false));

  return (
    <header className="sticky top-2 z-30 flex flex-col gap-2 rounded-[2rem] glass p-2 sm:px-3 lg:top-4 lg:h-16 lg:flex-row lg:items-center lg:px-4 lg:py-2">
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
        <Breadcrumb className="hidden min-w-0 flex-1 lg:block" />
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <QuickSearch />
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
