import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import axiosInstance from '@/redux/axios';
import type {
  CreateReportRequest,
  CreateReportResponse,
  DownloadUrlResponse,
  FileAttachment,
  HireCategory,
  PageParams,
  ReportListResponse,
  ReportStatus,
  SortOrder,
  SurveyListResponse,
  SurveySortBy,
  SurveyStatus,
  UploadResponsesResponse,
} from '@/types';

export interface SurveyListParams extends PageParams {
  search?: string;
  milestone?: number;
  status?: SurveyStatus;
  flagged?: boolean;
  form_variant?: HireCategory;
  sort_by?: SurveySortBy;
  sort_order?: SortOrder;
}

export interface ReportListParams {
  status?: ReportStatus;
  sort_order?: SortOrder;
}

export const feedbackApi = {
  surveys: async (params: SurveyListParams) =>
    (await axiosInstance.get<SurveyListResponse>('/api/feedback/surveys', { params })).data,
  uploadResponses: async (formVariant: HireCategory, file: FileAttachment) =>
    (
      await axiosInstance.post<UploadResponsesResponse>('/api/feedback/responses/upload', {
        form_variant: formVariant,
        file,
      })
    ).data,
  reports: async (params: ReportListParams) =>
    (await axiosInstance.get<ReportListResponse>('/api/feedback/reports', { params })).data.data,
  createReport: async (payload: CreateReportRequest) =>
    (await axiosInstance.post<CreateReportResponse>('/api/feedback/reports', payload)).data,
  reportUrl: async (reportId: string) =>
    (await axiosInstance.get<DownloadUrlResponse>(`/api/feedback/reports/${reportId}/download-url`)).data.data,
};

export const feedbackKeys = {
  all: ['feedback'] as const,
  surveys: (params: SurveyListParams) => [...feedbackKeys.all, 'surveys', params] as const,
  reports: (params: ReportListParams) => [...feedbackKeys.all, 'reports', params] as const,
};

const QUEUED_REPORT_REFRESH_MS = 5_000;

export const surveyListQuery = (params: SurveyListParams) =>
  queryOptions({
    queryKey: feedbackKeys.surveys(params),
    queryFn: () => feedbackApi.surveys(params),
    placeholderData: keepPreviousData,
  });

export const reportListQuery = (params: ReportListParams = {}) =>
  queryOptions({
    queryKey: feedbackKeys.reports(params),
    queryFn: () => feedbackApi.reports(params),
    refetchInterval: (query) =>
      query.state.data?.some((report) => report.status === 'queued') ? QUEUED_REPORT_REFRESH_MS : false,
  });
