import { queryOptions } from '@tanstack/react-query';
// import axiosInstance from '@/redux/axios';
import type {
  AppointmentLetterResponse,
  BookSessionRequest,
  CaseDetailData,
  CaseEmailsResponse,
  CaseUpdateResponse,
  ChecklistOverrideRequest,
  ChecklistOverrideResponse,
  DownloadUrlResponse,
  FileAttachment,
  PlanInductionRequest,
  PlanInductionResponse,
  ReleaseConfirmRequest,
  ReleaseConfirmResponse,
  SessionResponse,
  SignOffRequest,
  SignOffResponse,
  TaskResponse,
  UpdateCaseRequest,
  UpdateTaskRequest,
} from '@/types';

const THREAD_LIMIT = 100;

// --- DUMMY DATA (backend disconnected, see dummy.md) ---
const DUMMY_CASE_DETAIL: CaseDetailData = {
  case: {
    case_id: 'case_dummy_001',
    case_type: 'onboarding',
    stage: 'docs_in_progress',
    status: 'open',
    flags: [],
    track: 'mid',
    parent_case_id: null,
    opened_at: new Date().toISOString(),
    closed_at: null,
  },
  person: {
    person_id: 'person_dummy_001',
    full_name: 'Demo Joiner',
    personal_email: 'demo.joiner@example.com',
    work_email: null,
    employee_code: null,
    designation: 'Software Engineer',
    level: 'L2',
    location: 'Bengaluru',
    hire_category: 'lateral',
    joining_date: new Date().toISOString(),
    date_of_birth: '1998-01-01',
    manager_name: 'Demo Manager',
    manager_email: 'demo.manager@tcgdigital.com',
    recruiter_email: 'demo.recruiter@tcgdigital.com',
    role: 'joiner',
    status: 'active',
    photo_url: null,
  },
  checklist: [
    {
      checklist_item_id: 'chk_dummy_001',
      document_type: 'pan_card',
      is_mandatory: true,
      check_mode: 'text',
      status: 'pending',
      person_check: null,
      attachment_id: null,
      notes: null,
      updated_at: new Date().toISOString(),
    },
  ],
  attachments: [],
  tasks: [
    {
      task_id: 'task_dummy_001',
      case_id: 'case_dummy_001',
      task_type: 'it_setup',
      owner_role: 'it',
      owner_email: 'it@tcgdigital.com',
      status: 'open',
      sub_items: {},
      progress_notes: null,
      followups_sent: 0,
      next_followup_at: null,
      due_at: null,
      completed_at: null,
    },
  ],
  sessions: [],
  approvals: [],
  timeline: [
    {
      at: new Date().toISOString(),
      kind: 'note',
      direction: null,
      subject: null,
      summary: 'Dummy case created (backend disconnected)',
      category: null,
      actor: 'system',
      email_id: null,
    },
  ],
  related_cases: [],
  next_followup_at: null,
};

function onboardingCase(opts: {
  caseId: string;
  fullName: string;
  stage: string;
  level: string;
  location: string;
  hireCategory: string;
  joiningDate: string;
  docsVerified: boolean;
  flags?: string[];
}): CaseDetailData {
  const slug = opts.fullName.toLowerCase().replace(/\s+/g, '.');
  return {
    case: {
      case_id: opts.caseId,
      case_type: 'onboarding',
      stage: opts.stage,
      status: opts.stage === 'closed' ? 'closed' : 'open',
      flags: opts.flags ?? [],
      track: 'mid',
      parent_case_id: null,
      opened_at: new Date().toISOString(),
      closed_at: null,
    },
    person: {
      person_id: `person_${opts.caseId}`,
      full_name: opts.fullName,
      personal_email: `${slug}@example.com`,
      work_email: null,
      employee_code: null,
      designation: 'Software Engineer',
      level: opts.level,
      location: opts.location,
      hire_category: opts.hireCategory,
      joining_date: opts.joiningDate,
      date_of_birth: '1998-01-01',
      manager_name: 'Demo Manager',
      manager_email: 'demo.manager@tcgdigital.com',
      recruiter_email: 'demo.recruiter@tcgdigital.com',
      role: 'joiner',
      status: 'active',
      photo_url: null,
    },
    checklist: [
      {
        checklist_item_id: `chk_${opts.caseId}`,
        document_type: 'pan_card',
        is_mandatory: true,
        check_mode: 'text',
        status: opts.docsVerified ? 'verified' : 'pending',
        person_check: opts.docsVerified ? 'match' : null,
        attachment_id: null,
        notes: null,
        updated_at: new Date().toISOString(),
      },
    ],
    attachments: [],
    tasks: [
      {
        task_id: `task_${opts.caseId}`,
        case_id: opts.caseId,
        task_type: 'it_setup',
        owner_role: 'it',
        owner_email: 'it@tcgdigital.com',
        status: 'open',
        sub_items: {},
        progress_notes: null,
        followups_sent: 0,
        next_followup_at: null,
        due_at: null,
        completed_at: null,
      },
    ],
    sessions: [],
    approvals: [],
    timeline: [
      {
        at: new Date().toISOString(),
        kind: 'note',
        direction: null,
        subject: null,
        summary: 'Dummy case created (backend disconnected)',
        category: null,
        actor: 'system',
        email_id: null,
      },
    ],
    related_cases: [],
    next_followup_at: null,
  };
}

function exitCase(opts: {
  caseId: string;
  fullName: string;
  employeeCode: string;
  stage: string;
  lastWorkingDay: string;
  clearances: Record<string, string>;
}): CaseDetailData {
  const slug = opts.fullName.toLowerCase().replace(/\s+/g, '.');
  return {
    case: {
      case_id: opts.caseId,
      case_type: 'exit',
      stage: opts.stage,
      status: opts.stage === 'closed' ? 'closed' : 'open',
      flags: [],
      track: null,
      parent_case_id: null,
      opened_at: new Date().toISOString(),
      closed_at: null,
      last_working_day: opts.lastWorkingDay,
    },
    person: {
      person_id: `person_${opts.caseId}`,
      full_name: opts.fullName,
      personal_email: null,
      work_email: `${slug}@tcgdigital.com`,
      employee_code: opts.employeeCode,
      designation: null,
      level: null,
      location: null,
      hire_category: null,
      joining_date: null,
      date_of_birth: null,
      manager_name: 'Demo Manager',
      manager_email: 'demo.manager@tcgdigital.com',
      recruiter_email: null,
      role: 'leaver',
      status: 'active',
      photo_url: null,
    },
    checklist: [],
    attachments: [],
    tasks: Object.entries(opts.clearances).map(([team, status]) => ({
      task_id: `task_${opts.caseId}_${team}`,
      case_id: opts.caseId,
      task_type: 'exit_clearance',
      owner_role: team,
      owner_email: `${team}@tcgdigital.com`,
      status,
      sub_items: {},
      progress_notes: null,
      followups_sent: 0,
      next_followup_at: null,
      due_at: null,
      completed_at: status === 'done' ? new Date().toISOString() : null,
    })),
    sessions: [],
    approvals: [],
    timeline: [
      {
        at: new Date().toISOString(),
        kind: 'note',
        direction: null,
        subject: null,
        summary: 'Dummy case created (backend disconnected)',
        category: null,
        actor: 'system',
        email_id: null,
      },
    ],
    related_cases: [],
    next_followup_at: null,
  };
}

const DUMMY_CASES: Record<string, CaseDetailData> = {
  case_dummy_001: DUMMY_CASE_DETAIL,
  case_sample_requested: onboardingCase({
    caseId: 'case_sample_requested',
    fullName: 'Sample Joiner',
    stage: 'docs_requested',
    level: 'L1',
    location: 'Pune',
    hireCategory: 'campus',
    joiningDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    docsVerified: false,
  }),
  case_sample_signoff: onboardingCase({
    caseId: 'case_sample_signoff',
    fullName: 'Sample Candidate',
    stage: 'ready_for_signoff',
    level: 'L3',
    location: 'Hyderabad',
    hireCategory: 'lateral',
    joiningDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    docsVerified: true,
  }),
  case_sample_it: onboardingCase({
    caseId: 'case_sample_it',
    fullName: 'Sample Employee',
    stage: 'it_requested',
    level: 'L2',
    location: 'Bengaluru',
    hireCategory: 'lateral',
    joiningDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    docsVerified: true,
  }),
  case_sample_dropout: onboardingCase({
    caseId: 'case_sample_dropout',
    fullName: 'Sample Dropout',
    stage: 'dropout',
    level: 'L1',
    location: 'Pune',
    hireCategory: 'campus',
    joiningDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    docsVerified: false,
    flags: ['dropout_risk'],
  }),
  case_sample_closed: onboardingCase({
    caseId: 'case_sample_closed',
    fullName: 'Sample Closed Case',
    stage: 'closed',
    level: 'L4',
    location: 'Mumbai',
    hireCategory: 'lateral',
    joiningDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    docsVerified: true,
  }),
  case_dummy_exit_001: exitCase({
    caseId: 'case_dummy_exit_001',
    fullName: 'Demo Leaver',
    employeeCode: 'EMP099',
    stage: 'clearance_requested',
    lastWorkingDay: new Date().toISOString(),
    clearances: { it: 'pending', finance: 'pending', admin: 'pending', manager: 'pending' },
  }),
  case_sample_exit_progress: exitCase({
    caseId: 'case_sample_exit_progress',
    fullName: 'Sample Leaver',
    employeeCode: 'EMP101',
    stage: 'clearances_in_progress',
    lastWorkingDay: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
    clearances: { it: 'done', finance: 'pending', admin: 'pending', manager: 'done' },
  }),
  case_sample_exit_cleared: exitCase({
    caseId: 'case_sample_exit_cleared',
    fullName: 'Sample Employee',
    employeeCode: 'EMP102',
    stage: 'all_cleared',
    lastWorkingDay: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    clearances: { it: 'done', finance: 'done', admin: 'done', manager: 'done' },
  }),
  case_sample_exit_closed: exitCase({
    caseId: 'case_sample_exit_closed',
    fullName: 'Sample Closed Exit',
    employeeCode: 'EMP103',
    stage: 'closed',
    lastWorkingDay: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    clearances: { it: 'done', finance: 'done', admin: 'done', manager: 'done' },
  }),
};

const DUMMY_EMAILS: CaseEmailsResponse = {
  success: true,
  message: 'Dummy case emails (backend disconnected)',
  total: 0,
  limit: THREAD_LIMIT,
  offset: 0,
  data: [],
};

export const casesApi = {
  // --- Original backend-connected implementation (commented out, see dummy.md) ---
  // detail: async (caseId: string) =>
  //   (await axiosInstance.get<CaseDetailResponse>(`/api/cases/${caseId}`)).data.data,
  // update: async (caseId: string, payload: UpdateCaseRequest) =>
  //   (await axiosInstance.patch<CaseUpdateResponse>(`/api/cases/${caseId}`, payload)).data,
  // updateTask: async (taskId: string, payload: UpdateTaskRequest) =>
  //   (await axiosInstance.patch<TaskResponse>(`/api/tasks/${taskId}`, payload)).data,
  // signOff: async (caseId: string, payload: SignOffRequest) =>
  //   (await axiosInstance.post<SignOffResponse>(`/api/cases/${caseId}/sign-off`, payload)).data,
  // overrideChecklist: async (caseId: string, itemId: string, payload: ChecklistOverrideRequest) =>
  //   (
  //     await axiosInstance.patch<ChecklistOverrideResponse>(
  //       `/api/cases/${caseId}/checklist/${itemId}`,
  //       payload,
  //     )
  //   ).data,
  // releaseConfirm: async (caseId: string, payload: ReleaseConfirmRequest) =>
  //   (await axiosInstance.post<ReleaseConfirmResponse>(`/api/cases/${caseId}/release-confirm`, payload)).data,
  // planInduction: async (caseId: string, payload: PlanInductionRequest) =>
  //   (await axiosInstance.post<PlanInductionResponse>(`/api/cases/${caseId}/induction`, payload)).data,
  // uploadAppointmentLetter: async (caseId: string, file: FileAttachment) =>
  //   (await axiosInstance.post<AppointmentLetterResponse>(`/api/cases/${caseId}/appointment-letter`, file))
  //     .data,
  // bookSession: async (sessionId: string, payload: BookSessionRequest) =>
  //   (await axiosInstance.post<SessionResponse>(`/api/induction-sessions/${sessionId}/book`, payload)).data,
  // attachmentUrl: async (attachmentId: string) =>
  //   (await axiosInstance.get<DownloadUrlResponse>(`/api/attachments/${attachmentId}/download-url`)).data.data,
  // emails: async (caseId: string) =>
  //   (
  //     await axiosInstance.get<CaseEmailsResponse>(`/api/cases/${caseId}/emails`, {
  //       params: { limit: THREAD_LIMIT },
  //     })
  //   ).data,

  // --- DUMMY implementation ---
  detail: async (caseId: string): Promise<CaseDetailData> => {
    if (DUMMY_CASES[caseId]) return DUMMY_CASES[caseId];
    // Unknown id (e.g. a case just created in this dummy session): fall back to a
    // same-shaped case instead of always showing the onboarding joiner's data.
    if (caseId.includes('exit')) {
      return exitCase({
        caseId,
        fullName: 'New Leaver',
        employeeCode: 'EMP000',
        stage: 'clearance_requested',
        lastWorkingDay: new Date().toISOString(),
        clearances: { it: 'pending', finance: 'pending', admin: 'pending', manager: 'pending' },
      });
    }
    return DUMMY_CASE_DETAIL;
  },
  update: async (caseId: string, payload: UpdateCaseRequest): Promise<CaseUpdateResponse> => ({
    success: true,
    message: 'Dummy case updated (backend disconnected)',
    data: {
      ...DUMMY_CASE_DETAIL.case,
      case_id: caseId,
      status: payload.status ?? DUMMY_CASE_DETAIL.case.status,
      flags: payload.clear_flags ? [] : DUMMY_CASE_DETAIL.case.flags,
    },
  }),
  updateTask: async (taskId: string, payload: UpdateTaskRequest): Promise<TaskResponse> => ({
    success: true,
    message: 'Dummy task updated (backend disconnected)',
    data: {
      ...DUMMY_CASE_DETAIL.tasks[0],
      task_id: taskId,
      status: payload.status ?? DUMMY_CASE_DETAIL.tasks[0].status,
      sub_items: payload.sub_items ?? DUMMY_CASE_DETAIL.tasks[0].sub_items,
      progress_notes: payload.note ?? DUMMY_CASE_DETAIL.tasks[0].progress_notes,
    },
  }),
  signOff: async (caseId: string, _payload: SignOffRequest): Promise<SignOffResponse> => ({
    success: true,
    message: 'Dummy sign-off recorded (backend disconnected)',
    data: {
      case_id: caseId,
      stage: 'ready_for_signoff',
      person: DUMMY_CASE_DETAIL.person,
      it_task: DUMMY_CASE_DETAIL.tasks[0],
    },
  }),
  overrideChecklist: async (
    _caseId: string,
    itemId: string,
    payload: ChecklistOverrideRequest,
  ): Promise<ChecklistOverrideResponse> => ({
    success: true,
    message: 'Dummy checklist override saved (backend disconnected)',
    data: {
      checklist_item: {
        ...DUMMY_CASE_DETAIL.checklist[0],
        checklist_item_id: itemId,
        status: payload.status,
        notes: payload.note ?? null,
        attachment_id: payload.attachment_id ?? null,
      },
      case_stage: DUMMY_CASE_DETAIL.case.stage,
    },
  }),
  releaseConfirm: async (caseId: string, _payload: ReleaseConfirmRequest): Promise<ReleaseConfirmResponse> => ({
    success: true,
    message: 'Dummy release confirmed (backend disconnected)',
    data: { case_id: caseId, stage: 'closed', closed_at: new Date().toISOString() },
  }),
  planInduction: async (caseId: string, payload: PlanInductionRequest): Promise<PlanInductionResponse> => ({
    success: true,
    message: 'Dummy induction planned (backend disconnected)',
    data: { induction_case_id: `${caseId}_induction`, stage: 'docs_requested', track: payload.track ?? 'mid' },
  }),
  uploadAppointmentLetter: async (
    _caseId: string,
    file: FileAttachment,
  ): Promise<AppointmentLetterResponse> => ({
    success: true,
    message: 'Dummy appointment letter uploaded (backend disconnected)',
    data: {
      attachment_id: `att_dummy_${Date.now()}`,
      kind: 'appointment_letter',
      file_name: file.file_name,
      mime_type: file.mime_type,
      size: file.size,
      document_type_guess: 'appointment_letter',
      ai_confidence: 0.9,
      ocr_quality: 0.9,
      name_match_score: 1,
      person_check: 'match',
      check_status: 'verified',
      issues: [],
      is_latest: true,
      received_at: new Date().toISOString(),
    },
  }),
  bookSession: async (sessionId: string, payload: BookSessionRequest): Promise<SessionResponse> => ({
    success: true,
    message: 'Dummy session booked (backend disconnected)',
    data: {
      induction_session_id: sessionId,
      title: 'Dummy Induction Session',
      owner_email: 'hr@tcgdigital.com',
      proposed_start: payload.start,
      proposed_end: payload.end,
      agreed_start: payload.start,
      agreed_end: payload.end,
      status: 'booked',
      graph_event_id: null,
    },
  }),
  attachmentUrl: async (_attachmentId: string): Promise<DownloadUrlResponse['data']> => ({
    url: 'https://example.com/dummy-attachment.pdf',
    expires_in: 3600,
  }),
  emails: async (_caseId: string): Promise<CaseEmailsResponse> => DUMMY_EMAILS,
};

export const caseKeys = {
  all: ['cases'] as const,
  detail: (caseId: string) => [...caseKeys.all, 'detail', caseId] as const,
  emails: (caseId: string) => [...caseKeys.all, 'emails', caseId] as const,
};

const CASE_REFRESH_MS = 30_000;

export const caseDetailQuery = (caseId: string) =>
  queryOptions({
    queryKey: caseKeys.detail(caseId),
    queryFn: () => casesApi.detail(caseId),
    refetchInterval: CASE_REFRESH_MS,
  });

export const caseEmailsQuery = (caseId: string) =>
  queryOptions({
    queryKey: caseKeys.emails(caseId),
    queryFn: () => casesApi.emails(caseId),
    refetchInterval: CASE_REFRESH_MS,
  });
