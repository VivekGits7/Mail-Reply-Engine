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
    name: 'Leave approval reminder',
    rule_key: 'leave_approval',
    data_source: 'upload',
    recipient_field: 'manager_email',
    required_columns: ['full_name', 'manager_email'],
    template_key: 'leave_approval',
    stages: [{ stage: 'open', recipient_field: 'manager_email', template_key: 'leave_approval' }],
    schedule_cron: '0 9 * * *',
    followup_gap_hours: 48,
    max_rounds: 3,
    escalate_to_email: null,
    is_active: true,
    next_run_at: new Date().toISOString(),
    open_tasks: 1,
  },
  {
    reminder_rule_id: 'rule_sample_appraisal',
    name: 'Appraisal feedback reminder',
    rule_key: 'appraisal_feedback',
    data_source: 'upload',
    recipient_field: 'manager_email',
    required_columns: ['full_name', 'manager_email'],
    template_key: 'appraisal_feedback',
    stages: [
      { stage: 'manager', recipient_field: 'manager_email', template_key: 'appraisal_feedback' },
      { stage: 'reviewer', recipient_field: 'reviewer_email', template_key: 'appraisal_review' },
      { stage: 'employee', recipient_field: 'work_email', template_key: 'appraisal_signoff' },
    ],
    schedule_cron: '0 9 * * *',
    followup_gap_hours: 72,
    max_rounds: 3,
    escalate_to_email: 'performance@tcgdigital.com',
    is_active: true,
    next_run_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    open_tasks: 2,
  },
  {
    reminder_rule_id: 'rule_sample_timesheet',
    name: 'Work hours reminder',
    rule_key: 'timesheet_pending',
    data_source: 'upload',
    recipient_field: 'work_email',
    required_columns: ['full_name', 'work_email'],
    template_key: 'timesheet_pending',
    stages: [{ stage: 'open', recipient_field: 'work_email', template_key: 'timesheet_pending' }],
    schedule_cron: '0 9 * * *',
    followup_gap_hours: 48,
    max_rounds: 3,
    escalate_to_email: null,
    is_active: false,
    next_run_at: null,
    open_tasks: 0,
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
  {
    task_id: 'rule_task_sample_partial',
    owner_email: 'sample.partial@tcgdigital.com',
    status: 'partial',
    followups_sent: 1,
    next_followup_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    details: {},
    paused_until: null,
    completed_at: null,
  },
  {
    task_id: 'rule_task_sample_done',
    owner_email: 'sample.done@tcgdigital.com',
    status: 'done',
    followups_sent: 1,
    next_followup_at: null,
    details: {},
    paused_until: null,
    completed_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    task_id: 'rule_task_sample_blocked',
    owner_email: 'sample.blocked@tcgdigital.com',
    status: 'blocked',
    followups_sent: 2,
    next_followup_at: null,
    details: {},
    paused_until: null,
    completed_at: null,
  },
  {
    task_id: 'rule_task_sample_not_applicable',
    owner_email: 'sample.na@tcgdigital.com',
    status: 'not_applicable',
    followups_sent: 0,
    next_followup_at: null,
    details: {},
    paused_until: null,
    completed_at: null,
  },
  {
    task_id: 'rule_task_sample_escalated',
    owner_email: 'sample.escalated@tcgdigital.com',
    status: 'escalated',
    followups_sent: 3,
    next_followup_at: null,
    details: {},
    paused_until: null,
    completed_at: null,
  },
  {
    task_id: 'rule_task_sample_paused',
    owner_email: 'sample.paused@tcgdigital.com',
    status: 'paused',
    followups_sent: 1,
    next_followup_at: null,
    details: {},
    paused_until: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    completed_at: null,
  },
  {
    task_id: 'rule_task_sample_cancelled',
    owner_email: 'sample.cancelled@tcgdigital.com',
    status: 'cancelled',
    followups_sent: 0,
    next_followup_at: null,
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
  rules: async (params: RuleListParams): Promise<RuleData[]> => {
    const search = params.search?.trim().toLowerCase();
    const filtered = DUMMY_RULES.filter(
      (rule) =>
        (!search || rule.name.toLowerCase().includes(search)) &&
        (params.is_active === undefined || rule.is_active === params.is_active) &&
        (!params.data_source || rule.data_source === params.data_source),
    );
    return [...filtered].sort((a, b) => {
      if (params.sort_by === 'created_at') {
        const diff = new Date(a.next_run_at ?? 0).getTime() - new Date(b.next_run_at ?? 0).getTime();
        return params.sort_order === 'latest' ? -diff : diff;
      }
      const diff = a.name.localeCompare(b.name);
      return params.sort_order === 'z_to_a' ? -diff : diff;
    });
  },
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
  tasks: async (_ruleId: string, params: RuleTaskParams): Promise<RuleTaskListResponse> => {
    const search = params.search?.trim().toLowerCase();
    const filtered = DUMMY_RULE_TASKS.filter(
      (task) =>
        (!search || task.owner_email?.toLowerCase().includes(search)) &&
        (!params.status || task.status === params.status),
    );
    const sorted = [...filtered].sort((a, b) => {
      const diff =
        new Date(a.next_followup_at ?? 0).getTime() - new Date(b.next_followup_at ?? 0).getTime();
      return params.sort_order === 'latest' ? -diff : diff;
    });
    const limit = params.limit ?? 20;
    const offset = params.offset ?? 0;
    return {
      success: true,
      message: 'Dummy rule tasks (backend disconnected)',
      total: sorted.length,
      limit,
      offset,
      data: sorted.slice(offset, offset + limit),
    };
  },
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
