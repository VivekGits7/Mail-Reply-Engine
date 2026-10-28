import { screen, within } from '@testing-library/react';
import { queryOptions } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setCredentials } from '@/redux/authSlice';
import { store } from '@/redux/store';
import { renderWithProviders } from '@/test/render';
import Overview from './Overview';

const data = vi.hoisted(() => ({
  status: {} as Record<string, unknown>,
  contacts: {} as Record<string, string>,
  joiners: [] as Record<string, unknown>[],
}));

vi.mock('@/components/approvals/Approvalsapi', () => ({
  approvalListQuery: () =>
    queryOptions({
      queryKey: ['approvals'],
      queryFn: async () => ({ total: 1, data: [{ approval_id: 'approval-1', summary: 'Review IT reply' }] }),
    }),
}));
vi.mock('@/components/joiners/Joinersapi', () => ({
  joinerKeys: { all: ['joiners'] },
  joinersApi: { create: vi.fn() },
  joinerListQuery: (params: Record<string, unknown>) =>
    queryOptions({
      queryKey: ['joiners', params],
      queryFn: async () => ({ total: data.joiners.length, data: data.joiners }),
    }),
}));
vi.mock('@/components/exits/Exitsapi', () => ({
  exitListQuery: () => queryOptions({ queryKey: ['exits'], queryFn: async () => ({ total: 0, data: [] }) }),
}));
vi.mock('@/components/admin/Adminapi', () => ({
  statusQuery: () => queryOptions({ queryKey: ['status'], queryFn: async () => data.status }),
  settingsQuery: () =>
    queryOptions({
      queryKey: ['settings'],
      queryFn: async () => [{ key: 'contacts', value: data.contacts, description: 'Team and owner mailboxes' }],
    }),
  failuresQuery: () => queryOptions({ queryKey: ['failures'], queryFn: async () => ({ total: 2, data: [] }) }),
}));

const STATUS = {
  kill_switch: false,
  dry_run: true,
  test_inbox: '',
  document_reading_enabled: false,
  d365_enabled: false,
  mailbox: { subscription: 'polling_only' },
  queue: { queued: 0, processing: 0, failed: 0, pending_jobs: 4 },
};

function signIn(role: 'hr_admin' | 'hr_viewer') {
  store.dispatch(
    setCredentials({
      token: 't',
      user: { user_id: 'u1', name: 'TCG User', email: 'tcg@tcgdigital.com', role, complaints_access: false, is_active: true },
    }),
  );
}

describe('Overview', () => {
  beforeEach(() => {
    signIn('hr_admin');
    data.status = { ...STATUS };
    data.contacts = { it_team: '', finance_team: '', training_team: '' };
    data.joiners = [];
  });

  it('shows live counts and links to the work waiting for HR', async () => {
    data.joiners = [{ case_id: 'case-1', full_name: 'TCG User', stage: 'docs_requested', joining_date: null }];
    renderWithProviders(<Overview />);
    expect(await screen.findByRole('link', { name: 'Review IT reply' })).toHaveAttribute(
      'href',
      '/approvals/approval-1',
    );
    expect(screen.getByRole('link', { name: /TCG User/ })).toHaveAttribute('href', '/cases/case-1');
    expect(screen.getByRole('link', { name: /Ready for sign-off/ })).toHaveAttribute('href', '/#joiners');
    expect(screen.queryByText(/No joiners yet/)).not.toBeInTheDocument();
  });

  it('guides a new admin through setup with real data', async () => {
    renderWithProviders(<Overview />);
    const setup = await screen.findByRole('region', { name: 'Finish setup before the agent emails anyone' });
    expect(within(setup).getByText('0 of 3 done')).toBeInTheDocument();
    expect(within(setup).getByRole('link', { name: 'Set test inbox' })).toHaveAttribute('href', '/#admin-controls');
    expect(within(setup).getByRole('link', { name: 'Add addresses' })).toHaveAttribute(
      'href',
      '/#teams-and-integrations',
    );
    expect(within(setup).getByText(/2 of 2 addresses are empty/)).toBeInTheDocument();
    expect(within(setup).getByRole('button', { name: 'Add joiner' })).toBeInTheDocument();
  });

  it('explains that every email is held when dry run has no test inbox', async () => {
    renderWithProviders(<Overview />);
    expect(await screen.findByRole('heading', { name: 'Every email is on hold' })).toBeInTheDocument();
    expect(screen.getByText('Checked every 2 minutes')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See why' })).toHaveAttribute('href', '/#admin-failures');
  });

  it('hides the setup list once every step is done', async () => {
    data.status = { ...STATUS, test_inbox: 'hr-test@tcgdigital.com' };
    data.contacts = { it_team: 'it@tcgdigital.com', finance_team: 'finance@tcgdigital.com', training_team: '' };
    data.joiners = [{ case_id: 'case-1', full_name: 'Rahul Sharma', stage: 'docs_requested', joining_date: null }];
    renderWithProviders(<Overview />);
    expect(await screen.findByRole('heading', { name: /Test mode/ })).toBeInTheDocument();
    expect(screen.queryByText('Finish setup before the agent emails anyone')).not.toBeInTheDocument();
  });

  it('tells a viewer that an admin finishes setup', async () => {
    signIn('hr_viewer');
    renderWithProviders(<Overview />);
    const setup = await screen.findByRole('region', { name: 'Finish setup before the agent emails anyone' });
    expect(within(setup).getByText(/An HR admin needs to finish these steps/)).toBeInTheDocument();
    expect(within(setup).queryByRole('button', { name: 'Add joiner' })).not.toBeInTheDocument();
    expect(within(setup).getByRole('link', { name: 'View controls' })).toBeInTheDocument();
  });
});
