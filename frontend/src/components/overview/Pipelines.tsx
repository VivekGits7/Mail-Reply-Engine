import { useQuery } from '@tanstack/react-query';
import { Info } from 'lucide-react';
import { exitListQuery } from '@/components/exits/Exitsapi';
import { SectionHeading } from '@/components/common/PageHeader';
import { ColumnBars } from '@/components/visual/ColumnBars';
import { SegmentedBar, type Segment } from '@/components/visual/SegmentedBar';
import { Skeleton } from '@/components/ui/skeleton';
import { TEAM_LABELS } from '@/utils/labels';
import { ClearanceTeam, OnboardingStage } from '@/types';
import { stageCountQuery } from './queries';

const STAGES: { stage: OnboardingStage; label: string; tone: Segment['tone'] }[] = [
  { stage: OnboardingStage.DOCS_REQUESTED, label: 'Docs requested', tone: 'azure' },
  { stage: OnboardingStage.DOCS_IN_PROGRESS, label: 'Docs in progress', tone: 'iris' },
  { stage: OnboardingStage.READY_FOR_SIGNOFF, label: 'Ready for sign-off', tone: 'mint' },
  { stage: OnboardingStage.IT_REQUESTED, label: 'IT setup', tone: 'sun' },
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
  const segments: Segment[] = STAGES.map((item, index) => ({
    key: item.stage,
    label: item.label,
    tone: item.tone,
    value: queries[index].data?.total ?? 0,
  }));
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const waitingOnDocs = segments[0].value + segments[1].value;

  return (
    <section aria-labelledby="pipeline-title" className="flex min-w-0 flex-col panel p-5 sm:p-6">
      <SectionHeading id="pipeline-title" title="Onboarding pipeline" />
      <p className="text-sm text-muted-foreground">Active joiners</p>
      <div className="mt-1 mb-5 text-[2.5rem] leading-none font-light tracking-[-0.04em] tabular-nums">
        {loading ? <Skeleton className="h-10 w-16" /> : total}
      </div>
      {loading ? (
        <Skeleton className="h-3 w-full" />
      ) : (
        <SegmentedBar segments={segments} label="Joiners by stage" />
      )}
      {!loading && total > 0 && (
        <div className="mt-auto pt-5">
          <p className="flex items-start gap-2.5 rounded-2xl border border-dashed px-3.5 py-3 text-xs text-pretty text-muted-foreground">
            <Info className="mt-px size-4 shrink-0" aria-hidden="true" />
            <span>
              <span className="font-medium text-foreground">{waitingOnDocs}</span> of {total} are still
              sending documents, <span className="font-medium text-foreground">{segments[2].value}</span> can
              be signed off now.
            </span>
          </p>
        </div>
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
      <SectionHeading id="clearance-title" title="Exit clearances" to="/exits" />
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Open exits</p>
          <div className="mt-1 text-[2.5rem] leading-none font-light tracking-[-0.04em] tabular-nums">
            {loading ? <Skeleton className="h-10 w-16" /> : openTotal}
          </div>
        </div>
        <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <span className="size-2.5 rounded-full bg-ember" />
          Waiting on team
        </span>
      </div>
      {loading ? (
        <Skeleton className="h-40 w-full rounded-2xl" />
      ) : (
        <ColumnBars
          label="Exits waiting on each team"
          height={140}
          groups={TEAMS.map((team, index) => ({
            key: team,
            label: TEAM_LABELS[team] ?? team,
            values: [{ tone: 'ember', value: teams[index].data?.total ?? 0, label: 'waiting' }],
          }))}
        />
      )}
    </section>
  );
}
