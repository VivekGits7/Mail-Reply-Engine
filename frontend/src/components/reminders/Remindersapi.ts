import { keepPreviousData, queryOptions } from '@tanstack/react-query';
// import axiosInstance from '@/redux/axios';
import type {
  CreateRuleRequest,
  DataSource,
  FileAttachment,
  PageParams,
  RuleData,
  RuleResponse,
  RuleSortBy,
  RuleTaskItem,
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

// --- DUMMY DATA (backend disconnected, see dummy.md) ---
const DUMMY_RULES: RuleData[] = [
  {
    reminder_rule_id: 'rule_dummy_001',
    name: 'Demo Reminder Rule',
    rule_key: 'demo_rule',
    data_source: 'upload',
    recipient_field: 'work_email',
    required_columns: ['full_name', 'work_email'],
    template_key: 'welcome_email',
    stages: [{ stage: 'open', recipient_field: 'work_email', template_key: 'welcome_email' }],
    schedule_cron: '0 9 * * *',
    followup_gap_hours: 24,
    max_rounds: 3,
    escalate_to_email: null,
    is_active: true,
    next_run_at: new Date().toISOString(),
    open_tasks: 1,
  },
];

const DUMMY_RULE_TASKS: RuleTaskItem[] = [
  {
    task_id: 'rule_task_dummy_001',
    owner_email: 'demo.joiner@example.com',
    status: 'open',
    followups_sent: 0,
    next_followup_at: new Date().toISOString(),
    details: {},
    paused_until: null,
    completed_at: null,
  },
];

export const remindersApi = {
  // --- Original backend-connected implementation (commented out, see dummy.md) ---
  // rules: async (params: RuleListParams) =>
  //   (await axiosInstance.get<RuleListResponse>('/api/reminder-rules', { params })).data.data,
  // createRule: async (payload: CreateRuleRequest) =>
  //   (await axiosInstance.post<RuleResponse>('/api/reminder-rules', payload)).data,
  // updateRule: async (ruleId: string, payload: UpdateRuleRequest) =>
  //   (await axiosInstance.patch<RuleResponse>(`/api/reminder-rules/${ruleId}`, payload)).data,
  // uploadList: async (ruleId: string, file: FileAttachment) =>
  //   (await axiosInstance.post<UploadListResponse>(`/api/reminder-rules/${ruleId}/uploads`, { file })).data,
  // tasks: async (ruleId: string, params: RuleTaskParams) =>
  //   (await axiosInstance.get<RuleTaskListResponse>(`/api/reminder-rules/${ruleId}/tasks`, { params })).data,

  // --- DUMMY implementation ---
  rules: async (_params: RuleListParams): Promise<RuleData[]> => DUMMY_RULES,
  createRule: async (payload: CreateRuleRequest): Promise<RuleResponse> => ({
    success: true,
    message: 'Dummy rule created (backend disconnected)',
    data: {
      reminder_rule_id: `rule_dummy_${Date.now()}`,
      name: payload.name,
      rule_key: payload.rule_key,
      data_source: payload.data_source ?? 'upload',
      recipient_field: payload.recipient_field,
      required_columns: payload.required_columns,
      template_key: payload.template_key,
      stages: payload.stages ?? [],
      schedule_cron: payload.schedule_cron,
      followup_gap_hours: payload.followup_gap_hours ?? 24,
      max_rounds: payload.max_rounds ?? 3,
      escalate_to_email: payload.escalate_to_email ?? null,
      is_active: payload.is_active ?? true,
      next_run_at: null,
      open_tasks: 0,
    },
  }),
  updateRule: async (ruleId: string, payload: UpdateRuleRequest): Promise<RuleResponse> => ({
    success: true,
    message: 'Dummy rule updated (backend disconnected)',
    data: {
      ...DUMMY_RULES[0],
      reminder_rule_id: ruleId,
      name: payload.name ?? DUMMY_RULES[0].name,
      recipient_field: payload.recipient_field ?? DUMMY_RULES[0].recipient_field,
      required_columns: payload.required_columns ?? DUMMY_RULES[0].required_columns,
      template_key: payload.template_key ?? DUMMY_RULES[0].template_key,
      stages: payload.stages ?? DUMMY_RULES[0].stages,
      schedule_cron: payload.schedule_cron ?? DUMMY_RULES[0].schedule_cron,
      followup_gap_hours: payload.followup_gap_hours ?? DUMMY_RULES[0].followup_gap_hours,
      max_rounds: payload.max_rounds ?? DUMMY_RULES[0].max_rounds,
      escalate_to_email: payload.escalate_to_email ?? DUMMY_RULES[0].escalate_to_email,
      is_active: payload.is_active ?? DUMMY_RULES[0].is_active,
    },
  }),
  uploadList: async (_ruleId: string, _file: FileAttachment): Promise<UploadListResponse> => ({
    success: true,
    message: 'Dummy list uploaded (backend disconnected)',
    data: { rows_total: 1, rows_valid: 1, rows_invalid: [], tasks_created: 1, tasks_closed: 0, tasks_reopened: 0 },
  }),
  tasks: async (_ruleId: string, _params: RuleTaskParams): Promise<RuleTaskListResponse> => ({
    success: true,
    message: 'Dummy rule tasks (backend disconnected)',
    total: DUMMY_RULE_TASKS.length,
    limit: 20,
    offset: 0,
    data: DUMMY_RULE_TASKS,
  }),
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
