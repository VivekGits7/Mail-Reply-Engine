import { ThemeToggleBar } from '@/components/common/ThemeToggleBar';
import { BrandMark, SidebarNav } from './Sidebar';

// The persistent nav rail shown at lg+. Below that the same groups appear in
// the slide-out Sheet (see Header.tsx), so there is one nav structure, two
// presentations.
export function DesktopSidebar() {
  return (
    <aside className="sticky top-2 hidden h-[calc(100svh-1rem)] w-72 shrink-0 lg:top-4 lg:flex lg:h-[calc(100svh-2rem)]">
      <div className="flex min-h-0 w-full flex-col glass rounded-[2rem] p-3">
        <div className="shrink-0 px-2 pt-2 pb-4">
          <BrandMark />
        </div>
        <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto">
          <SidebarNav className="px-0 py-0" />
        </div>
        <div className="shrink-0 border-t border-border/60 px-3 pt-3 pb-1">
          <ThemeToggleBar />
        </div>
      </div>
    </aside>
  );
}
