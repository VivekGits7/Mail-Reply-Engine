import { lazy, Suspense, useCallback, useMemo, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { PageTitle } from '@/components/common/PageHeader';
import { BlockSkeleton } from '@/components/common/QueryState';
import { PAGES } from '@/components/pages';
import { useScrollSpy } from '@/hooks/useScrollSpy';
import { useScrollToHash } from '@/hooks/useScrollToHash';
import { NAV_GROUPS, sectionId, type NavItem } from '@/layouts/sidebar/navItems';
import { useAllowedItems } from '@/layouts/sidebar/useNav';
import { cn } from '@/utils/cn';

const Overview = lazy(PAGES.overview);
const Approvals = lazy(PAGES.approvals);
const Joiners = lazy(PAGES.joiners);
const Exits = lazy(PAGES.exits);
const Reminders = lazy(PAGES.reminders);
const Feedback = lazy(PAGES.feedback);
const Complaints = lazy(PAGES.complaints);
const ActionLog = lazy(PAGES.actionLog);
const Failures = lazy(PAGES.failures);
const Controls = lazy(PAGES.controls);
const Settings = lazy(PAGES.settings);
const Templates = lazy(PAGES.templates);
const Checklists = lazy(PAGES.checklists);
const InductionTemplates = lazy(PAGES.inductionTemplates);
const Holidays = lazy(PAGES.holidays);
const Users = lazy(PAGES.users);

const SECTION_COMPONENT: Record<string, ReactNode> = {
  '/': <Overview />,
  '/approvals': <Approvals />,
  '/joiners': <Joiners />,
  '/exits': <Exits />,
  '/reminders': <Reminders />,
  '/feedback': <Feedback />,
  '/complaints': <Complaints />,
  '/admin/activity': <ActionLog />,
  '/admin/failures': <Failures />,
  '/admin/controls': <Controls />,
  '/admin/settings': <Settings />,
  '/admin/templates': <Templates />,
  '/admin/checklists': <Checklists />,
  '/admin/induction': <InductionTemplates />,
  '/admin/holidays': <Holidays />,
  '/admin/users': <Users />,
};

function Section({
  item,
  children,
  open,
  onOpenChange,
}: {
  item: NavItem;
  children: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const id = sectionId(item.to);
  const Icon = item.icon;
  const isOverview = item.to === '/';

  return (
    <section id={id} className="scroll-mt-24 panel lg:scroll-mt-28">
      {isOverview ? (
        <div className="p-5 sm:p-8">
          <Suspense fallback={<BlockSkeleton />}>{children}</Suspense>
        </div>
      ) : (
        <>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={`${id}-content`}
            onClick={() => onOpenChange(!open)}
            className="flex min-h-11 w-full items-center gap-3 rounded-[inherit] px-5 py-4 text-left transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:px-8"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="size-4.5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold tracking-tight text-foreground">{item.label}</span>
              <span className="block text-sm text-muted-foreground">
                {open ? `Hide ${item.label.toLowerCase()}` : `Open ${item.label.toLowerCase()}`}
              </span>
            </span>
            <ChevronDown
              className={cn('size-5 shrink-0 text-muted-foreground transition-transform duration-200', open && 'rotate-180')}
              aria-hidden="true"
            />
          </button>
          <div
            id={`${id}-content`}
            className={cn(
              'grid transition-[grid-template-rows] duration-300 ease-(--ease-fluid)',
              open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
            )}
          >
            <div className="overflow-hidden">
              {open && (
                <div className="border-t border-border/70 p-5 sm:p-8">
                  <Suspense fallback={<BlockSkeleton />}>{children}</Suspense>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-1 text-xs font-medium tracking-[0.1em] text-muted-foreground uppercase">{children}</p>
  );
}

export default function Dashboard() {
  const filter = useAllowedItems();
  const [openSections, setOpenSections] = useState<ReadonlySet<string>>(() => new Set());
  const openTargetSection = useCallback((id: string) => {
    if (id === 'overview') return;
    setOpenSections((current) => (current.has(id) ? current : new Set(current).add(id)));
  }, []);
  useScrollToHash(openTargetSection);
  const sectionIds = useMemo(
    () => NAV_GROUPS.flatMap((group) => filter(group.items).map((item) => sectionId(item.to))),
    [filter],
  );
  useScrollSpy(sectionIds);

  return (
    <div className="flex flex-col gap-12">
      {NAV_GROUPS.map((group) => (
        <div key={group.id} className="flex flex-col gap-10">
          {group.id !== 'desk' && <GroupLabel>{group.label}</GroupLabel>}
          {filter(group.items).map((item) => {
            const content = SECTION_COMPONENT[item.to];
            if (!content) return null;
            const id = sectionId(item.to);
            return (
              <Section
                key={item.to}
                item={item}
                open={item.to === '/' || openSections.has(id)}
                onOpenChange={(open) =>
                  setOpenSections((current) => {
                    const next = new Set(current);
                    if (open) next.add(id);
                    else next.delete(id);
                    return next;
                  })
                }
              >
                {content}
              </Section>
            );
          })}
        </div>
      ))}
      {/* Rendered last so it wins over each section's own <title> (React keeps the last-committed one). */}
      <PageTitle title="Dashboard" />
    </div>
  );
}
