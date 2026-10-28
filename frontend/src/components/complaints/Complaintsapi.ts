import { keepPreviousData, queryOptions } from '@tanstack/react-query';
// import axiosInstance from '@/redux/axios';
import type {
  ComplaintDetail,
  ComplaintListItem,
  ComplaintListResponse,
  ComplaintSource,
  DownloadUrlResponse,
  PageParams,
  SortOrder,
  UploadTranscriptRequest,
  UploadTranscriptResponse,
} from '@/types';

export interface ComplaintListParams extends PageParams {
  search?: string;
  source?: ComplaintSource;
  date_from?: string;
  date_to?: string;
  sort_order?: SortOrder;
}

// --- DUMMY DATA (backend disconnected, see dummy.md) ---
const DUMMY_COMPLAINTS: ComplaintListItem[] = [
  {
    complaint_id: 'complaint_dummy_001',
    received_at: new Date().toISOString(),
    source: 'email',
    sender_email: 'demo.sender@example.com',
    person_name: 'Demo Employee',
    subject: 'Dummy complaint (backend disconnected)',
  },
];

const DUMMY_COMPLAINT_DETAIL: ComplaintDetail = {
  complaint_id: 'complaint_dummy_001',
  received_at: new Date().toISOString(),
  source: 'email',
  sender_email: 'demo.sender@example.com',
  person: { person_id: 'person_dummy_001', full_name: 'Demo Employee', employee_code: 'EMP001' },
  subject: 'Dummy complaint (backend disconnected)',
  content: 'This is dummy complaint content shown because the backend is disconnected.',
  attachment: null,
};

export const complaintsApi = {
  // --- Original backend-connected implementation (commented out, see dummy.md) ---
  // list: async (params: ComplaintListParams) =>
  //   (await axiosInstance.get<ComplaintListResponse>('/api/complaints', { params })).data,
  // detail: async (complaintId: string) =>
  //   (await axiosInstance.get<ComplaintDetailResponse>(`/api/complaints/${complaintId}`)).data.data,
  // attachmentUrl: async (attachmentId: string) =>
  //   (await axiosInstance.get<DownloadUrlResponse>(`/api/attachments/${attachmentId}/download-url`)).data.data,
  // uploadTranscript: async (payload: UploadTranscriptRequest) =>
  //   (await axiosInstance.post<UploadTranscriptResponse>('/api/complaints/uploads', payload)).data,

  // --- DUMMY implementation ---
  list: async (_params: ComplaintListParams): Promise<ComplaintListResponse> => ({
    success: true,
    message: 'Dummy complaints list (backend disconnected)',
    total: DUMMY_COMPLAINTS.length,
    limit: 20,
    offset: 0,
    data: DUMMY_COMPLAINTS,
  }),
  detail: async (_complaintId: string): Promise<ComplaintDetail> => DUMMY_COMPLAINT_DETAIL,
  attachmentUrl: async (_attachmentId: string): Promise<DownloadUrlResponse['data']> => ({
    url: 'https://example.com/dummy-attachment.pdf',
    expires_in: 3600,
  }),
  uploadTranscript: async (payload: UploadTranscriptRequest): Promise<UploadTranscriptResponse> => ({
    success: true,
    message: 'Dummy transcript uploaded (backend disconnected)',
    data: { complaint_id: `complaint_dummy_${Date.now()}`, source: payload.source, received_at: new Date().toISOString() },
  }),
};

export const complaintKeys = {
  all: ['complaints'] as const,
  list: (params: ComplaintListParams) => [...complaintKeys.all, 'list', params] as const,
  detail: (complaintId: string) => [...complaintKeys.all, 'detail', complaintId] as const,
};

export const complaintListQuery = (params: ComplaintListParams) =>
  queryOptions({
    queryKey: complaintKeys.list(params),
    queryFn: () => complaintsApi.list(params),
    placeholderData: keepPreviousData,
  });

export const complaintDetailQuery = (complaintId: string) =>
  queryOptions({
    queryKey: complaintKeys.detail(complaintId),
    queryFn: () => complaintsApi.detail(complaintId),
    staleTime: 0,
    gcTime: 0,
  });
