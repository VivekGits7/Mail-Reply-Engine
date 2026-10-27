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
  welcome_scheduled: { label: 'Welcome scheduled', tone: 'info' },
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
  processed: { label: 'Checked', tone: 'success' },
  restricted: { label: 'Restricted', tone: 'neutral' },
  duplicate: { label: 'Duplicate', tone: 'neutral' },
  skipped: { label: 'Not read', tone: 'neutral' },
};

const STAGE_HINTS: Record<string, string> = {
  docs_requested:
    'The agent emailed the recruiter and candidate for documents. It follows up until everything arrives.',
  docs_in_progress: 'Some documents arrived. The agent checks each one and keeps chasing the missing ones.',
  ready_for_signoff:
    'Every required document is verified. Review the checklist, then sign off to send the IT request.',
  it_requested: 'IT was asked for the work email and D365 access. The agent follows up until IT replies.',
  dropout: 'Documents were still missing after the last reminder, so the agent stopped chasing.',
  clearance_requested: 'Each team was asked for exit clearance. The agent follows up until each one is done.',
  clearances_in_progress: 'Some teams have cleared. The agent keeps chasing the rest.',
  all_cleared: 'Every team has cleared. Confirm release to close the exit.',
  drafting: 'The agent is drafting the induction plan. It shows up in Approvals when ready.',
  awaiting_approval: 'The induction plan is waiting in Approvals.',
  booking: 'Session owners were asked to confirm their times. Replies book the calendar invites.',
  booked: 'Every session is booked.',
  welcome_scheduled: 'The welcome email goes out on the joining day.',
  welcome_sent: 'The welcome email was sent.',
};

export function stageHint(stage?: string | null): string | undefined {
  return stage ? STAGE_HINTS[stage] : undefined;
}

export const EMAIL_CATEGORY_LABELS: Record<string, string> = {
  doc_submission: 'Documents sent',
  it_setup_reply: 'IT setup reply',
  availability_reply: 'Availability reply',
  clearance_update: 'Clearance update',
  reminder_response: 'Reminder reply',
  query: 'Question',
  complaint: 'Complaint',
  unrelated: 'Not related',
};

export const HIRE_CATEGORY_LABELS: Record<string, string> = {
  campus: 'Campus',
  lateral: 'Lateral',
};

export const TRACK_LABELS: Record<string, string> = {
  campus: 'Campus',
  mid: 'Mid-level',
  senior: 'Senior',
};

export const ACTOR_LABELS: Record<string, string> = {
  agent: 'Agent',
  user: 'Admin',
  system: 'System',
  candidate: 'Candidate',
  recruiter: 'Recruiter',
  manager: 'Manager',
  external: 'Someone else',
};

export const SOURCE_LABELS: Record<string, string> = {
  email: 'Email',
  exit_interview: 'Exit interview',
  hr_connect: 'HR Connect',
};

export function labelFrom(labels: Record<string, string>, value?: string | null): string {
  if (!value) return '—';
  return labels[value] ?? value.replace(/[_.-]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

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
  return (
    DOCUMENT_LABELS[documentType] ?? documentType.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
  );
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
  return (
    STATUS_LABELS[value] ?? {
      label: value.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()),
      tone: 'neutral',
    }
  );
}

export function flagLabel(flag: string): string {
  return FLAG_LABELS[flag] ?? flag.replace(/_/g, ' ');
}

export function optionsFrom<T extends Record<string, string>>(
  values: T,
  labels: Record<string, string> = {},
) {
  return Object.values(values).map((value) => ({ value, label: labels[value] ?? statusLabel(value).label }));
}
