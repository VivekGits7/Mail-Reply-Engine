import { useQuery } from '@tanstack/react-query';
import { exitListQuery } from '@/components/exits/Exitsapi';
import { SectionHeading } from '@/components/common/PageHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { TEAM_LABELS } from '@/utils/labels';
import { ClearanceTeam, OnboardingStage } from '@/types';
import { stageCountQuery } from './queries';

function plural(n: number, singular: string, plural: string) {
  return n === 1 ? singular : plural;
}

const STAGES: { stage: OnboardingStage; sentence: (n: number) => string }[] = [
  {
    stage: OnboardingStage.DOCS_REQUESTED,
    sentence: (n) =>
      `${n} ${plural(n, 'joiner has', 'joiners have')} not sent any documents yet.`,
  },
  {
    stage: OnboardingStage.DOCS_IN_PROGRESS,
    sentence: (n) => `${n} ${plural(n, 'joiner is', 'joiners are')} partway through sending documents.`,
  },
  {
    stage: OnboardingStage.READY_FOR_SIGNOFF,
    sentence: (n) =>
      `${n} ${plural(n, 'joiner has', 'joiners have')} sent everything and ${plural(n, 'is', 'are')} ready for you to sign off.`,
  },
  {
    stage: OnboardingStage.IT_REQUESTED,
    sentence: (n) => `${n} ${plural(n, 'joiner is', 'joiners are')} signed off, and IT is setting up their account.`,
  },
];

const TEAMS: ClearanceTeam[] = [
  ClearanceTeam.IT,
  ClearanceTeam.FINANCE,
  ClearanceTeam.ADMIN,
  ClearanceTeam.MANAGER,
];

export function OnboardingPipeline() {
  const first = useQuery(stageCountQuery(STAGES[0].stage));
  const second = useQuery(stageCountQuery(STAGES[1].stage));
  const third = useQuery(stageCountQuery(STAGES[2].stage));
  const fourth = useQuery(stageCountQuery(STAGES[3].stage));
  const queries = [first, second, third, fourth];
  const loading = queries.some((query) => query.isPending);
  const counts = STAGES.map((item, index) => ({ ...item, value: queries[index].data?.total ?? 0 }));
  const total = counts.reduce((sum, item) => sum + item.value, 0);

  return (
    <section aria-labelledby="pipeline-title" className="flex min-w-0 flex-col panel p-5 sm:p-6">
      <SectionHeading
        id="pipeline-title"
        title="Onboarding pipeline"
        subtitle="Where each new joiner is in the document process."
      />
      <p className="text-sm text-muted-foreground">Active joiners</p>
      <div className="mt-1 text-[2.5rem] leading-none font-light tracking-[-0.04em] tabular-nums">
        {loading ? <Skeleton className="h-10 w-16" /> : total}
      </div>
      {loading ? (
        <div className="mt-4 space-y-2">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
        </div>
      ) : total === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No joiners are active right now.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2 text-sm text-pretty text-muted-foreground">
          {counts
            .filter((item) => item.value > 0)
            .map((item) => (
              <li key={item.stage}>{item.sentence(item.value)}</li>
            ))}
        </ul>
      )}
    </section>
  );
}

function teamQuery(team: ClearanceTeam) {
  return exitListQuery({ pending_team: team, status: 'open', limit: 1, offset: 0 });
}

export function ClearancePanel() {
  const open = useQuery(exitListQuery({ status: 'open', limit: 1, offset: 0 }));
  const it = useQuery(teamQuery(TEAMS[0]));
  const finance = useQuery(teamQuery(TEAMS[1]));
  const admin = useQuery(teamQuery(TEAMS[2]));
  const manager = useQuery(teamQuery(TEAMS[3]));
  const teams = [it, finance, admin, manager];
  const loading = open.isPending || teams.some((query) => query.isPending);
  const openTotal = open.data?.total ?? 0;

  return (
    <section aria-labelledby="clearance-title" className="flex min-w-0 flex-col panel p-5 sm:p-6">
      <SectionHeading
        id="clearance-title"
        title="Exit clearances"
        subtitle="Which team still needs to clear each exit."
        to="/#exits"
      />
      <p className="text-sm text-muted-foreground">Open exits</p>
      <div className="mt-1 text-[2.5rem] leading-none font-light tracking-[-0.04em] tabular-nums">
        {loading ? <Skeleton className="h-10 w-16" /> : openTotal}
      </div>
      {loading ? (
        <div className="mt-4 space-y-2">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
        </div>
      ) : openTotal === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No exits are waiting on a team right now.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2 text-sm text-pretty text-muted-foreground">
          {TEAMS.map((team, index) => {
            const count = teams[index].data?.total ?? 0;
            if (count === 0) return null;
            return (
              <li key={team}>
                {TEAM_LABELS[team] ?? team} still needs to clear {count} {plural(count, 'exit', 'exits')}.
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
