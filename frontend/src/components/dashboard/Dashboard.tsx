import { lazy, Suspense, useMemo, type ReactNode } from 'react';
import { PageTitle } from '@/components/common/PageHeader';
import { BlockSkeleton } from '@/components/common/QueryState';
import { PAGES } from '@/components/pages';
import { useScrollSpy } from '@/hooks/useScrollSpy';
import { useScrollToHash } from '@/hooks/useScrollToHash';
import { NAV_GROUPS, sectionId } from '@/layouts/sidebar/navItems';
import { useAllowedItems } from '@/layouts/sidebar/useNav';

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

function Section({ to, children }: { to: string; children: ReactNode }) {
  return (
    <section id={sectionId(to)} className="scroll-mt-24 panel p-5 sm:p-8 lg:scroll-mt-28">
      <Suspense fallback={<BlockSkeleton />}>{children}</Suspense>
    </section>
  );
}

function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-1 text-xs font-medium tracking-[0.1em] text-muted-foreground uppercase">{children}</p>
  );
}

export default function Dashboard() {
  useScrollToHash();
  const filter = useAllowedItems();
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
            return (
              <Section key={item.to} to={item.to}>
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
