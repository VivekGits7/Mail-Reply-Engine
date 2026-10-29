import { keepPreviousData, queryOptions } from '@tanstack/react-query';
// import axiosInstance from '@/redux/axios';
import type {
  ApprovalDetail,
  ApprovalDetailResponse,
  ApprovalDraft,
  ApprovalListItem,
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

// --- DUMMY DATA (backend disconnected, see dummy.md) ---
const DUMMY_APPROVALS: ApprovalListItem[] = [
  {
    approval_id: 'appr_dummy_001',
    approval_type: 'reply',
    case_id: 'case_dummy_001',
    person_name: 'Demo Joiner',
    summary: 'Draft reply awaiting review',
    status: 'pending',
    created_at: new Date().toISOString(),
  },
];

const DUMMY_APPROVAL_DETAIL: ApprovalDetail = {
  approval_id: 'appr_dummy_001',
  approval_type: 'reply',
  case_id: 'case_dummy_001',
  person_name: 'Demo Joiner',
  summary: 'Draft reply awaiting review',
  status: 'pending',
  created_at: new Date().toISOString(),
  source_email: {
    email_id: 'email_dummy_001',
    from: 'demo.joiner@example.com',
    subject: 'Re: Onboarding documents',
    received_at: new Date().toISOString(),
    body: 'Dummy inbound email body (backend disconnected).',
  },
  draft: {
    subject: 'Re: Onboarding documents',
    body: 'Dummy draft reply body (backend disconnected).',
    to: ['demo.joiner@example.com'],
    track: null,
    sessions: null,
    notes: null,
    ai_confidence: 0.9,
  },
  decided_at: null,
  reject_reason: null,
};

export const approvalsApi = {
  // --- Original backend-connected implementation (commented out, see dummy.md) ---
  // list: async (params: ApprovalListParams) =>
  //   (await axiosInstance.get<ApprovalListResponse>('/api/approvals', { params })).data,
  // detail: async (approvalId: string) =>
  //   (await axiosInstance.get<ApprovalDetailResponse>(`/api/approvals/${approvalId}`)).data.data,
  // saveDraft: async (approvalId: string, draft: ApprovalDraft) =>
  //   (await axiosInstance.patch<ApprovalDetailResponse>(`/api/approvals/${approvalId}`, { draft })).data,
  // approve: async (approvalId: string, draft?: ApprovalDraft) =>
  //   (await axiosInstance.post<ApproveResponse>(`/api/approvals/${approvalId}/approve`, { draft: draft ?? null })).data,
  // reject: async (approvalId: string, reason: string) =>
  //   (await axiosInstance.post<RejectResponse>(`/api/approvals/${approvalId}/reject`, { reason })).data,

  // --- DUMMY implementation ---
  list: async (params: ApprovalListParams): Promise<ApprovalListResponse> => {
    const filtered = DUMMY_APPROVALS.filter(
      (item) =>
        (!params.status || item.status === params.status) &&
        (!params.approval_type || item.approval_type === params.approval_type) &&
        (!params.case_id || item.case_id === params.case_id),
    );
    const sorted = [...filtered].sort((a, b) => {
      const diff = new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime();
      return params.sort_order === 'latest' ? -diff : diff;
    });
    const limit = params.limit ?? 20;
    const offset = params.offset ?? 0;
    return {
      success: true,
      message: 'Dummy approvals list (backend disconnected)',
      total: sorted.length,
      limit,
      offset,
      data: sorted.slice(offset, offset + limit),
    };
  },
  detail: async (_approvalId: string): Promise<ApprovalDetail> => DUMMY_APPROVAL_DETAIL,
  saveDraft: async (approvalId: string, draft: ApprovalDraft): Promise<ApprovalDetailResponse> => ({
    success: true,
    message: 'Dummy draft saved (backend disconnected)',
    data: { ...DUMMY_APPROVAL_DETAIL, approval_id: approvalId, draft },
  }),
  approve: async (approvalId: string, _draft?: ApprovalDraft): Promise<ApproveResponse> => ({
    success: true,
    message: 'Dummy approval approved (backend disconnected)',
    data: { approval_id: approvalId, status: 'approved', email_id: 'email_dummy_001', sessions_created: 0 },
  }),
  reject: async (approvalId: string, _reason: string): Promise<RejectResponse> => ({
    success: true,
    message: 'Dummy approval rejected (backend disconnected)',
    data: { approval_id: approvalId, status: 'rejected' },
  }),
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
