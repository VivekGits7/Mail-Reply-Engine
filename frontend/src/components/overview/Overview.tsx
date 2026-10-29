import { useQuery } from '@tanstack/react-query';
import { CalendarDays, ClipboardCheck, FileSignature, PackageCheck, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';
import { failuresQuery } from '@/components/admin/Adminapi';
import { approvalListQuery } from '@/components/approvals/Approvalsapi';
import { PageTitle } from '@/components/common/PageHeader';
import { exitListQuery } from '@/components/exits/Exitsapi';
import { StatTile } from '@/components/visual/StatTile';
import { useNow } from '@/hooks/useToday';
import { staggerParent } from '@/utils/animations';
import { ExitStage, OnboardingStage } from '@/types';
import { stageCountQuery } from './queries';

const TODAY = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

export default function Overview() {
  const approvals = useQuery(
    approvalListQuery({ status: 'pending', sort_order: 'oldest', limit: 4, offset: 0 }),
  );
  const signOff = useQuery(stageCountQuery(OnboardingStage.READY_FOR_SIGNOFF));
  const release = useQuery(
    exitListQuery({ stage: ExitStage.ALL_CLEARED, status: 'open', limit: 1, offset: 0 }),
  );
  const failures = useQuery(failuresQuery({ limit: 1, offset: 0 }));
  const now = useNow();

  return (
    <section>
      <PageTitle title="Overview" />
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <h1 className="min-w-0 text-[2rem] leading-[1.05] font-normal tracking-[-0.035em] text-balance sm:text-[2.6rem]">
          Overview
        </h1>
        <span className="inline-flex h-8 shrink-0 items-center gap-2 pill px-3 text-xs text-muted-foreground sm:mt-1.5">
          <CalendarDays className="size-3.5" aria-hidden="true" />
          {TODAY.format(now)}
        </span>
      </div>

      <motion.div
        variants={staggerParent}
        initial="hidden"
        animate="show"
        className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatTile
          to="/#approvals"
          title="Drafts to review"
          hint="AI-written emails waiting for your okay"
          icon={ClipboardCheck}
          tone="azure"
          value={approvals.data?.total}
          loading={approvals.isPending}
          unavailable={approvals.isError}
        />
        <StatTile
          to="/#joiners"
          title="Ready for sign-off"
          hint="New hires with all documents verified"
          icon={FileSignature}
          tone="mint"
          value={signOff.data?.total}
          loading={signOff.isPending}
          unavailable={signOff.isError}
        />
        <StatTile
          to="/#exits"
          title="Ready for release"
          hint="Exits cleared by every team"
          icon={PackageCheck}
          tone="sun"
          value={release.data?.total}
          loading={release.isPending}
          unavailable={release.isError}
        />
        <StatTile
          to="/#admin-failures"
          title="Failed work"
          hint="Emails that failed after retrying"
          icon={ShieldAlert}
          tone="ember"
          value={failures.data?.total}
          loading={failures.isPending}
          unavailable={failures.isError}
        />
      </motion.div>
    </section>
  );
}
