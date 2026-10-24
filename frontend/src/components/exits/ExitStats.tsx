import { useQuery } from '@tanstack/react-query';
import { CalendarClock, Hourglass } from 'lucide-react';
import { Breakdown, MiniStat } from '@/components/visual/Breakdown';
import type { Segment } from '@/components/visual/SegmentedBar';
import { useToday } from '@/hooks/useToday';
import { dayKey } from '@/utils/utility';
import { ExitStage, type ExitStage as Stage } from '@/types';
import { exitListQuery } from './Exitsapi';

const WEEK_DAYS = 7;
const PAST_START = '2000-01-01';

const stageCountQuery = (stage: Stage) => exitListQuery({ stage, status: 'open', limit: 1, offset: 0 });

interface ExitStatsProps {
  stage?: string;
  lwdFrom?: string;
  lwdTo?: string;
  onStage: (stage: string | undefined) => void;
  onRange: (range: { from: string; to: string } | undefined) => void;
}

export function ExitStats({ stage, lwdFrom, lwdTo, onStage, onRange }: ExitStatsProps) {
  const today = useToday();
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + WEEK_DAYS);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const week = { from: dayKey(today), to: dayKey(weekEnd) };
  const past = { from: PAST_START, to: dayKey(yesterday) };

  const requested = useQuery(stageCountQuery(ExitStage.CLEARANCE_REQUESTED));
  const progress = useQuery(stageCountQuery(ExitStage.CLEARANCES_IN_PROGRESS));
  const cleared = useQuery(stageCountQuery(ExitStage.ALL_CLEARED));
  const thisWeek = useQuery(
    exitListQuery({ lwd_from: week.from, lwd_to: week.to, status: 'open', limit: 1, offset: 0 }),
  );
  const overdue = useQuery(
    exitListQuery({ lwd_from: past.from, lwd_to: past.to, status: 'open', limit: 1, offset: 0 }),
  );

  const segments: Segment[] = [
    {
      key: ExitStage.CLEARANCE_REQUESTED,
      label: 'Clearance requested',
      tone: 'azure',
      value: requested.data?.total ?? 0,
    },
    {
      key: ExitStage.CLEARANCES_IN_PROGRESS,
      label: 'In progress',
      tone: 'ember',
      value: progress.data?.total ?? 0,
    },
    { key: ExitStage.ALL_CLEARED, label: 'Ready for release', tone: 'mint', value: cleared.data?.total ?? 0 },
  ];
  const weekActive = lwdFrom === week.from && lwdTo === week.to;
  const pastActive = lwdFrom === past.from && lwdTo === past.to;

  return (
    <Breakdown
      title="Exits by stage"
      totalLabel="Open exits"
      loading={[requested, progress, cleared].some((query) => query.isPending)}
      segments={segments}
      active={stage}
      onSelect={onStage}
      aside={
        <>
          <MiniStat
            label="Leaving this week"
            icon={CalendarClock}
            tone="ember"
            value={thisWeek.data?.total}
            loading={thisWeek.isPending}
            active={weekActive}
            onClick={() => onRange(weekActive ? undefined : week)}
          />
          <MiniStat
            label="Past last day, still open"
            icon={Hourglass}
            tone="sun"
            value={overdue.data?.total}
            loading={overdue.isPending}
            active={pastActive}
            onClick={() => onRange(pastActive ? undefined : past)}
          />
        </>
      }
    />
  );
}
