import { useQuery } from '@tanstack/react-query';
import { CalendarDays, ClipboardCheck, FileSignature, PackageCheck, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';
import { selectUser } from '@/redux/authSlice';
import { useAppSelector } from '@/redux/hooks';
import { failuresQuery, settingsQuery, statusQuery } from '@/components/admin/Adminapi';
// import { SendingStatus } from '@/components/admin/SendingStatus';
import { approvalListQuery } from '@/components/approvals/Approvalsapi';
import { PageTitle } from '@/components/common/PageHeader';
// import { ErrorState } from '@/components/common/QueryState';
import { exitListQuery } from '@/components/exits/Exitsapi';
import { joinerListQuery } from '@/components/joiners/Joinersapi';
import { StatTile } from '@/components/visual/StatTile';
// import { Skeleton } from '@/components/ui/skeleton';
import { useNow } from '@/hooks/useToday';
import { staggerParent } from '@/utils/animations';
import { setupSteps } from '@/utils/setup';
import { ExitStage, OnboardingStage } from '@/types';
import { OnboardingCards } from './OnboardingCards';
import { stageCountQuery } from './queries';
import { SetupChecklist } from './SetupChecklist';
import { WaitingForHr } from './WaitingForHr';

const TODAY = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

function greeting(hour: number) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Overview() {
  const user = useAppSelector(selectUser);
  const approvals = useQuery(
    approvalListQuery({ status: 'pending', sort_order: 'oldest', limit: 4, offset: 0 }),
  );
  const allJoiners = useQuery(joinerListQuery({ limit: 1, offset: 0 }));
  const onboarding = useQuery(
    joinerListQuery({ status: 'open', sort_by: 'joining_date', sort_order: 'oldest', limit: 4, offset: 0 }),
  );
  const signOff = useQuery(stageCountQuery(OnboardingStage.READY_FOR_SIGNOFF));
  const release = useQuery(
    exitListQuery({ stage: ExitStage.ALL_CLEARED, status: 'open', limit: 1, offset: 0 }),
  );
  const failures = useQuery(failuresQuery({ limit: 1, offset: 0 }));
  const status = useQuery(statusQuery());
  const settings = useQuery(settingsQuery());
  const now = useNow();

  return (
    <section>
      <PageTitle title="Overview" />
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <h1 className="min-w-0 text-[2rem] leading-[1.05] font-normal tracking-[-0.035em] text-balance sm:text-[2.6rem]">
          {greeting(now.getHours())}, {user?.name?.split(' ')[0] ?? 'there'}
        </h1>
        <span className="inline-flex h-8 shrink-0 items-center gap-2 pill px-3 text-xs text-muted-foreground sm:mt-1.5">
          <CalendarDays className="size-3.5" aria-hidden="true" />
          {TODAY.format(now)}
        </span>
      </div>

      {status.data && settings.data && allJoiners.data && (
        <SetupChecklist
          steps={setupSteps({
            testInbox: status.data.test_inbox,
            settings: settings.data,
            joinerCount: allJoiners.data.total,
          })}
        />
      )}

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

      <div className="mb-4 flex flex-col gap-4">
        <WaitingForHr
          items={approvals.data?.data}
          loading={approvals.isPending}
          error={approvals.error}
          onRetry={() => approvals.refetch()}
        />
        <OnboardingCards
          items={onboarding.data?.data}
          loading={onboarding.isPending}
          error={onboarding.error}
          onRetry={() => onboarding.refetch()}
        />
      </div>

    </section>
  );
}
