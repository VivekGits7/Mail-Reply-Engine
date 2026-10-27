import { useQuery } from '@tanstack/react-query';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import type { CaseEmailsResponse } from '@/types';
import { EmailsPanel } from './EmailsPanel';

const THREADS: CaseEmailsResponse = {
  success: true,
  message: 'Found 1 email thread',
  total: 1,
  limit: 100,
  offset: 0,
  data: [
    {
      thread_id: 'conv-1',
      subject: 'Documents needed for Rahul Sharma',
      message_count: 2,
      last_at: '2026-10-26T10:50:00+00:00',
      messages: [
        {
          email_id: 'email-1',
          direction: 'outbound',
          from_name: null,
          from_email: 'hroperations@tcgdigital.com',
          to: ['recruiter@tcgdigital.com'],
          cc: ['rahul.sharma@gmail.com'],
          subject: 'Documents needed for Rahul Sharma',
          body: 'Please share the documents below.',
          at: '2026-10-26T10:00:00+00:00',
          case_id: 'case-1',
          case_type: 'onboarding',
          category: null,
          status: 'sent',
          is_dry_run: true,
          is_automatic: true,
          attachments: [],
        },
        {
          email_id: 'email-2',
          direction: 'inbound',
          from_name: 'Rahul Sharma',
          from_email: 'rahul.sharma@gmail.com',
          to: ['hroperations@tcgdigital.com'],
          cc: [],
          subject: 'Re: Documents needed for Rahul Sharma',
          body: 'Attaching my PAN card.',
          at: '2026-10-26T10:50:00+00:00',
          case_id: 'case-1',
          case_type: 'onboarding',
          category: 'doc_submission',
          status: 'processed',
          is_dry_run: false,
          is_automatic: false,
          attachments: [
            { attachment_id: 'file-1', file_name: 'PAN card.pdf', mime_type: 'application/pdf', size: 48213 },
          ],
        },
      ],
    },
  ],
};

function Harness({ response }: { response: CaseEmailsResponse }) {
  const query = useQuery({ queryKey: ['emails-test', response.total], queryFn: async () => response });
  return <EmailsPanel query={query} />;
}

describe('EmailsPanel', () => {
  it('shows the thread like a mail client and folds it away', async () => {
    renderWithProviders(<Harness response={THREADS} />);
    expect(await screen.findByText('Attaching my PAN card.')).toBeInTheDocument();
    expect(screen.getByText('HR Desk agent')).toBeInTheDocument();
    expect(screen.getByText('Dry run, delivered to the test inbox')).toBeInTheDocument();
    expect(screen.getByText('Documents sent')).toBeInTheDocument();
    expect(screen.getByText('PAN card.pdf')).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: /2 emails · 1 sent, 1 received/ }));
    expect(screen.queryByText('Attaching my PAN card.')).not.toBeInTheDocument();
  });

  it('explains when nothing has been emailed yet', async () => {
    renderWithProviders(<Harness response={{ ...THREADS, total: 0, data: [] }} />);
    expect(await screen.findByText('No emails with this person yet')).toBeInTheDocument();
  });
});
