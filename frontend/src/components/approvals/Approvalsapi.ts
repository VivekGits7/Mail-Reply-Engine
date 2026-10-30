import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import axiosInstance from '@/redux/axios';
import type {
  ApprovalDetailResponse,
  ApprovalDraft,
  ApprovalListResponse,
  ApprovalStatus,
  ApprovalType,
  ApproveResponse,
  PageParams,
  RejectResponse,
  SortOrder,
} from '@/types';

export interface ApprovalListParams extends PageParams {
  status?: ApprovalStatus;
  approval_type?: ApprovalType;
  case_id?: string;
  sort_order?: SortOrder;
}

export const approvalsApi = {
  list: async (params: ApprovalListParams) =>
    (await axiosInstance.get<ApprovalListResponse>('/api/approvals', { params })).data,
  detail: async (approvalId: string) =>
    (await axiosInstance.get<ApprovalDetailResponse>(`/api/approvals/${approvalId}`)).data.data,
  saveDraft: async (approvalId: string, draft: ApprovalDraft) =>
    (await axiosInstance.patch<ApprovalDetailResponse>(`/api/approvals/${approvalId}`, { draft })).data,
  approve: async (approvalId: string, draft?: ApprovalDraft) =>
    (
      await axiosInstance.post<ApproveResponse>(`/api/approvals/${approvalId}/approve`, {
        draft: draft ?? null,
      })
    ).data,
  reject: async (approvalId: string, reason: string) =>
    (await axiosInstance.post<RejectResponse>(`/api/approvals/${approvalId}/reject`, { reason })).data,
};

export const approvalKeys = {
  all: ['approvals'] as const,
  list: (params: ApprovalListParams) => [...approvalKeys.all, 'list', params] as const,
  detail: (approvalId: string) => [...approvalKeys.all, 'detail', approvalId] as const,
};

export const approvalListQuery = (params: ApprovalListParams) =>
  queryOptions({
    queryKey: approvalKeys.list(params),
    queryFn: () => approvalsApi.list(params),
    placeholderData: keepPreviousData,
  });

export const approvalDetailQuery = (approvalId: string) =>
  queryOptions({ queryKey: approvalKeys.detail(approvalId), queryFn: () => approvalsApi.detail(approvalId) });
