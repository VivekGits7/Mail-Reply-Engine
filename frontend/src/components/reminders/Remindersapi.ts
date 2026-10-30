import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import axiosInstance from '@/redux/axios';
import type {
  CreateRuleRequest,
  DataSource,
  FileAttachment,
  PageParams,
  RuleListResponse,
  RuleResponse,
  RuleSortBy,
  RuleTaskListResponse,
  RuleTaskSortBy,
  SortOrder,
  TaskStatus,
  UpdateRuleRequest,
  UploadListResponse,
} from '@/types';

export interface RuleListParams {
  search?: string;
  is_active?: boolean;
  data_source?: DataSource;
  sort_by?: RuleSortBy;
  sort_order?: SortOrder;
}

export interface RuleTaskParams extends PageParams {
  search?: string;
  status?: TaskStatus;
  sort_by?: RuleTaskSortBy;
  sort_order?: SortOrder;
}

export const remindersApi = {
  rules: async (params: RuleListParams) =>
    (await axiosInstance.get<RuleListResponse>('/api/reminder-rules', { params })).data.data,
  createRule: async (payload: CreateRuleRequest) =>
    (await axiosInstance.post<RuleResponse>('/api/reminder-rules', payload)).data,
  updateRule: async (ruleId: string, payload: UpdateRuleRequest) =>
    (await axiosInstance.patch<RuleResponse>(`/api/reminder-rules/${ruleId}`, payload)).data,
  uploadList: async (ruleId: string, file: FileAttachment) =>
    (await axiosInstance.post<UploadListResponse>(`/api/reminder-rules/${ruleId}/uploads`, { file })).data,
  tasks: async (ruleId: string, params: RuleTaskParams) =>
    (await axiosInstance.get<RuleTaskListResponse>(`/api/reminder-rules/${ruleId}/tasks`, { params })).data,
};

export const reminderKeys = {
  all: ['reminders'] as const,
  rules: (params: RuleListParams) => [...reminderKeys.all, 'rules', params] as const,
  tasks: (ruleId: string, params: RuleTaskParams) => [...reminderKeys.all, 'tasks', ruleId, params] as const,
};

export const ruleListQuery = (params: RuleListParams = {}) =>
  queryOptions({ queryKey: reminderKeys.rules(params), queryFn: () => remindersApi.rules(params) });

export const ruleTasksQuery = (ruleId: string, params: RuleTaskParams) =>
  queryOptions({
    queryKey: reminderKeys.tasks(ruleId, params),
    queryFn: () => remindersApi.tasks(ruleId, params),
    placeholderData: keepPreviousData,
  });
