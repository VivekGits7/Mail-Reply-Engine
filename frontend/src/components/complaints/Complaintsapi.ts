import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import axiosInstance from '@/redux/axios';
import type {
  ComplaintDetailResponse,
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

export const complaintsApi = {
  list: async (params: ComplaintListParams) =>
    (await axiosInstance.get<ComplaintListResponse>('/api/complaints', { params })).data,
  detail: async (complaintId: string) =>
    (await axiosInstance.get<ComplaintDetailResponse>(`/api/complaints/${complaintId}`)).data.data,
  attachmentUrl: async (attachmentId: string) =>
    (await axiosInstance.get<DownloadUrlResponse>(`/api/attachments/${attachmentId}/download-url`)).data.data,
  uploadTranscript: async (payload: UploadTranscriptRequest) =>
    (await axiosInstance.post<UploadTranscriptResponse>('/api/complaints/uploads', payload)).data,
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
