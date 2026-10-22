export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

interface Label {
  label: string;
  tone: Tone;
}

const STATUS_LABELS: Record<string, Label> = {
  docs_requested: { label: 'Docs requested', tone: 'info' },
  docs_in_progress: { label: 'Docs in progress', tone: 'info' },
  ready_for_signoff: { label: 'Ready for sign-off', tone: 'warning' },
  it_requested: { label: 'IT requested', tone: 'info' },
  dropout: { label: 'Dropout', tone: 'danger' },
  clearance_requested: { label: 'Clearance requested', tone: 'info' },
  clearances_in_progress: { label: 'Clearances in progress', tone: 'info' },
  all_cleared: { label: 'All cleared', tone: 'warning' },
  drafting: { label: 'Drafting', tone: 'info' },
  awaiting_approval: { label: 'Awaiting approval', tone: 'warning' },
  booking: { label: 'Booking', tone: 'info' },
  booked: { label: 'Booked', tone: 'success' },
  welcome_sent: { label: 'Welcome sent', tone: 'success' },
  open: { label: 'Open', tone: 'info' },
  on_hold: { label: 'On hold', tone: 'warning' },
  closed: { label: 'Closed', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  partial: { label: 'Partial', tone: 'info' },
  done: { label: 'Done', tone: 'success' },
  blocked: { label: 'Blocked', tone: 'danger' },
  not_applicable: { label: 'Not applicable', tone: 'neutral' },
  escalated: { label: 'Escalated', tone: 'danger' },
  paused: { label: 'Paused', tone: 'warning' },
  pending: { label: 'Pending', tone: 'warning' },
  received: { label: 'Received', tone: 'info' },
  verified: { label: 'Verified', tone: 'success' },
  unreadable: { label: 'Unreadable', tone: 'danger' },
  wrong_type: { label: 'Wrong type', tone: 'danger' },
  name_mismatch: { label: 'Name mismatch', tone: 'danger' },
  approved: { label: 'Approved', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'neutral' },
  sent: { label: 'Sent', tone: 'success' },
  responded: { label: 'Responded', tone: 'success' },
  no_response: { label: 'No response', tone: 'warning' },
  queued: { label: 'Queued', tone: 'info' },
  ready: { label: 'Ready', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  flagged: { label: 'Needs attention', tone: 'warning' },
  proposed: { label: 'Proposed', tone: 'neutral' },
  asked: { label: 'Asked', tone: 'info' },
  agreed: { label: 'Agreed', tone: 'success' },
  alternative: { label: 'Alternative offered', tone: 'warning' },
  no_reply: { label: 'No reply', tone: 'warning' },
  conflict: { label: 'Conflict', tone: 'danger' },
  match: { label: 'Name matches', tone: 'success' },
  mismatch: { label: 'Name mismatch', tone: 'danger' },
  not_found: { label: 'Name not found', tone: 'warning' },
  active: { label: 'Active', tone: 'success' },
  inactive: { label: 'Inactive', tone: 'neutral' },
};

export const FLAG_LABELS: Record<string, string> = {
  dropout_risk: 'Dropout risk',
  name_mismatch: 'Name mismatch',
  sender_not_recognised: 'Unknown sender',
  salary_document: 'Salary document',
  failed_action: 'Failed action',
  appointment_letter_missing: 'Letter missing',
  induction_no_reply: 'No induction reply',
  calendar_conflict: 'Calendar conflict',
  needs_hr: 'Needs HR',
};

export const TASK_TYPE_LABELS: Record<string, string> = {
  doc_collection: 'Document collection',
  it_setup: 'IT setup',
  send_credentials: 'Send credentials',
  clearance_it: 'IT clearance',
  clearance_finance: 'Finance clearance',
  clearance_admin: 'Admin clearance',
  clearance_manager: 'Manager clearance',
  induction_availability: 'Induction availability',
  survey_response: 'Survey response',
  reminder: 'Reminder',
};

export const TEAM_LABELS: Record<string, string> = {
  it: 'IT',
  finance: 'Finance',
  admin: 'Admin',
  manager: 'Manager',
};

export const DOCUMENT_LABELS: Record<string, string> = {
  pan_card: 'PAN card',
  aadhaar_card: 'Aadhaar card',
  passport_photo: 'Passport size photo',
  class_10_certificate: 'Class 10 certificate',
  class_12_certificate: 'Class 12 certificate',
  degree_certificate: 'Degree certificate',
  marksheets: 'Marksheets',
  relieving_letter: 'Relieving letter',
  experience_letter: 'Experience letter',
  resume: 'Resume',
};

export function documentLabel(documentType: string): string {
  return DOCUMENT_LABELS[documentType] ?? documentType.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export const DATA_SOURCE_LABELS: Record<string, string> = {
  upload: 'Upload',
  d365: 'D365',
  test: 'Test',
};

export const CASE_TYPE_LABELS: Record<string, string> = {
  onboarding: 'Onboarding',
  exit: 'Exit',
  induction: 'Induction',
  feedback: 'Feedback',
};

export function statusLabel(value?: string | null): Label {
  if (!value) return { label: '—', tone: 'neutral' };
  return STATUS_LABELS[value] ?? { label: value.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()), tone: 'neutral' };
}

export function flagLabel(flag: string): string {
  return FLAG_LABELS[flag] ?? flag.replace(/_/g, ' ');
}

export function optionsFrom<T extends Record<string, string>>(values: T, labels: Record<string, string> = {}) {
  return Object.values(values).map((value) => ({ value, label: labels[value] ?? statusLabel(value).label }));
}
