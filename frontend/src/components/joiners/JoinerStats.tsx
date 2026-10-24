import { useQuery } from '@tanstack/react-query';
import { CalendarClock, TriangleAlert } from 'lucide-react';
import { Breakdown, MiniStat } from '@/components/visual/Breakdown';
import type { Segment } from '@/components/visual/SegmentedBar';
import { useToday } from '@/hooks/useToday';
import { dayKey } from '@/utils/utility';
import { CaseFlag, OnboardingStage, type OnboardingStage as Stage } from '@/types';
import { joinerListQuery } from './Joinersapi';

const WEEK_DAYS = 7;

const stageCountQuery = (stage: Stage) => joinerListQuery({ stage, status: 'open', limit: 1, offset: 0 });

interface JoinerStatsProps {
  stage?: string;
  flag?: string;
  joiningFrom?: string;
  onStage: (stage: string | undefined) => void;
  onAtRisk: (active: boolean) => void;
  onThisWeek: (range: { from: string; to: string } | undefined) => void;
}

export function JoinerStats({ stage, flag, joiningFrom, onStage, onAtRisk, onThisWeek }: JoinerStatsProps) {
  const today = useToday();
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + WEEK_DAYS);
  const range = { from: dayKey(today), to: dayKey(weekEnd) };

  const requested = useQuery(stageCountQuery(OnboardingStage.DOCS_REQUESTED));
  const progress = useQuery(stageCountQuery(OnboardingStage.DOCS_IN_PROGRESS));
  const ready = useQuery(stageCountQuery(OnboardingStage.READY_FOR_SIGNOFF));
  const it = useQuery(stageCountQuery(OnboardingStage.IT_REQUESTED));
  const thisWeek = useQuery(
    joinerListQuery({ joining_from: range.from, joining_to: range.to, status: 'open', limit: 1, offset: 0 }),
  );
  const atRisk = useQuery(
    joinerListQuery({ flag: CaseFlag.DROPOUT_RISK, status: 'open', limit: 1, offset: 0 }),
  );

  const stages = [requested, progress, ready, it];
  const segments: Segment[] = [
    {
      key: OnboardingStage.DOCS_REQUESTED,
      label: 'Docs requested',
      tone: 'azure',
      value: requested.data?.total ?? 0,
    },
    {
      key: OnboardingStage.DOCS_IN_PROGRESS,
      label: 'Docs in progress',
      tone: 'iris',
      value: progress.data?.total ?? 0,
    },
    {
      key: OnboardingStage.READY_FOR_SIGNOFF,
      label: 'Ready for sign-off',
      tone: 'mint',
      value: ready.data?.total ?? 0,
    },
    { key: OnboardingStage.IT_REQUESTED, label: 'IT setup', tone: 'sun', value: it.data?.total ?? 0 },
  ];
  const weekActive = joiningFrom === range.from;

  return (
    <Breakdown
      title="Joiners by stage"
      totalLabel="Active joiners"
      loading={stages.some((query) => query.isPending)}
      segments={segments}
      active={stage}
      onSelect={onStage}
      aside={
        <>
          <MiniStat
            label="Joining this week"
            icon={CalendarClock}
            tone="azure"
            value={thisWeek.data?.total}
            loading={thisWeek.isPending}
            active={weekActive}
            onClick={() => onThisWeek(weekActive ? undefined : range)}
          />
          <MiniStat
            label="At risk of dropping out"
            icon={TriangleAlert}
            tone="ember"
            value={atRisk.data?.total}
            loading={atRisk.isPending}
            active={flag === CaseFlag.DROPOUT_RISK}
            onClick={() => onAtRisk(flag !== CaseFlag.DROPOUT_RISK)}
          />
        </>
      }
    />
  );
}
