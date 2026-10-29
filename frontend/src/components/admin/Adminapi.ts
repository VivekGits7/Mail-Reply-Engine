import { keepPreviousData, queryOptions } from '@tanstack/react-query';
// import axiosInstance from '@/redux/axios';
import type {
  ActionLogItem,
  ActionLogListResponse,
  ActorType,
  AttachmentData,
  AttachmentResponse,
  ChecklistGroup,
  ChecklistGroupResponse,
  CreateHolidayRequest,
  DryRunRequest,
  DryRunResponse,
  FailureItem,
  FailureKind,
  FailureListResponse,
  FileAttachment,
  HireCategory,
  HolidayData,
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
  SettingItem,
  SettingsListResponse,
  SortOrder,
  StatusResponse,
  TemplateResponse,
  TemplateSummary,
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

// --- DUMMY DATA (backend disconnected, see dummy.md) ---
const DUMMY_SETTINGS: SettingItem[] = [
  { key: 'dry_run', value: true, description: 'Hold outbound mail for review', updated_by: 'demo.admin', updated_at: new Date().toISOString() },
  { key: 'kill_switch', value: false, description: 'Pause all automated sending', updated_by: 'demo.admin', updated_at: new Date().toISOString() },
];

const DUMMY_CHECKLIST_GROUP: ChecklistGroup = {
  hire_category: 'lateral',
  location: 'Bengaluru',
  items: [
    { document_type: 'pan_card', is_mandatory: true, check_mode: 'text', sort_order: 1 },
    { document_type: 'aadhaar_card', is_mandatory: true, check_mode: 'text', sort_order: 2 },
    { document_type: 'relieving_letter', is_mandatory: false, check_mode: 'text', sort_order: 3 },
  ],
  updated_at: new Date().toISOString(),
};

const DUMMY_HOLIDAYS: HolidayData[] = [
  { holiday_id: 'hol_dummy_001', holiday_date: '2026-01-26', name: 'Republic Day', location: 'All' },
  { holiday_id: 'hol_dummy_002', holiday_date: '2026-03-20', name: 'Holi', location: 'Bengaluru' },
];

const DUMMY_ACTION_LOG: ActionLogItem[] = [
  {
    action_log_id: 'log_dummy_001',
    occurred_at: new Date().toISOString(),
    actor_type: 'agent',
    actor_name: 'Automation',
    action: 'sent_reminder',
    case_id: 'case_dummy_001',
    entity_type: 'task',
    entity_id: 'task_dummy_001',
    details: { channel: 'email' },
  },
  {
    action_log_id: 'log_sample_user',
    occurred_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    actor_type: 'user',
    actor_name: 'Demo HR',
    action: 'signed_off_joiner',
    case_id: 'case_dummy_001',
    entity_type: 'case',
    entity_id: 'case_dummy_001',
    details: {},
  },
  {
    action_log_id: 'log_sample_system',
    occurred_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    actor_type: 'system',
    actor_name: 'Scheduler',
    action: 'renewed_mailbox_subscription',
    case_id: null,
    entity_type: null,
    entity_id: null,
    details: {},
  },
  {
    action_log_id: 'log_sample_agent_doc',
    occurred_at: new Date(Date.now() - 9 * 60 * 60 * 1000).toISOString(),
    actor_type: 'agent',
    actor_name: 'Automation',
    action: 'verified_document',
    case_id: 'case_sample_signoff',
    entity_type: 'checklist_item',
    entity_id: 'chk_case_sample_signoff',
    details: { document_type: 'pan_card' },
  },
  {
    action_log_id: 'log_sample_agent_it',
    occurred_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    actor_type: 'agent',
    actor_name: 'Automation',
    action: 'sent_it_setup_request',
    case_id: 'case_sample_it',
    entity_type: 'task',
    entity_id: 'task_case_sample_it',
    details: { channel: 'email' },
  },
  {
    action_log_id: 'log_sample_user_edit',
    occurred_at: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
    actor_type: 'user',
    actor_name: 'Demo HR',
    action: 'updated_joiner_details',
    case_id: 'case_sample_requested',
    entity_type: 'case',
    entity_id: 'case_sample_requested',
    details: {},
  },
  {
    action_log_id: 'log_sample_agent_approval',
    occurred_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    actor_type: 'agent',
    actor_name: 'Automation',
    action: 'drafted_reply_for_approval',
    case_id: 'case_dummy_001',
    entity_type: 'approval',
    entity_id: 'sample-pending',
    details: {},
  },
  {
    action_log_id: 'log_sample_system_retry',
    occurred_at: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
    actor_type: 'system',
    actor_name: 'Scheduler',
    action: 'retried_failed_send',
    case_id: null,
    entity_type: null,
    entity_id: null,
    details: {},
  },
];

const DUMMY_FAILURES: FailureItem[] = [
  {
    failure_id: 'fail_dummy_001',
    kind: 'job',
    event_type: 'send_email',
    case_id: 'case_dummy_001',
    attempts: 2,
    last_error: 'Dummy failure (backend disconnected)',
    updated_at: new Date().toISOString(),
  },
  {
    failure_id: 'fail_sample_email_read',
    kind: 'event',
    event_type: 'email.received',
    case_id: 'case_sample_signoff',
    attempts: 3,
    last_error: 'Sample failure — could not parse the incoming email (backend disconnected)',
    updated_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
  },
  {
    failure_id: 'fail_sample_doc_check',
    kind: 'event',
    event_type: 'documents.check',
    case_id: 'case_sample_it',
    attempts: 1,
    last_error: 'Sample failure — document check timed out (backend disconnected)',
    updated_at: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
  },
];

const DUMMY_TEMPLATES: TemplateSummary[] = [
  {
    template_key: 'welcome_email',
    name: 'Welcome Email',
    subject: 'Welcome to the team, {{full_name}}!',
    placeholders: ['full_name', 'joining_date'],
    is_active: true,
    updated_at: new Date().toISOString(),
  },
];

const DUMMY_ATTACHMENT: AttachmentData = {
  attachment_id: 'att_dummy_001',
  kind: 'statement_of_understanding',
  file_name: 'statement.pdf',
  mime_type: 'application/pdf',
  size: 10240,
  document_type_guess: 'statement_of_understanding',
  ai_confidence: 0.95,
  ocr_quality: 0.9,
  name_match_score: 1,
  person_check: 'match',
  check_status: 'verified',
  issues: [],
  is_latest: true,
  received_at: new Date().toISOString(),
};

export const adminApi = {
  // --- Original backend-connected implementation (commented out, see dummy.md) ---
  // status: async () => (await axiosInstance.get<StatusResponse>('/api/admin/status')).data.data,
  // killSwitch: async (payload: KillSwitchRequest) =>
  //   (await axiosInstance.post<KillSwitchResponse>('/api/admin/kill-switch', payload)).data,
  // dryRun: async (payload: DryRunRequest) =>
  //   (await axiosInstance.post<DryRunResponse>('/api/admin/dry-run', payload)).data,
  // settings: async () => (await axiosInstance.get<SettingsListResponse>('/api/settings')).data.data,
  // updateSettings: async (changes: Record<string, unknown>) =>
  //   (await axiosInstance.patch<SettingsListResponse>('/api/settings', changes)).data,
  // checklists: async (params: { hire_category?: HireCategory; location?: string } = {}) =>
  //   (await axiosInstance.get<ChecklistListResponse>('/api/checklist-templates', { params })).data.data,
  // putChecklist: async (payload: PutChecklistRequest) =>
  //   (await axiosInstance.put<ChecklistGroupResponse>('/api/checklist-templates', payload)).data,
  // inductionTemplate: async (track: InductionTrack) =>
  //   (await axiosInstance.get<InductionTemplateResponse>(`/api/induction-templates/${track}`)).data.data,
  // putInductionTemplate: async (track: InductionTrack, payload: PutInductionTemplateRequest) =>
  //   (await axiosInstance.put<InductionTemplateResponse>(`/api/induction-templates/${track}`, payload)).data,
  // holidays: async (params: { year?: number; location?: string }) =>
  //   (await axiosInstance.get<HolidayListResponse>('/api/holidays', { params })).data.data,
  // createHoliday: async (payload: CreateHolidayRequest) =>
  //   (await axiosInstance.post<HolidayResponse>('/api/holidays', payload)).data,
  // deleteHoliday: async (holidayId: string) => {
  //   await axiosInstance.delete(`/api/holidays/${holidayId}`);
  // },
  // actionLog: async (params: ActionLogParams) =>
  //   (await axiosInstance.get<ActionLogListResponse>('/api/action-log', { params })).data,
  // failures: async (params: FailureParams) =>
  //   (await axiosInstance.get<FailureListResponse>('/api/admin/failures', { params })).data,
  // retryFailure: async (failureId: string, kind: FailureKind) =>
  //   (await axiosInstance.post<RetryResponse>(`/api/admin/failures/${failureId}/retry`, { kind })).data,
  // uploadStatement: async (file: FileAttachment) =>
  //   (await axiosInstance.post<AttachmentResponse>('/api/admin/statement-of-understanding', file)).data,
  // templates: async (params: { search?: string; is_active?: boolean } = {}) =>
  //   (await axiosInstance.get<TemplateListResponse>('/api/templates', { params })).data.data,
  // template: async (templateKey: string) =>
  //   (await axiosInstance.get<TemplateResponse>(`/api/templates/${templateKey}`)).data.data,
  // updateTemplate: async (templateKey: string, payload: UpdateTemplateRequest) =>
  //   (await axiosInstance.patch<TemplateResponse>(`/api/templates/${templateKey}`, payload)).data,
  // previewTemplate: async (templateKey: string, values: Record<string, unknown>) =>
  //   (await axiosInstance.post<PreviewResponse>(`/api/templates/${templateKey}/preview`, { values })).data
  //     .data,
  // createTemplate: async (payload: { template_key: string; name: string; subject: string }) =>
  //   (await axiosInstance.post<TemplateResponse>('/api/templates', payload)).data,

  // --- DUMMY implementation ---
  status: async (): Promise<StatusResponse['data']> => ({
    kill_switch: false,
    dry_run: true,
    test_inbox: 'dummy-inbox@tcgdigital.com',
    document_reading_enabled: true,
    d365_enabled: false,
    mailbox: { subscription: 'active', subscription_expires_at: null, last_poll_at: new Date().toISOString(), last_email_at: new Date().toISOString() },
    queue: { queued: 0, processing: 0, failed: 0, pending_jobs: 0 },
  }),
  killSwitch: async (payload: KillSwitchRequest): Promise<KillSwitchResponse> => ({
    success: true,
    message: 'Dummy kill-switch update (backend disconnected)',
    data: { kill_switch: payload.enabled, changed_by: 'demo.admin', changed_at: new Date().toISOString() },
  }),
  dryRun: async (payload: DryRunRequest): Promise<DryRunResponse> => ({
    success: true,
    message: 'Dummy dry-run update (backend disconnected)',
    data: {
      dry_run: payload.enabled,
      test_inbox: payload.test_inbox ?? 'dummy-inbox@tcgdigital.com',
      changed_by: 'demo.admin',
      changed_at: new Date().toISOString(),
    },
  }),
  settings: async (): Promise<SettingItem[]> => DUMMY_SETTINGS,
  updateSettings: async (_changes: Record<string, unknown>): Promise<SettingsListResponse> => ({
    success: true,
    message: 'Dummy settings update (backend disconnected)',
    data: DUMMY_SETTINGS,
  }),
  checklists: async (_params: { hire_category?: HireCategory; location?: string } = {}): Promise<ChecklistGroup[]> => [
    DUMMY_CHECKLIST_GROUP,
  ],
  putChecklist: async (_payload: PutChecklistRequest): Promise<ChecklistGroupResponse> => ({
    success: true,
    message: 'Dummy checklist saved (backend disconnected)',
    data: DUMMY_CHECKLIST_GROUP,
  }),
  inductionTemplate: async (track: InductionTrack): Promise<InductionTemplateResponse['data']> => ({
    track,
    sessions: [
      { title: 'Welcome & Orientation', owner_email: 'hr@tcgdigital.com', duration_mins: 60, day_number: 1 },
      { title: 'IT Setup', owner_email: 'it@tcgdigital.com', duration_mins: 45, day_number: 1 },
    ],
    updated_at: new Date().toISOString(),
  }),
  putInductionTemplate: async (
    track: InductionTrack,
    payload: PutInductionTemplateRequest,
  ): Promise<InductionTemplateResponse> => ({
    success: true,
    message: 'Dummy induction template saved (backend disconnected)',
    data: { track, sessions: payload.sessions, updated_at: new Date().toISOString() },
  }),
  holidays: async (_params: { year?: number; location?: string }): Promise<HolidayData[]> => DUMMY_HOLIDAYS,
  createHoliday: async (payload: CreateHolidayRequest): Promise<HolidayResponse> => ({
    success: true,
    message: 'Dummy holiday created (backend disconnected)',
    data: { holiday_id: `hol_dummy_${Date.now()}`, holiday_date: payload.holiday_date, name: payload.name, location: payload.location ?? null },
  }),
  deleteHoliday: async (_holidayId: string): Promise<void> => {},
  actionLog: async (params: ActionLogParams): Promise<ActionLogListResponse> => {
    const action = params.action?.trim().toLowerCase();
    const filtered = DUMMY_ACTION_LOG.filter(
      (item) =>
        (!action || item.action.toLowerCase().includes(action)) &&
        (!params.actor_type || item.actor_type === params.actor_type) &&
        (!params.case_id || item.case_id === params.case_id) &&
        (!params.date_from || item.occurred_at >= params.date_from) &&
        (!params.date_to || item.occurred_at <= params.date_to),
    );
    const sorted = [...filtered].sort((a, b) => {
      const diff = new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime();
      return params.sort_order === 'oldest' ? diff : -diff;
    });
    const limit = params.limit ?? 20;
    const offset = params.offset ?? 0;
    return {
      success: true,
      message: 'Dummy action log (backend disconnected)',
      total: sorted.length,
      limit,
      offset,
      data: sorted.slice(offset, offset + limit),
    };
  },
  failures: async (params: FailureParams): Promise<FailureListResponse> => {
    const filtered = DUMMY_FAILURES.filter(
      (item) =>
        (!params.kind || item.kind === params.kind) &&
        (!params.event_type || item.event_type === params.event_type),
    );
    const limit = params.limit ?? 20;
    const offset = params.offset ?? 0;
    return {
      success: true,
      message: 'Dummy failures (backend disconnected)',
      total: filtered.length,
      limit,
      offset,
      data: filtered.slice(offset, offset + limit),
    };
  },
  retryFailure: async (failureId: string, kind: FailureKind): Promise<RetryResponse> => ({
    success: true,
    message: 'Dummy retry queued (backend disconnected)',
    data: { failure_id: failureId, kind, status: 'queued' },
  }),
  uploadStatement: async (file: FileAttachment): Promise<AttachmentResponse> => ({
    success: true,
    message: 'Dummy statement uploaded (backend disconnected)',
    data: { ...DUMMY_ATTACHMENT, file_name: file.file_name, mime_type: file.mime_type, size: file.size },
  }),
  templates: async (_params: { search?: string; is_active?: boolean } = {}): Promise<TemplateSummary[]> => DUMMY_TEMPLATES,
  template: async (templateKey: string): Promise<TemplateResponse['data']> => ({
    template_key: templateKey,
    name: 'Welcome Email',
    subject: 'Welcome to the team, {{full_name}}!',
    placeholders: ['full_name', 'joining_date'],
    is_active: true,
    updated_at: new Date().toISOString(),
    body_html: '<p>Dummy template body (backend disconnected)</p>',
  }),
  updateTemplate: async (templateKey: string, payload: UpdateTemplateRequest): Promise<TemplateResponse> => ({
    success: true,
    message: 'Dummy template updated (backend disconnected)',
    data: {
      template_key: templateKey,
      name: 'Welcome Email',
      subject: payload.subject ?? 'Welcome to the team, {{full_name}}!',
      placeholders: ['full_name', 'joining_date'],
      is_active: payload.is_active ?? true,
      updated_at: new Date().toISOString(),
      body_html: payload.body_html ?? '<p>Dummy template body (backend disconnected)</p>',
    },
  }),
  previewTemplate: async (
    _templateKey: string,
    _values: Record<string, unknown>,
  ): Promise<PreviewResponse['data']> => ({
    subject: 'Welcome to the team, Demo User!',
    body_html: '<p>Dummy preview body (backend disconnected)</p>',
  }),
  createTemplate: async (payload: {
    template_key: string;
    name: string;
    subject: string;
  }): Promise<TemplateResponse> => ({
    success: true,
    message: 'Dummy template created (backend disconnected)',
    data: {
      template_key: payload.template_key,
      name: payload.name,
      subject: payload.subject,
      placeholders: [],
      is_active: true,
      updated_at: new Date().toISOString(),
      body_html: '<p>Write your email body here.</p>',
    },
  }),
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
