import { useQuery } from '@tanstack/react-query';
import { selectHasComplaintsAccess, selectIsAdmin } from '@/redux/authSlice';
import { useAppSelector } from '@/redux/hooks';
import { failuresQuery, statusQuery } from '@/components/admin/Adminapi';
import { approvalListQuery } from '@/components/approvals/Approvalsapi';
import { sendingSummary, type SendingSummary } from '@/utils/systemState';
import type { NavItem } from './navItems';

type CountKey = NonNullable<NavItem['count']>;

export function useNavCounts(): Record<CountKey, number | undefined> {
  const approvals = useQuery(approvalListQuery({ status: 'pending', limit: 1, offset: 0 }));
  const failures = useQuery(failuresQuery({ limit: 1, offset: 0 }));
  return { approvals: approvals.data?.total, failures: failures.data?.total };
}

export function useSendingAlert(): SendingSummary | null {
  const { data } = useQuery(statusQuery());
  if (!data) return null;
  const summary = sendingSummary(data);
  return summary.mode === 'live' ? null : summary;
}

export function useAllowedItems() {
  const isAdmin = useAppSelector(selectIsAdmin);
  const hasComplaints = useAppSelector(selectHasComplaintsAccess);
  const allowed = { admin: isAdmin, complaints: hasComplaints };
  return (items: NavItem[]) => items.filter((item) => !item.requires || allowed[item.requires]);
}
