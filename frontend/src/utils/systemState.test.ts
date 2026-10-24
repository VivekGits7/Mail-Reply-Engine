import { describe, expect, it } from 'vitest';
import { failureReason, mailboxSummary, sendingSummary, workLabel } from './systemState';

describe('sendingSummary', () => {
  it('puts the kill switch above everything else', () => {
    expect(sendingSummary({ kill_switch: true, dry_run: true, test_inbox: '' }).mode).toBe('stopped');
  });

  it('says emails are held when dry run has no test inbox', () => {
    const summary = sendingSummary({ kill_switch: false, dry_run: true, test_inbox: '' });
    expect(summary.mode).toBe('held');
    expect(summary.title).toBe('Every email is on hold');
  });

  it('names the test inbox in test mode and warns when live', () => {
    expect(sendingSummary({ kill_switch: false, dry_run: true, test_inbox: 'hr-test@tcgdigital.com' }).title).toContain(
      'hr-test@tcgdigital.com',
    );
    expect(sendingSummary({ kill_switch: false, dry_run: false, test_inbox: '' }).mode).toBe('live');
  });
});

describe('mailboxSummary', () => {
  it('explains polling only in plain words', () => {
    const summary = mailboxSummary('polling_only');
    expect(summary.label).toBe('Checked every 2 minutes');
    expect(summary.detail).toContain('nothing is missed');
  });

  it('flags a missing Microsoft connection', () => {
    expect(mailboxSummary('not_configured').tone).toBe('danger');
  });
});

describe('failureReason', () => {
  it('spots the Microsoft 365 sign-in failure', () => {
    const reason = failureReason('GraphException: Could not sign in to Microsoft Graph');
    expect(reason.cause).toBe('microsoft_login');
    expect(reason.fix).toContain('IT');
  });

  it('separates SMTP, template and unknown errors', () => {
    expect(failureReason('MailSendException: Could not sign in to the SMTP server').cause).toBe('smtp_login');
    expect(failureReason('TemplateRenderError: Template doc_request is missing or inactive').cause).toBe('template');
    expect(failureReason('KeyError: x').cause).toBe('unknown');
    expect(failureReason(null).cause).toBe('unknown');
  });
});

describe('workLabel', () => {
  it('turns event and job types into plain actions', () => {
    expect(workLabel('send_email')).toBe('Send an email');
    expect(workLabel('email.received')).toBe('Read an incoming email');
    expect(workLabel('brand.new_thing')).toBe('Brand new thing');
  });
});
