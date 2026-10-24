import type { StatusData } from '@/types';
import type { Tone } from './labels';

export type SendingMode = 'stopped' | 'held' | 'test' | 'live';

export interface SendingSummary {
  mode: SendingMode;
  tone: Tone;
  title: string;
  detail: string;
}

export function sendingSummary(status: Pick<StatusData, 'kill_switch' | 'dry_run' | 'test_inbox'>): SendingSummary {
  if (status.kill_switch) {
    return {
      mode: 'stopped',
      tone: 'danger',
      title: 'Sending is stopped',
      detail:
        'The kill switch is on. The agent still reads mail and queues replies, but nothing goes out until an admin allows sending.',
    };
  }
  if (status.dry_run && !status.test_inbox) {
    return {
      mode: 'held',
      tone: 'danger',
      title: 'Every email is on hold',
      detail:
        'Dry run is on but no test inbox is set, so the agent has nowhere safe to send. Emails wait until a test inbox is added on Controls.',
    };
  }
  if (status.dry_run) {
    return {
      mode: 'test',
      tone: 'warning',
      title: `Test mode, every email goes to ${status.test_inbox}`,
      detail:
        'Dry run is on. Candidates, recruiters and teams get nothing. Each test email lists its real recipients in the subject line.',
    };
  }
  return {
    mode: 'live',
    tone: 'success',
    title: 'Live, emails go to real people',
    detail: 'Dry run is off. Candidates, recruiters and teams receive the agent’s emails directly.',
  };
}

export interface MailboxSummary {
  label: string;
  tone: Tone;
  detail: string;
}

export function mailboxSummary(subscription?: string | null): MailboxSummary {
  switch (subscription) {
    case 'active':
      return {
        label: 'Instant',
        tone: 'success',
        detail: 'Microsoft 365 tells the agent about new mail as it arrives. The mailbox is also checked every 2 minutes.',
      };
    case 'polling_only':
      return {
        label: 'Checked every 2 minutes',
        tone: 'info',
        detail:
          'Instant notifications need a public HTTPS address, which is not set up yet. The agent checks the mailbox every 2 minutes instead, so nothing is missed.',
      };
    case 'expired':
      return {
        label: 'Checked every 2 minutes',
        tone: 'warning',
        detail:
          'The instant notification link expired. The agent renews it on its own and checks the mailbox every 2 minutes meanwhile.',
      };
    case 'not_configured':
      return {
        label: 'Not connected',
        tone: 'danger',
        detail:
          'Microsoft 365 is not connected, so the agent cannot read the mailbox. IT needs to add the Microsoft Graph app details on the server.',
      };
    default:
      return { label: 'Unknown', tone: 'neutral', detail: 'The mailbox connection state is not known yet.' };
  }
}

export type FailureCause =
  | 'microsoft_login'
  | 'microsoft_missing'
  | 'microsoft_down'
  | 'smtp_missing'
  | 'smtp_login'
  | 'smtp_recipient'
  | 'send_failed'
  | 'template'
  | 'privacy'
  | 'timeout'
  | 'internal'
  | 'unknown';

export interface FailureReason {
  cause: FailureCause;
  title: string;
  fix: string;
}

const FAILURE_RULES: { test: RegExp; reason: FailureReason }[] = [
  {
    test: /sign in to microsoft graph/i,
    reason: {
      cause: 'microsoft_login',
      title: 'Microsoft 365 sign-in failed',
      fix: 'IT needs to check the app registration client ID, secret and tenant on the server. Retry once it is fixed.',
    },
  },
  {
    test: /microsoft graph is not configured/i,
    reason: {
      cause: 'microsoft_missing',
      title: 'Microsoft 365 is not connected',
      fix: 'IT needs to add the Microsoft Graph app details on the server. Retry once they are added.',
    },
  },
  {
    test: /graph|microsoft/i,
    reason: {
      cause: 'microsoft_down',
      title: 'Microsoft 365 did not respond',
      fix: 'This is usually temporary. Retry in a few minutes.',
    },
  },
  {
    test: /smtp is not configured/i,
    reason: {
      cause: 'smtp_missing',
      title: 'The email server is not set up',
      fix: 'IT needs to add the SMTP settings on the server. Retry once they are added.',
    },
  },
  {
    test: /sign in to the smtp server/i,
    reason: {
      cause: 'smtp_login',
      title: 'Email server sign-in failed',
      fix: 'IT needs to check the SMTP username and password. Retry once it is fixed.',
    },
  },
  {
    test: /refused the recipients/i,
    reason: {
      cause: 'smtp_recipient',
      title: 'The email server refused an address',
      fix: 'Check the recipient on the case, or the team address in Settings, then retry.',
    },
  },
  {
    test: /mailsend/i,
    reason: {
      cause: 'send_failed',
      title: 'The email could not be sent',
      fix: 'Retry. If it fails again, ask IT to check the mail server.',
    },
  },
  {
    test: /template|placeholder/i,
    reason: {
      cause: 'template',
      title: 'Email template problem',
      fix: 'A template is missing a value or is turned off. Fix it in Email templates, then retry.',
    },
  },
  {
    test: /piiguard|mask/i,
    reason: {
      cause: 'privacy',
      title: 'Stopped to protect personal data',
      fix: 'The text could not be masked safely before reaching the AI. Ask IT to check the server logs.',
    },
  },
  {
    test: /timeout|timed out/i,
    reason: { cause: 'timeout', title: 'It took too long', fix: 'Retry. It usually works the second time.' },
  },
  {
    test: /no handler|no composer/i,
    reason: { cause: 'internal', title: 'Internal setup problem', fix: 'Ask IT to check the server logs before retrying.' },
  },
];

export function failureReason(lastError?: string | null): FailureReason {
  const match = lastError ? FAILURE_RULES.find((rule) => rule.test.test(lastError)) : undefined;
  return (
    match?.reason ?? {
      cause: 'unknown',
      title: 'Unexpected error',
      fix: 'Retry once. If it fails again, share the error text with IT.',
    }
  );
}

const WORK_LABELS: Record<string, string> = {
  'email.received': 'Read an incoming email',
  'job.due': 'Run a scheduled job',
  'documents.check': 'Check a document',
  'it.completed': 'Finish IT setup',
  'induction.draft': 'Draft an induction plan',
  'approval.approved': 'Send an approved draft',
  'approval.rejected': 'Close a rejected draft',
  'task.updated': 'Update a task',
  'case.reopened': 'Reopen a case',
  'feedback.report': 'Build the feedback report',
  send_email: 'Send an email',
};

export function workLabel(type: string): string {
  return WORK_LABELS[type] ?? type.replace(/[_.]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export const FAILURE_KIND_LABELS: Record<string, string> = {
  event: 'Event',
  job: 'Scheduled job',
};
