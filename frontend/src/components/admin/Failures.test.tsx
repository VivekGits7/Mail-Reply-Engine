import { queryOptions } from '@tanstack/react-query';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setCredentials } from '@/redux/authSlice';
import { store } from '@/redux/store';
import { renderWithProviders } from '@/test/render';
import Failures from './Failures';

const api = vi.hoisted(() => ({ items: [] as Record<string, unknown>[], retryFailure: vi.fn() }));

vi.mock('./Adminapi', () => ({
  adminKeys: { status: ['admin', 'status'] },
  failuresQuery: () =>
    queryOptions({
      queryKey: ['admin', 'failures'],
      queryFn: async () => ({ total: api.items.length, limit: 25, offset: 0, data: api.items }),
    }),
  adminApi: { retryFailure: api.retryFailure },
}));
vi.mock('@/utils/toast', () => ({ showToast: { success: vi.fn(), error: vi.fn() } }));

const SIGN_IN_FAILURE = {
  failure_id: 'f1',
  kind: 'job',
  event_type: 'send_email',
  case_id: 'case-1',
  attempts: 5,
  last_error: 'GraphException: Could not sign in to Microsoft Graph',
  updated_at: '2026-10-22T12:00:00+05:30',
};

describe('Failures', () => {
  beforeEach(() => {
    store.dispatch(
      setCredentials({
        token: 't',
        user: { user_id: 'u1', name: 'TCG User', email: 'tcg@tcgdigital.com', role: 'hr_admin', complaints_access: false, is_active: true },
      }),
    );
    api.items = [];
    api.retryFailure.mockReset().mockResolvedValue({ data: { status: 'queued' } });
  });

  it('explains a Microsoft sign-in failure in plain words', async () => {
    api.items = [SIGN_IN_FAILURE];
    renderWithProviders(<Failures />);
    expect(
      await screen.findByText('Emails are not going out because the Microsoft 365 sign-in is failing'),
    ).toBeInTheDocument();
    const row = screen.getByRole('row', { name: /Send an email/ });
    expect(within(row).getByText('Microsoft 365 sign-in failed')).toBeInTheDocument();
    expect(within(row).getByText('Scheduled job')).toBeInTheDocument();
    expect(within(row).getByText(SIGN_IN_FAILURE.last_error)).toBeInTheDocument();
    expect(within(row).getByRole('link', { name: 'Open case' })).toHaveAttribute('href', '/cases/case-1');
  });

  it('asks before retrying', async () => {
    const user = userEvent.setup();
    api.items = [SIGN_IN_FAILURE];
    renderWithProviders(<Failures />);
    await user.click(await screen.findByRole('button', { name: 'Retry Send an email' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Run this again?' });
    await user.click(within(dialog).getByRole('button', { name: 'Retry' }));
    await vi.waitFor(() => expect(api.retryFailure).toHaveBeenCalledWith('f1', 'job'));
  });

  it('says what the page is for when nothing has failed', async () => {
    renderWithProviders(<Failures />);
    expect(await screen.findByText('Nothing has failed')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
