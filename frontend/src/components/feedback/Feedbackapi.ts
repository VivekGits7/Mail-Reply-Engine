import { keepPreviousData, queryOptions } from '@tanstack/react-query';
// import axiosInstance from '@/redux/axios';
import type {
  CreateReportRequest,
  CreateReportResponse,
  DownloadUrlResponse,
  FileAttachment,
  HireCategory,
  PageParams,
  ReportItem,
  ReportStatus,
  SortOrder,
  SurveyItem,
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

// --- DUMMY DATA (backend disconnected, see dummy.md) ---
const DUMMY_SURVEYS: SurveyItem[] = [
  {
    survey_response_id: 'survey_dummy_001',
    person_id: 'person_dummy_001',
    full_name: 'Demo Joiner',
    milestone: 30,
    form_variant: 'lateral',
    status: 'sent',
    sent_at: new Date().toISOString(),
    reminders_sent: 0,
    responded_at: null,
    score: null,
    flagged: false,
  },
  {
    survey_response_id: 'survey_sample_responded',
    person_id: 'person_sample_responded',
    full_name: 'Sample Joiner',
    milestone: 60,
    form_variant: 'campus',
    status: 'responded',
    sent_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    reminders_sent: 1,
    responded_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    score: 4,
    flagged: false,
  },
  {
    survey_response_id: 'survey_sample_flagged',
    person_id: 'person_sample_flagged',
    full_name: 'Sample Candidate',
    milestone: 90,
    form_variant: 'lateral',
    status: 'responded',
    sent_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    reminders_sent: 2,
    responded_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    score: 2,
    flagged: true,
  },
  {
    survey_response_id: 'survey_sample_no_response',
    person_id: 'person_sample_no_response',
    full_name: 'Sample Employee',
    milestone: 30,
    form_variant: 'campus',
    status: 'no_response',
    sent_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    reminders_sent: 2,
    responded_at: null,
    score: null,
    flagged: false,
  },
];

const DUMMY_REPORTS: ReportItem[] = [
  {
    feedback_report_id: 'report_dummy_001',
    period_start: new Date().toISOString(),
    period_end: new Date().toISOString(),
    response_count: 1,
    status: 'ready',
    sent_at: null,
  },
];

export const feedbackApi = {
  // --- Original backend-connected implementation (commented out, see dummy.md) ---
  // surveys: async (params: SurveyListParams) =>
  //   (await axiosInstance.get<SurveyListResponse>('/api/feedback/surveys', { params })).data,
  // uploadResponses: async (formVariant: HireCategory, file: FileAttachment) =>
  //   (
  //     await axiosInstance.post<UploadResponsesResponse>('/api/feedback/responses/upload', {
  //       form_variant: formVariant,
  //       file,
  //     })
  //   ).data,
  // reports: async (params: ReportListParams) =>
  //   (await axiosInstance.get<ReportListResponse>('/api/feedback/reports', { params })).data.data,
  // createReport: async (payload: CreateReportRequest) =>
  //   (await axiosInstance.post<CreateReportResponse>('/api/feedback/reports', payload)).data,
  // reportUrl: async (reportId: string) =>
  //   (await axiosInstance.get<DownloadUrlResponse>(`/api/feedback/reports/${reportId}/download-url`)).data.data,

  // --- DUMMY implementation ---
  surveys: async (params: SurveyListParams): Promise<SurveyListResponse> => {
    const search = params.search?.trim().toLowerCase();
    const filtered = DUMMY_SURVEYS.filter(
      (item) =>
        (!search || item.full_name.toLowerCase().includes(search)) &&
        (!params.status || item.status === params.status) &&
        (!params.milestone || item.milestone === params.milestone) &&
        (!params.flagged || item.flagged) &&
        (!params.form_variant || item.form_variant === params.form_variant),
    );
    const sorted = [...filtered].sort((a, b) => {
      if (params.sort_by === 'full_name') {
        const diff = a.full_name.localeCompare(b.full_name);
        return params.sort_order === 'z_to_a' ? -diff : diff;
      }
      if (params.sort_by === 'score') {
        const diff = (a.score ?? 0) - (b.score ?? 0);
        return params.sort_order === 'z_to_a' ? -diff : diff;
      }
      const diff = new Date(a.sent_at ?? 0).getTime() - new Date(b.sent_at ?? 0).getTime();
      return params.sort_order === 'latest' ? -diff : diff;
    });
    const limit = params.limit ?? 20;
    const offset = params.offset ?? 0;
    return {
      success: true,
      message: 'Dummy surveys list (backend disconnected)',
      total: sorted.length,
      limit,
      offset,
      data: sorted.slice(offset, offset + limit),
    };
  },
  uploadResponses: async (
    _formVariant: HireCategory,
    _file: FileAttachment,
  ): Promise<UploadResponsesResponse> => ({
    success: true,
    message: 'Dummy responses uploaded (backend disconnected)',
    data: { rows_total: 1, rows_matched: 1, rows_unmatched: 0, low_score_alerts: 0 },
  }),
  reports: async (params: ReportListParams): Promise<ReportItem[]> => {
    const filtered = DUMMY_REPORTS.filter((report) => !params.status || report.status === params.status);
    return [...filtered].sort((a, b) => {
      const diff = new Date(a.period_start ?? 0).getTime() - new Date(b.period_start ?? 0).getTime();
      return params.sort_order === 'oldest' ? diff : -diff;
    });
  },
  createReport: async (_payload: CreateReportRequest): Promise<CreateReportResponse> => ({
    success: true,
    message: 'Dummy report queued (backend disconnected)',
    data: { feedback_report_id: `report_dummy_${Date.now()}`, status: 'queued' },
  }),
  reportUrl: async (_reportId: string): Promise<DownloadUrlResponse['data']> => ({
    url: 'https://example.com/dummy-report.xlsx',
    expires_in: 3600,
  }),
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
