import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import axiosInstance from '@/redux/axios';
import type {
  ActionLogListResponse,
  ActorType,
  AttachmentResponse,
  ChecklistGroupResponse,
  ChecklistListResponse,
  CreateHolidayRequest,
  CreateTemplateRequest,
  DryRunRequest,
  DryRunResponse,
  FailureKind,
  FailureListResponse,
  FileAttachment,
  HireCategory,
  HolidayListResponse,
  HolidayResponse,
  InductionTemplateResponse,
  InductionTrack,
  KillSwitchRequest,
  KillSwitchResponse,
  PageParams,
  PreviewResponse,
  PutChecklistRequest,
  PutInductionTemplateRequest,
  RetryResponse,
  SettingsListResponse,
  SortOrder,
  StatusResponse,
  TemplateListResponse,
  TemplateResponse,
  UpdateTemplateRequest,
} from '@/types';

export interface ActionLogParams extends PageParams {
  case_id?: string;
  actor_type?: ActorType;
  action?: string;
  date_from?: string;
  date_to?: string;
  sort_order?: SortOrder;
}

export interface FailureParams extends PageParams {
  kind?: FailureKind;
  event_type?: string;
}

export const adminApi = {
  status: async () => (await axiosInstance.get<StatusResponse>('/api/admin/status')).data.data,
  killSwitch: async (payload: KillSwitchRequest) =>
    (await axiosInstance.post<KillSwitchResponse>('/api/admin/kill-switch', payload)).data,
  dryRun: async (payload: DryRunRequest) =>
    (await axiosInstance.post<DryRunResponse>('/api/admin/dry-run', payload)).data,
  settings: async () => (await axiosInstance.get<SettingsListResponse>('/api/settings')).data.data,
  updateSettings: async (changes: Record<string, unknown>) =>
    (await axiosInstance.patch<SettingsListResponse>('/api/settings', changes)).data,
  checklists: async (params: { hire_category?: HireCategory; location?: string } = {}) =>
    (await axiosInstance.get<ChecklistListResponse>('/api/checklist-templates', { params })).data.data,
  putChecklist: async (payload: PutChecklistRequest) =>
    (await axiosInstance.put<ChecklistGroupResponse>('/api/checklist-templates', payload)).data,
  inductionTemplate: async (track: InductionTrack) =>
    (await axiosInstance.get<InductionTemplateResponse>(`/api/induction-templates/${track}`)).data.data,
  putInductionTemplate: async (track: InductionTrack, payload: PutInductionTemplateRequest) =>
    (await axiosInstance.put<InductionTemplateResponse>(`/api/induction-templates/${track}`, payload)).data,
  holidays: async (params: { year?: number; location?: string }) =>
    (await axiosInstance.get<HolidayListResponse>('/api/holidays', { params })).data.data,
  createHoliday: async (payload: CreateHolidayRequest) =>
    (await axiosInstance.post<HolidayResponse>('/api/holidays', payload)).data,
  deleteHoliday: async (holidayId: string) => {
    await axiosInstance.delete(`/api/holidays/${holidayId}`);
  },
  actionLog: async (params: ActionLogParams) =>
    (await axiosInstance.get<ActionLogListResponse>('/api/action-log', { params })).data,
  failures: async (params: FailureParams) =>
    (await axiosInstance.get<FailureListResponse>('/api/admin/failures', { params })).data,
  retryFailure: async (failureId: string, kind: FailureKind) =>
    (await axiosInstance.post<RetryResponse>(`/api/admin/failures/${failureId}/retry`, { kind })).data,
  uploadStatement: async (file: FileAttachment) =>
    (await axiosInstance.post<AttachmentResponse>('/api/admin/statement-of-understanding', file)).data,
  templates: async (params: { search?: string; is_active?: boolean } = {}) =>
    (await axiosInstance.get<TemplateListResponse>('/api/templates', { params })).data.data,
  template: async (templateKey: string) =>
    (await axiosInstance.get<TemplateResponse>(`/api/templates/${templateKey}`)).data.data,
  updateTemplate: async (templateKey: string, payload: UpdateTemplateRequest) =>
    (await axiosInstance.patch<TemplateResponse>(`/api/templates/${templateKey}`, payload)).data,
  previewTemplate: async (templateKey: string, values: Record<string, unknown>) =>
    (await axiosInstance.post<PreviewResponse>(`/api/templates/${templateKey}/preview`, { values })).data
      .data,
  createTemplate: async (payload: CreateTemplateRequest) =>
    (await axiosInstance.post<TemplateResponse>('/api/templates', payload)).data,
};

export const adminKeys = {
  all: ['admin'] as const,
  status: ['admin', 'status'] as const,
  settings: ['admin', 'settings'] as const,
  checklists: ['admin', 'checklists'] as const,
  induction: (track: InductionTrack) => ['admin', 'induction', track] as const,
  holidays: (params: { year?: number; location?: string }) => ['admin', 'holidays', params] as const,
  actionLog: (params: ActionLogParams) => ['admin', 'action-log', params] as const,
  failures: (params: FailureParams) => ['admin', 'failures', params] as const,
  templates: (params: { search?: string; is_active?: boolean }) =>
    ['admin', 'templates', 'list', params] as const,
  template: (templateKey: string) => ['admin', 'templates', 'detail', templateKey] as const,
};

const STATUS_REFRESH_MS = 60_000;

export const statusQuery = () =>
  queryOptions({ queryKey: adminKeys.status, queryFn: adminApi.status, refetchInterval: STATUS_REFRESH_MS });

export const settingsQuery = () => queryOptions({ queryKey: adminKeys.settings, queryFn: adminApi.settings });

export const checklistsQuery = (params: { hire_category?: HireCategory; location?: string } = {}) =>
  queryOptions({ queryKey: [...adminKeys.checklists, params], queryFn: () => adminApi.checklists(params) });

export const inductionTemplateQuery = (track: InductionTrack) =>
  queryOptions({ queryKey: adminKeys.induction(track), queryFn: () => adminApi.inductionTemplate(track) });

export const holidaysQuery = (params: { year?: number; location?: string }) =>
  queryOptions({ queryKey: adminKeys.holidays(params), queryFn: () => adminApi.holidays(params) });

export const actionLogQuery = (params: ActionLogParams) =>
  queryOptions({
    queryKey: adminKeys.actionLog(params),
    queryFn: () => adminApi.actionLog(params),
    placeholderData: keepPreviousData,
  });

export const failuresQuery = (params: FailureParams) =>
  queryOptions({
    queryKey: adminKeys.failures(params),
    queryFn: () => adminApi.failures(params),
    placeholderData: keepPreviousData,
  });

export const templatesQuery = (params: { search?: string; is_active?: boolean } = {}) =>
  queryOptions({ queryKey: adminKeys.templates(params), queryFn: () => adminApi.templates(params) });

export const templateQuery = (templateKey: string) =>
  queryOptions({ queryKey: adminKeys.template(templateKey), queryFn: () => adminApi.template(templateKey) });
