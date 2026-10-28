import { useQuery } from '@tanstack/react-query';
import { CalendarDays, ClipboardCheck, FileSignature, PackageCheck, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';
import { selectIsAdmin, selectUser } from '@/redux/authSlice';
import { useAppSelector } from '@/redux/hooks';
import { failuresQuery, settingsQuery, statusQuery } from '@/components/admin/Adminapi';
import { SendingStatus } from '@/components/admin/SendingStatus';
import { approvalListQuery } from '@/components/approvals/Approvalsapi';
import { PageTitle } from '@/components/common/PageHeader';
import { ErrorState } from '@/components/common/QueryState';
import { exitListQuery } from '@/components/exits/Exitsapi';
import { joinerListQuery } from '@/components/joiners/Joinersapi';
import { AvatarStack } from '@/components/visual/Avatar';
import { RadialProgress } from '@/components/visual/RadialProgress';
import { StatTile } from '@/components/visual/StatTile';
import { Skeleton } from '@/components/ui/skeleton';
import { useNow } from '@/hooks/useToday';
import { staggerParent } from '@/utils/animations';
import { missingContacts, requiredContactCount, setupSteps } from '@/utils/setup';
import { ExitStage, OnboardingStage } from '@/types';
import { OnboardingCards } from './OnboardingCards';
import { PeopleBoard } from './PeopleBoard';
import { ClearancePanel, OnboardingPipeline } from './Pipelines';
import { stageCountQuery } from './queries';
import { SetupChecklist } from './SetupChecklist';
import { WaitingForHr } from './WaitingForHr';
import { WelcomePanel } from './WelcomePanel';

const TODAY = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

function greeting(hour: number) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Overview() {
  const isAdmin = useAppSelector(selectIsAdmin);
  const user = useAppSelector(selectUser);
  const approvals = useQuery(
    approvalListQuery({ status: 'pending', sort_order: 'oldest', limit: 4, offset: 0 }),
  );
  const allJoiners = useQuery(joinerListQuery({ limit: 1, offset: 0 }));
  const onboarding = useQuery(
    joinerListQuery({ status: 'open', sort_by: 'joining_date', sort_order: 'oldest', limit: 4, offset: 0 }),
  );
  const activeJoiners = useQuery(joinerListQuery({ status: 'open', limit: 1, offset: 0 }));
  const signOff = useQuery(stageCountQuery(OnboardingStage.READY_FOR_SIGNOFF));
  const openExits = useQuery(exitListQuery({ status: 'open', limit: 1, offset: 0 }));
  const release = useQuery(
    exitListQuery({ stage: ExitStage.ALL_CLEARED, status: 'open', limit: 1, offset: 0 }),
  );
  const failures = useQuery(failuresQuery({ limit: 1, offset: 0 }));
  const status = useQuery(statusQuery());
  const settings = useQuery(settingsQuery());
  const now = useNow();

  const draftPeople = (approvals.data?.data ?? []).flatMap((item) =>
    item.person_name ? [item.person_name] : [],
  );

  return (
    <section>
      <PageTitle title="Overview" />
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <span className="mb-3 inline-flex h-8 items-center gap-2 pill px-3 text-xs text-muted-foreground">
            <CalendarDays className="size-3.5" aria-hidden="true" />
            {TODAY.format(now)}
          </span>
          <h1 className="text-[2rem] leading-[1.05] font-normal tracking-[-0.035em] text-balance sm:text-[2.6rem]">
            {greeting(now.getHours())}, {user?.name?.split(' ')[0] ?? 'there'}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-pretty text-muted-foreground">
            What the email agent is doing right now, and the decisions waiting for HR.
          </p>
        </div>
      </div>

      {status.data && settings.data && allJoiners.data && (
        <SetupChecklist
          steps={setupSteps({
            testInbox: status.data.test_inbox,
            settings: settings.data,
            joinerCount: allJoiners.data.total,
          })}
          testInbox={status.data.test_inbox}
          dryRun={status.data.dry_run}
          missingContacts={missingContacts(settings.data).length}
          totalContacts={requiredContactCount(settings.data)}
          isAdmin={isAdmin}
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
          hint="AI-written replies and induction plans"
          icon={ClipboardCheck}
          tone="azure"
          value={approvals.data?.total}
          loading={approvals.isPending}
          unavailable={approvals.isError}
          visual={<AvatarStack names={draftPeople} max={3} size="sm" />}
        />
        <StatTile
          to="/#joiners"
          title="Ready for sign-off"
          hint="Joiners with every document verified"
          icon={FileSignature}
          tone="mint"
          value={signOff.data?.total}
          loading={signOff.isPending}
          unavailable={signOff.isError}
          visual={
            activeJoiners.data?.total ? (
              <RadialProgress
                value={signOff.data?.total ?? 0}
                max={activeJoiners.data.total}
                label="Ready out of active joiners"
                tone="mint"
                size={48}
                stroke={5}
              />
            ) : null
          }
        />
        <StatTile
          to="/#exits"
          title="Ready for release"
          hint="Exits where every team has cleared"
          icon={PackageCheck}
          tone="sun"
          value={release.data?.total}
          loading={release.isPending}
          unavailable={release.isError}
          visual={
            openExits.data?.total ? (
              <RadialProgress
                value={release.data?.total ?? 0}
                max={openExits.data.total}
                label="Cleared out of open exits"
                tone="sun"
                size={48}
                stroke={5}
              />
            ) : null
          }
        />
        <StatTile
          to="/#admin-failures"
          title="Failed work"
          hint="Work that ran out of retries"
          icon={ShieldAlert}
          tone="ember"
          value={failures.data?.total}
          loading={failures.isPending}
          unavailable={failures.isError}
        />
      </motion.div>

      <div className="mb-4">
        <PeopleBoard />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
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
        <WelcomePanel />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <OnboardingPipeline />
        <ClearancePanel />
        {status.isPending ? (
          <Skeleton className="h-72 w-full rounded-[1.75rem]" />
        ) : status.isError ? (
          <ErrorState error={status.error} onRetry={() => status.refetch()} />
        ) : (
          <SendingStatus
            status={status.data}
            failedCount={failures.data?.total}
            showControlsLink
            className="lg:col-span-2 xl:col-span-1"
          />
        )}
      </div>
    </section>
  );
}
