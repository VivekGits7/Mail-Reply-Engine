import { useQuery } from '@tanstack/react-query';
import { CircleCheck, CircleX } from 'lucide-react';
import { Breakdown, MiniStat } from '@/components/visual/Breakdown';
import type { Segment } from '@/components/visual/SegmentedBar';
import { ApprovalStatus, ApprovalType } from '@/types';
import { approvalListQuery } from './Approvalsapi';

interface ApprovalStatsProps {
  status: string;
  approvalType?: string;
  onType: (type: string | undefined) => void;
  onStatus: (status: string | undefined) => void;
}

export function ApprovalStats({ status, approvalType, onType, onStatus }: ApprovalStatsProps) {
  const replies = useQuery(
    approvalListQuery({
      status: ApprovalStatus.PENDING,
      approval_type: ApprovalType.REPLY,
      limit: 1,
      offset: 0,
    }),
  );
  const plans = useQuery(
    approvalListQuery({
      status: ApprovalStatus.PENDING,
      approval_type: ApprovalType.INDUCTION_SCHEDULE,
      limit: 1,
      offset: 0,
    }),
  );
  const approved = useQuery(approvalListQuery({ status: ApprovalStatus.APPROVED, limit: 1, offset: 0 }));
  const rejected = useQuery(approvalListQuery({ status: ApprovalStatus.REJECTED, limit: 1, offset: 0 }));

  const segments: Segment[] = [
    { key: ApprovalType.REPLY, label: 'Reply drafts', tone: 'iris', value: replies.data?.total ?? 0 },
    {
      key: ApprovalType.INDUCTION_SCHEDULE,
      label: 'Induction plans',
      tone: 'azure',
      value: plans.data?.total ?? 0,
    },
  ];

  return (
    <Breakdown
      title="Waiting by type"
      totalLabel="Waiting for a decision"
      loading={replies.isPending || plans.isPending}
      segments={segments}
      active={status === ApprovalStatus.PENDING ? approvalType : undefined}
      onSelect={(type) => {
        onStatus(undefined);
        onType(type);
      }}
      aside={
        <>
          <MiniStat
            label="Approved"
            icon={CircleCheck}
            tone="mint"
            value={approved.data?.total}
            loading={approved.isPending}
            active={status === ApprovalStatus.APPROVED}
            onClick={() => onStatus(status === ApprovalStatus.APPROVED ? undefined : ApprovalStatus.APPROVED)}
          />
          <MiniStat
            label="Rejected"
            icon={CircleX}
            tone="ember"
            value={rejected.data?.total}
            loading={rejected.isPending}
            active={status === ApprovalStatus.REJECTED}
            onClick={() => onStatus(status === ApprovalStatus.REJECTED ? undefined : ApprovalStatus.REJECTED)}
          />
        </>
      }
    />
  );
}
