import { Menu } from 'lucide-react';
import { setSidebarOpen } from '@/redux/appSlice';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { BrandMark, SidebarNav } from '@/layouts/sidebar/Sidebar';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { UserMenu } from './UserMenu';

export function Header() {
  const dispatch = useAppDispatch();
  const sidebarOpen = useAppSelector((state) => state.app.sidebarOpen);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b bg-background px-4 sm:px-6 lg:px-8">
      <div className="flex items-center gap-2 lg:hidden">
        <Button variant="ghost" size="icon" aria-label="Open menu" onClick={() => dispatch(setSidebarOpen(true))}>
          <Menu aria-hidden="true" />
        </Button>
        <BrandMark />
      </div>
      <div className="ml-auto">
        <UserMenu />
      </div>
      <Sheet open={sidebarOpen} onOpenChange={(open) => dispatch(setSidebarOpen(open))}>
        <SheetContent side="left" className="w-72 bg-sidebar p-0">
          <SheetHeader className="border-b">
            <SheetTitle>HR Desk</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto">
            <SidebarNav onNavigate={() => dispatch(setSidebarOpen(false))} />
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
