import { screen } from '@testing-library/react';
import { queryOptions } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import Overview from './Overview';

vi.mock('@/components/approvals/Approvalsapi', () => ({
  approvalListQuery: () =>
    queryOptions({
      queryKey: ['approvals'],
      queryFn: async () => ({ total: 1, data: [{ approval_id: 'approval-1', summary: 'Review IT reply' }] }),
    }),
}));
vi.mock('@/components/joiners/Joinersapi', () => ({
  joinerListQuery: () =>
    queryOptions({
      queryKey: ['joiners'],
      queryFn: async () => ({
        total: 1,
        data: [{ case_id: 'case-1', full_name: 'TCG User', stage: 'docs_requested', joining_date: null }],
      }),
    }),
}));
vi.mock('@/components/exits/Exitsapi', () => ({
  exitListQuery: () => queryOptions({ queryKey: ['exits'], queryFn: async () => ({ total: 0, data: [] }) }),
}));

describe('Overview', () => {
  it('shows live counts and links to the work waiting for HR', async () => {
    renderWithProviders(<Overview />);
    expect(await screen.findByRole('link', { name: 'Review IT reply' })).toHaveAttribute(
      'href',
      '/approvals/approval-1',
    );
    expect(screen.getByRole('link', { name: /TCG User/ })).toHaveAttribute('href', '/cases/case-1');
    expect(screen.queryByText('No joiner cases yet.')).not.toBeInTheDocument();
  });
});
