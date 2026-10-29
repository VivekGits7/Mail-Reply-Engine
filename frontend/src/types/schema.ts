// Generated from the backend OpenAPI spec by scripts/generate-api-types.ts. Run `bun run gen:types` instead of editing.

export interface ActionLogItem {
  action_log_id: string;
  occurred_at: string;
  actor_type: string;
  actor_name: string;
  action: string;
  case_id?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  details: Record<string, unknown>;
}

export interface ActionLogListResponse {
  success?: boolean;
  message: string;
  total: number;
  limit: number;
  offset: number;
  data: ActionLogItem[];
}

export const ActorType = {
  AGENT: 'agent',
  USER: 'user',
  SYSTEM: 'system',
} as const;
export type ActorType = (typeof ActorType)[keyof typeof ActorType];

export interface AppointmentLetterResponse {
  success?: boolean;
  message: string;
  data: AttachmentData;
}

export interface ApprovalDetail {
  approval_id: string;
  approval_type: ApprovalType;
  case_id?: string | null;
  person_name?: string | null;
  summary?: string | null;
  status: ApprovalStatus;
  created_at?: string | null;
  source_email?: SourceEmail | null;
  draft: ApprovalDraft;
  decided_at?: string | null;
  reject_reason?: string | null;
}

export interface ApprovalDetailResponse {
  success?: boolean;
  message: string;
  data: ApprovalDetail;
}

export interface ApprovalDraft {
  subject?: string | null;
  body?: string | null;
  to?: string[] | null;
  track?: string | null;
  sessions?: DraftSession[] | null;
  notes?: string | null;
  ai_confidence?: number | null;
}

export interface ApprovalListItem {
  approval_id: string;
  approval_type: ApprovalType;
  case_id?: string | null;
  person_name?: string | null;
  summary?: string | null;
  status: ApprovalStatus;
  created_at?: string | null;
}

export interface ApprovalListResponse {
  success?: boolean;
  message: string;
  total: number;
  limit: number;
  offset: number;
  data: ApprovalListItem[];
}

export const ApprovalStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  SENT: 'sent',
} as const;
export type ApprovalStatus = (typeof ApprovalStatus)[keyof typeof ApprovalStatus];

export interface ApprovalSummary {
  approval_id: string;
  approval_type: ApprovalType;
  status: ApprovalStatus;
  created_at?: string | null;
}

export const ApprovalType = {
  REPLY: 'reply',
  INDUCTION_SCHEDULE: 'induction_schedule',
} as const;
export type ApprovalType = (typeof ApprovalType)[keyof typeof ApprovalType];

export interface ApproveData {
  approval_id: string;
  status: ApprovalStatus;
  email_id?: string | null;
  sessions_created: number;
}

export interface ApproveRequest {
  draft?: ApprovalDraft | null;
}

export interface ApproveResponse {
  success?: boolean;
  message: string;
  data: ApproveData;
}

export interface AttachmentData {
  attachment_id: string;
  kind: string;
  file_name: string;
  mime_type: string;
  size: number;
  document_type_guess?: string | null;
  ai_confidence?: number | null;
  ocr_quality?: number | null;
  name_match_score?: number | null;
  person_check?: string | null;
  check_status: string;
  issues: string[];
  is_latest: boolean;
  received_at?: string | null;
}

export interface AttachmentResponse {
  success?: boolean;
  message: string;
  data: AttachmentData;
}

export interface BookSessionRequest {
  start: string;
  end: string;
  force?: boolean;
}

export interface CaseData {
  case_id: string;
  case_type: string;
  stage: string;
  status: string;
  flags: string[];
  track?: string | null;
  parent_case_id?: string | null;
  opened_at?: string | null;
  closed_at?: string | null;
  last_working_day?: string | null;
}

export interface CaseDetailData {
  case: CaseData;
  person: PersonData;
  checklist: ChecklistItemData[];
  attachments: AttachmentData[];
  tasks: TaskData[];
  sessions: InductionSessionData[];
  approvals: ApprovalSummary[];
  timeline: TimelineEntry[];
  related_cases: RelatedCase[];
  next_followup_at?: string | null;
}

export interface CaseDetailResponse {
  success?: boolean;
  message: string;
  data: CaseDetailData;
}

export interface CaseEmailsResponse {
  success?: boolean;
  message: string;
  total: number;
  limit: number;
  offset: number;
  data: EmailThread[];
}

export const CaseFlag = {
  DROPOUT_RISK: 'dropout_risk',
  NAME_MISMATCH: 'name_mismatch',
  SENDER_NOT_RECOGNISED: 'sender_not_recognised',
  SALARY_DOCUMENT: 'salary_document',
  FAILED_ACTION: 'failed_action',
  APPOINTMENT_LETTER_MISSING: 'appointment_letter_missing',
  INDUCTION_NO_REPLY: 'induction_no_reply',
  CALENDAR_CONFLICT: 'calendar_conflict',
  NEEDS_HR: 'needs_hr',
} as const;
export type CaseFlag = (typeof CaseFlag)[keyof typeof CaseFlag];

export const CaseStatus = {
  OPEN: 'open',
  ON_HOLD: 'on_hold',
  CLOSED: 'closed',
  CANCELLED: 'cancelled',
} as const;
export type CaseStatus = (typeof CaseStatus)[keyof typeof CaseStatus];

export interface CaseUpdateResponse {
  success?: boolean;
  message: string;
  data: CaseData;
}

export interface ChecklistGroup {
  hire_category: HireCategory;
  location: string;
  items: ChecklistItemOut[];
  updated_at?: string | null;
}

export interface ChecklistGroupResponse {
  success?: boolean;
  message: string;
  data: ChecklistGroup;
}

export interface ChecklistItemData {
  checklist_item_id: string;
  document_type: string;
  is_mandatory: boolean;
  check_mode: string;
  status: string;
  person_check?: string | null;
  attachment_id?: string | null;
  notes?: string | null;
  updated_at?: string | null;
}

export interface ChecklistItemIn {
  document_type: string;
  is_mandatory?: boolean;
  check_mode?: CheckMode;
}

export interface ChecklistItemOut {
  document_type: string;
  is_mandatory?: boolean;
  check_mode?: CheckMode;
  sort_order: number;
}

export interface ChecklistListResponse {
  success?: boolean;
  message: string;
  data: ChecklistGroup[];
}

export interface ChecklistOverrideData {
  checklist_item: ChecklistItemData;
  case_stage: string;
}

export interface ChecklistOverrideRequest {
  status: ChecklistStatus;
  note?: string | null;
  attachment_id?: string | null;
}

export interface ChecklistOverrideResponse {
  success?: boolean;
  message: string;
  data: ChecklistOverrideData;
}

export const ChecklistStatus = {
  PENDING: 'pending',
  RECEIVED: 'received',
  VERIFIED: 'verified',
  UNREADABLE: 'unreadable',
  WRONG_TYPE: 'wrong_type',
  NAME_MISMATCH: 'name_mismatch',
} as const;
export type ChecklistStatus = (typeof ChecklistStatus)[keyof typeof ChecklistStatus];

export const CheckMode = {
  TEXT: 'text',
  PHOTO: 'photo',
} as const;
export type CheckMode = (typeof CheckMode)[keyof typeof CheckMode];

export const ClearanceTeam = {
  IT: 'it',
  FINANCE: 'finance',
  ADMIN: 'admin',
  MANAGER: 'manager',
} as const;
export type ClearanceTeam = (typeof ClearanceTeam)[keyof typeof ClearanceTeam];

export interface ComplaintDetail {
  complaint_id: string;
  received_at: string;
  source: ComplaintSource;
  sender_email?: string | null;
  person?: ComplaintPerson | null;
  subject?: string | null;
  content?: string | null;
  attachment?: AttachmentData | null;
}

export interface ComplaintDetailResponse {
  success?: boolean;
  message: string;
  data: ComplaintDetail;
}

export interface ComplaintListItem {
  complaint_id: string;
  received_at: string;
  source: ComplaintSource;
  sender_email?: string | null;
  person_name?: string | null;
  subject?: string | null;
}

export interface ComplaintListResponse {
  success?: boolean;
  message: string;
  total: number;
  limit: number;
  offset: number;
  data: ComplaintListItem[];
}

export interface ComplaintPerson {
  person_id: string;
  full_name: string;
  employee_code?: string | null;
}

export const ComplaintSource = {
  EMAIL: 'email',
  EXIT_INTERVIEW: 'exit_interview',
  HR_CONNECT: 'hr_connect',
} as const;
export type ComplaintSource = (typeof ComplaintSource)[keyof typeof ComplaintSource];

export interface CreateExitRequest {
  person_id?: string | null;
  full_name?: string | null;
  employee_code?: string | null;
  work_email?: string | null;
  manager_name?: string | null;
  manager_email?: string | null;
  last_working_day: string;
}

export interface CreateHolidayRequest {
  holiday_date: string;
  name: string;
  location?: string | null;
}

export interface CreateJoinerRequest {
  full_name: string;
  personal_email: string;
  recruiter_email: string;
  hire_category: HireCategory;
  location: string;
  level: string;
  joining_date: string;
  date_of_birth: string;
  manager_name: string;
  manager_email: string;
  photo?: FileAttachment | null;
}

export interface CreateReportData {
  feedback_report_id: string;
  status: ReportStatus;
}

export interface CreateReportRequest {
  period_start: string;
  period_end: string;
}

export interface CreateReportResponse {
  success?: boolean;
  message: string;
  data: CreateReportData;
}

export interface CreateRuleRequest {
  name: string;
  data_source?: DataSource;
  recipient_field: string;
  required_columns: string[];
  template_key: string;
  stages?: RuleStage[];
  schedule_cron: string;
  followup_gap_hours?: number;
  max_rounds?: number;
  escalate_to_email?: string | null;
  is_active?: boolean;
  rule_key: string;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
  complaints_access?: boolean;
  photo?: FileAttachment | null;
}

export const DataSource = {
  UPLOAD: 'upload',
  D365: 'd365',
  TEST: 'test',
} as const;
export type DataSource = (typeof DataSource)[keyof typeof DataSource];

export interface DownloadUrlData {
  url: string;
  expires_in: number;
}

export interface DownloadUrlResponse {
  success?: boolean;
  message: string;
  data: DownloadUrlData;
}

export interface DraftSession {
  title: string;
  owner_email: string;
  start: string;
  end: string;
}

export interface DryRunData {
  dry_run: boolean;
  test_inbox: string;
  changed_by: string;
  changed_at: string;
}

export interface DryRunRequest {
  enabled: boolean;
  test_inbox?: string | null;
}

export interface DryRunResponse {
  success?: boolean;
  message: string;
  data: DryRunData;
}

export const EmailDirection = {
  INBOUND: 'inbound',
  OUTBOUND: 'outbound',
} as const;
export type EmailDirection = (typeof EmailDirection)[keyof typeof EmailDirection];

export interface EmailThread {
  thread_id: string;
  subject?: string | null;
  message_count: number;
  last_at: string;
  messages: ThreadMessage[];
}

export interface EmptyResponse {
  success?: boolean;
  message: string;
  data?: null;
}

export interface ExitCreatedData {
  case_id: string;
  person: PersonData;
  stage: string;
  tasks: TaskData[];
}

export interface ExitCreatedResponse {
  success?: boolean;
  message: string;
  data: ExitCreatedData;
}

export interface ExitListItem {
  case_id: string;
  person_id: string;
  full_name: string;
  employee_code?: string | null;
  last_working_day?: string | null;
  stage: string;
  status: string;
  flags: string[];
  clearances: Record<string, string>;
  updated_at?: string | null;
}

export interface ExitListResponse {
  success?: boolean;
  message: string;
  total: number;
  limit: number;
  offset: number;
  data: ExitListItem[];
}

export const ExitSortBy = {
  LAST_WORKING_DAY: 'last_working_day',
  FULL_NAME: 'full_name',
  CREATED_AT: 'created_at',
} as const;
export type ExitSortBy = (typeof ExitSortBy)[keyof typeof ExitSortBy];

export const ExitStage = {
  CLEARANCE_REQUESTED: 'clearance_requested',
  CLEARANCES_IN_PROGRESS: 'clearances_in_progress',
  ALL_CLEARED: 'all_cleared',
  CLOSED: 'closed',
} as const;
export type ExitStage = (typeof ExitStage)[keyof typeof ExitStage];

export interface FailureItem {
  failure_id: string;
  kind: FailureKind;
  event_type: string;
  case_id?: string | null;
  attempts: number;
  last_error?: string | null;
  updated_at: string;
}

export const FailureKind = {
  EVENT: 'event',
  JOB: 'job',
} as const;
export type FailureKind = (typeof FailureKind)[keyof typeof FailureKind];

export interface FailureListResponse {
  success?: boolean;
  message: string;
  total: number;
  limit: number;
  offset: number;
  data: FailureItem[];
}

export interface FileAttachment {
  file_name: string;
  file_url: string;
  mime_type: string;
  size: number;
}

export interface HealthCheckResponse {
  success?: boolean;
  message: string;
  data: HealthData;
}

export interface HealthData {
  database: string;
  redis: string;
  worker: string;
  mailbox_subscription: string;
  kill_switch: boolean;
  dry_run: boolean;
}

export const HireCategory = {
  CAMPUS: 'campus',
  LATERAL: 'lateral',
} as const;
export type HireCategory = (typeof HireCategory)[keyof typeof HireCategory];

export interface HolidayData {
  holiday_id: string;
  holiday_date: string;
  name: string;
  location?: string | null;
}

export interface HolidayListResponse {
  success?: boolean;
  message: string;
  data: HolidayData[];
}

export interface HolidayResponse {
  success?: boolean;
  message: string;
  data: HolidayData;
}

export interface InductionSessionData {
  induction_session_id: string;
  title: string;
  owner_email?: string | null;
  proposed_start: string;
  proposed_end: string;
  agreed_start?: string | null;
  agreed_end?: string | null;
  status: string;
  graph_event_id?: string | null;
}

export interface InductionSessionTemplate {
  title: string;
  owner_email: string;
  duration_mins: number;
  day_number: number;
}

export interface InductionTemplateData {
  track: InductionTrack;
  sessions: InductionSessionTemplate[];
  updated_at?: string | null;
}

export interface InductionTemplateResponse {
  success?: boolean;
  message: string;
  data: InductionTemplateData;
}

export const InductionTrack = {
  CAMPUS: 'campus',
  MID: 'mid',
  SENIOR: 'senior',
} as const;
export type InductionTrack = (typeof InductionTrack)[keyof typeof InductionTrack];

export interface InvalidRow {
  row: number;
  reason: string;
}

export interface JoinerCreatedData {
  person: PersonData;
  case_id: string;
  stage: string;
  checklist: ChecklistItemData[];
}

export interface JoinerCreatedResponse {
  success?: boolean;
  message: string;
  data: JoinerCreatedData;
}

export interface JoinerListItem {
  person_id: string;
  case_id: string;
  full_name: string;
  joining_date?: string | null;
  hire_category?: string | null;
  level?: string | null;
  location?: string | null;
  stage: string;
  status: string;
  flags: string[];
  docs_verified: number;
  docs_total: number;
  next_followup_at?: string | null;
  updated_at?: string | null;
  photo_url?: string | null;
}

export interface JoinerListResponse {
  success?: boolean;
  message: string;
  total: number;
  limit: number;
  offset: number;
  data: JoinerListItem[];
}

export const JoinerSortBy = {
  JOINING_DATE: 'joining_date',
  FULL_NAME: 'full_name',
  UPDATED_AT: 'updated_at',
  CREATED_AT: 'created_at',
} as const;
export type JoinerSortBy = (typeof JoinerSortBy)[keyof typeof JoinerSortBy];

export interface JoinerUpdateData {
  person: PersonData;
  rechecked_documents: number;
}

export interface JoinerUpdateResponse {
  success?: boolean;
  message: string;
  data: JoinerUpdateData;
}

export interface KillSwitchData {
  kill_switch: boolean;
  changed_by: string;
  changed_at: string;
}

export interface KillSwitchRequest {
  enabled: boolean;
  reason?: string | null;
}

export interface KillSwitchResponse {
  success?: boolean;
  message: string;
  data: KillSwitchData;
}

export interface LoginResponse {
  success?: boolean;
  message: string;
  access_token: string;
  token_type?: string;
  expires_in: number;
  user: UserData;
}

export interface MailboxStatus {
  subscription: string;
  subscription_expires_at?: string | null;
  last_poll_at?: string | null;
  last_email_at?: string | null;
}

export const OnboardingStage = {
  DOCS_REQUESTED: 'docs_requested',
  DOCS_IN_PROGRESS: 'docs_in_progress',
  READY_FOR_SIGNOFF: 'ready_for_signoff',
  IT_REQUESTED: 'it_requested',
  CLOSED: 'closed',
  DROPOUT: 'dropout',
} as const;
export type OnboardingStage = (typeof OnboardingStage)[keyof typeof OnboardingStage];

export interface PersonData {
  person_id: string;
  full_name: string;
  personal_email?: string | null;
  work_email?: string | null;
  employee_code?: string | null;
  designation?: string | null;
  level?: string | null;
  location?: string | null;
  hire_category?: string | null;
  joining_date?: string | null;
  date_of_birth?: string | null;
  manager_name?: string | null;
  manager_email?: string | null;
  recruiter_email?: string | null;
  role: string;
  status: string;
  photo_url?: string | null;
}

export interface PlanInductionData {
  induction_case_id: string;
  stage: string;
  track: string;
}

export interface PlanInductionRequest {
  track?: InductionTrack | null;
}

export interface PlanInductionResponse {
  success?: boolean;
  message: string;
  data: PlanInductionData;
}

export interface PresignData {
  upload_url: string;
  fields: Record<string, string>;
  file_url: string;
  expires_in: number;
}

export interface PresignRequest {
  file_name: string;
  mime_type: string;
  size: number;
  purpose: UploadPurpose;
}

export interface PresignResponse {
  success?: boolean;
  message: string;
  data: PresignData;
}

export interface PreviewData {
  subject: string;
  body_html: string;
}

export interface PreviewResponse {
  success?: boolean;
  message: string;
  data: PreviewData;
}

export interface PreviewTemplateRequest {
  values?: Record<string, unknown>;
}

export interface PutChecklistRequest {
  hire_category: HireCategory;
  location?: string;
  items: ChecklistItemIn[];
}

export interface PutInductionTemplateRequest {
  sessions: InductionSessionTemplate[];
}

export interface QueueStatus {
  queued: number;
  processing: number;
  failed: number;
  pending_jobs: number;
}

export interface RejectData {
  approval_id: string;
  status: ApprovalStatus;
}

export interface RejectRequest {
  reason: string;
}

export interface RejectResponse {
  success?: boolean;
  message: string;
  data: RejectData;
}

export interface RelatedCase {
  case_id: string;
  case_type: string;
  stage: string;
  status: string;
}

export interface ReleaseConfirmData {
  case_id: string;
  stage: string;
  closed_at?: string | null;
}

export interface ReleaseConfirmRequest {
  note?: string | null;
}

export interface ReleaseConfirmResponse {
  success?: boolean;
  message: string;
  data: ReleaseConfirmData;
}

export interface ReportItem {
  feedback_report_id: string;
  period_start: string;
  period_end: string;
  response_count: number;
  status: ReportStatus;
  sent_at?: string | null;
}

export interface ReportListResponse {
  success?: boolean;
  message: string;
  data: ReportItem[];
}

export const ReportStatus = {
  QUEUED: 'queued',
  READY: 'ready',
  SENT: 'sent',
  FAILED: 'failed',
} as const;
export type ReportStatus = (typeof ReportStatus)[keyof typeof ReportStatus];

export interface RetryData {
  failure_id: string;
  kind: FailureKind;
  status: string;
}

export interface RetryRequest {
  kind: FailureKind;
}

export interface RetryResponse {
  success?: boolean;
  message: string;
  data: RetryData;
}

export interface RootData {
  app_name: string;
  version: string;
}

export interface RootResponse {
  success?: boolean;
  message: string;
  data: RootData;
}

export interface RuleData {
  reminder_rule_id: string;
  name: string;
  rule_key: string;
  data_source: DataSource;
  recipient_field: string;
  required_columns: string[];
  template_key: string;
  stages: RuleStage[];
  schedule_cron: string;
  followup_gap_hours: number;
  max_rounds: number;
  escalate_to_email?: string | null;
  is_active: boolean;
  next_run_at?: string | null;
  open_tasks: number;
}

export interface RuleListResponse {
  success?: boolean;
  message: string;
  data: RuleData[];
}

export interface RuleResponse {
  success?: boolean;
  message: string;
  data: RuleData;
}

export const RuleSortBy = {
  NAME: 'name',
  CREATED_AT: 'created_at',
} as const;
export type RuleSortBy = (typeof RuleSortBy)[keyof typeof RuleSortBy];

export interface RuleStage {
  stage: string;
  recipient_field: string;
  template_key: string;
}

export interface RuleTaskItem {
  task_id: string;
  owner_email?: string | null;
  status: string;
  followups_sent: number;
  next_followup_at?: string | null;
  details: Record<string, unknown>;
  paused_until?: string | null;
  completed_at?: string | null;
}

export interface RuleTaskListResponse {
  success?: boolean;
  message: string;
  total: number;
  limit: number;
  offset: number;
  data: RuleTaskItem[];
}

export const RuleTaskSortBy = {
  DUE_AT: 'due_at',
  CREATED_AT: 'created_at',
} as const;
export type RuleTaskSortBy = (typeof RuleTaskSortBy)[keyof typeof RuleTaskSortBy];

export interface SessionResponse {
  success?: boolean;
  message: string;
  data: InductionSessionData;
}

export interface SettingItem {
  key: string;
  value: unknown;
  description: string;
  updated_by?: string | null;
  updated_at?: string | null;
}

export interface SettingsListResponse {
  success?: boolean;
  message: string;
  data: SettingItem[];
}

export interface SignOffData {
  case_id: string;
  stage: string;
  person: PersonData;
  it_task: TaskData;
}

export interface SignOffRequest {
  employee_code: string;
  designation: string;
  project_code?: string | null;
  gender: string;
  blood_group?: string | null;
  date_of_marriage?: string | null;
  bu_head: string;
  employment_type: string;
  contact_number: string;
  sector_region: string;
  system_type: boolean;
  proj_ops: boolean;
  ess_d365: boolean;
  skills: string;
  business_card: boolean;
  force_reason?: string | null;
}

export interface SignOffResponse {
  success?: boolean;
  message: string;
  data: SignOffData;
}

export const SortOrder = {
  LATEST: 'latest',
  OLDEST: 'oldest',
  A_TO_Z: 'a_to_z',
  Z_TO_A: 'z_to_a',
} as const;
export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder];

export interface SourceEmail {
  email_id: string;
  from?: string | null;
  subject?: string | null;
  received_at?: string | null;
  body?: string | null;
}

export interface StatusData {
  kill_switch: boolean;
  dry_run: boolean;
  test_inbox: string;
  document_reading_enabled: boolean;
  d365_enabled: boolean;
  mailbox: MailboxStatus;
  queue: QueueStatus;
}

export interface StatusResponse {
  success?: boolean;
  message: string;
  data: StatusData;
}

export interface SurveyItem {
  survey_response_id: string;
  person_id: string;
  full_name: string;
  milestone: number;
  form_variant: HireCategory;
  status: SurveyStatus;
  sent_at?: string | null;
  reminders_sent: number;
  responded_at?: string | null;
  score?: number | null;
  flagged: boolean;
}

export interface SurveyListResponse {
  success?: boolean;
  message: string;
  total: number;
  limit: number;
  offset: number;
  data: SurveyItem[];
}

export const SurveySortBy = {
  SENT_AT: 'sent_at',
  SCORE: 'score',
  FULL_NAME: 'full_name',
} as const;
export type SurveySortBy = (typeof SurveySortBy)[keyof typeof SurveySortBy];

export const SurveyStatus = {
  SENT: 'sent',
  RESPONDED: 'responded',
  NO_RESPONSE: 'no_response',
} as const;
export type SurveyStatus = (typeof SurveyStatus)[keyof typeof SurveyStatus];

export interface TaskData {
  task_id: string;
  case_id?: string | null;
  task_type: string;
  owner_role: string;
  owner_email?: string | null;
  status: string;
  sub_items: Record<string, string>;
  progress_notes?: string | null;
  followups_sent: number;
  next_followup_at?: string | null;
  due_at?: string | null;
  completed_at?: string | null;
}

export interface TaskResponse {
  success?: boolean;
  message: string;
  data: TaskData;
}

export const TaskStatus = {
  OPEN: 'open',
  PARTIAL: 'partial',
  DONE: 'done',
  BLOCKED: 'blocked',
  NOT_APPLICABLE: 'not_applicable',
  ESCALATED: 'escalated',
  PAUSED: 'paused',
  CANCELLED: 'cancelled',
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export interface TemplateData {
  template_key: string;
  name: string;
  subject: string;
  placeholders: string[];
  is_active: boolean;
  updated_at?: string | null;
  body_html: string;
}

export interface TemplateListResponse {
  success?: boolean;
  message: string;
  data: TemplateSummary[];
}

export interface TemplateResponse {
  success?: boolean;
  message: string;
  data: TemplateData;
}

export interface TemplateSummary {
  template_key: string;
  name: string;
  subject: string;
  placeholders: string[];
  is_active: boolean;
  updated_at?: string | null;
}

export interface ThreadAttachment {
  attachment_id: string;
  file_name: string;
  mime_type: string;
  size: number;
}

export interface ThreadMessage {
  email_id: string;
  direction: EmailDirection;
  from_name?: string | null;
  from_email?: string | null;
  to: string[];
  cc: string[];
  subject?: string | null;
  body?: string | null;
  at: string;
  case_id?: string | null;
  case_type?: string | null;
  category?: string | null;
  status: string;
  is_dry_run: boolean;
  is_automatic: boolean;
  attachments: ThreadAttachment[];
}

export interface TimelineEntry {
  at: string;
  kind: string;
  direction?: string | null;
  subject?: string | null;
  summary: string;
  category?: string | null;
  actor: string;
  email_id?: string | null;
}

export interface UpdateApprovalRequest {
  draft: ApprovalDraft;
}

export interface UpdateCaseRequest {
  status?: CaseStatus | null;
  clear_flags?: CaseFlag[];
  note?: string | null;
}

export interface UpdateJoinerRequest {
  full_name?: string | null;
  personal_email?: string | null;
  recruiter_email?: string | null;
  location?: string | null;
  level?: string | null;
  joining_date?: string | null;
  date_of_birth?: string | null;
  manager_name?: string | null;
  manager_email?: string | null;
  photo?: FileAttachment | null;
}

export interface UpdateMyPhotoRequest {
  photo: FileAttachment | null;
}

export interface UpdateRuleRequest {
  name?: string | null;
  recipient_field?: string | null;
  required_columns?: string[] | null;
  template_key?: string | null;
  stages?: RuleStage[] | null;
  schedule_cron?: string | null;
  followup_gap_hours?: number | null;
  max_rounds?: number | null;
  escalate_to_email?: string | null;
  is_active?: boolean | null;
}

export interface UpdateTaskRequest {
  status?: TaskStatus | null;
  sub_items?: Record<string, string>;
  note?: string | null;
}

export interface UpdateTemplateRequest {
  subject?: string | null;
  body_html?: string | null;
  is_active?: boolean | null;
}

export interface UpdateUserRequest {
  role?: UserRole | null;
  complaints_access?: boolean | null;
  is_active?: boolean | null;
  password?: string | null;
  photo?: FileAttachment | null;
}

export interface UploadListData {
  rows_total: number;
  rows_valid: number;
  rows_invalid: InvalidRow[];
  tasks_created: number;
  tasks_closed: number;
  tasks_reopened: number;
}

export interface UploadListRequest {
  file: FileAttachment;
}

export interface UploadListResponse {
  success?: boolean;
  message: string;
  data: UploadListData;
}

export const UploadPurpose = {
  APPOINTMENT_LETTER: 'appointment_letter',
  REMINDER_LIST: 'reminder_list',
  SURVEY_EXPORT: 'survey_export',
  TRANSCRIPT: 'transcript',
  STATEMENT_OF_UNDERSTANDING: 'statement_of_understanding',
  USER_PHOTO: 'user_photo',
  JOINER_PHOTO: 'joiner_photo',
} as const;
export type UploadPurpose = (typeof UploadPurpose)[keyof typeof UploadPurpose];

export interface UploadResponsesData {
  rows_total: number;
  rows_matched: number;
  rows_unmatched: number;
  low_score_alerts: number;
}

export interface UploadResponsesRequest {
  form_variant: HireCategory;
  file: FileAttachment;
}

export interface UploadResponsesResponse {
  success?: boolean;
  message: string;
  data: UploadResponsesData;
}

export const UploadSource = {
  EXIT_INTERVIEW: 'exit_interview',
  HR_CONNECT: 'hr_connect',
} as const;
export type UploadSource = (typeof UploadSource)[keyof typeof UploadSource];

export interface UploadTranscriptData {
  complaint_id: string;
  source: UploadSource;
  received_at: string;
}

export interface UploadTranscriptRequest {
  source: UploadSource;
  person_id?: string | null;
  file: FileAttachment;
}

export interface UploadTranscriptResponse {
  success?: boolean;
  message: string;
  data: UploadTranscriptData;
}

export interface UserData {
  user_id: string;
  name: string;
  email: string;
  role: UserRole;
  complaints_access: boolean;
  is_active: boolean;
  photo_url?: string | null;
  last_login_at?: string | null;
}

export interface UserListResponse {
  success?: boolean;
  message: string;
  total: number;
  limit: number;
  offset: number;
  data: UserData[];
}

export interface UserResponse {
  success?: boolean;
  message: string;
  data: UserData;
}

export const UserRole = {
  HR_ADMIN: 'hr_admin',
  HR_VIEWER: 'hr_viewer',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const UserSortBy = {
  CREATED_AT: 'created_at',
  NAME: 'name',
  LAST_LOGIN_AT: 'last_login_at',
} as const;
export type UserSortBy = (typeof UserSortBy)[keyof typeof UserSortBy];
