import { activeGroup, activeItem } from '@/layouts/sidebar/navItems';
import { selectActiveSection } from '@/redux/appSlice';
import { useAppSelector } from '@/redux/hooks';
import { cn } from '@/utils/cn';

// Fills the space the permanent sidebar freed up on desktop: a quiet trail
// showing where the current section sits, not a page title (each section
// already renders its own <h1> via PageHeader). Follows the scroll-spied
// section, so it updates live as the page scrolls, not just on click.
export function Breadcrumb({ className }: { className?: string }) {
  const activeId = useAppSelector(selectActiveSection);
  const group = activeGroup(activeId);
  const item = activeItem(activeId);
  const crumbs = ['HR Desk', group?.label, item?.label].filter((value): value is string => Boolean(value));

  return (
    <nav aria-label="Breadcrumb" className={cn('min-w-0', className)}>
      <ol className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
        {crumbs.map((crumb, index) => (
          <li key={crumb} className="flex items-center gap-1.5">
            {index > 0 && (
              <span aria-hidden="true" className="text-muted-foreground/50">
                /
              </span>
            )}
            <span className={index === crumbs.length - 1 ? 'font-medium text-foreground' : undefined}>
              {crumb}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
