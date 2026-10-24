import { queryOptions } from '@tanstack/react-query';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setCredentials } from '@/redux/authSlice';
import { store } from '@/redux/store';
import { renderWithProviders } from '@/test/render';
import Controls from './Controls';

const api = vi.hoisted(() => ({
  status: {} as Record<string, unknown>,
  killSwitch: vi.fn(),
  dryRun: vi.fn(),
}));

vi.mock('./Adminapi', () => ({
  adminKeys: { status: ['admin', 'status'] },
  statusQuery: () => queryOptions({ queryKey: ['admin', 'status'], queryFn: async () => api.status }),
  failuresQuery: () => queryOptions({ queryKey: ['failures'], queryFn: async () => ({ total: 0, data: [] }) }),
  adminApi: { killSwitch: api.killSwitch, dryRun: api.dryRun },
}));
vi.mock('@/utils/toast', () => ({ showToast: { success: vi.fn(), error: vi.fn() } }));

const STATUS = {
  kill_switch: false,
  dry_run: true,
  test_inbox: 'hr-test@tcgdigital.com',
  document_reading_enabled: false,
  d365_enabled: false,
  mailbox: { subscription: 'polling_only', last_poll_at: null, last_email_at: null },
  queue: { queued: 0, processing: 0, failed: 0, pending_jobs: 0 },
};

function signIn(role: 'hr_admin' | 'hr_viewer') {
  store.dispatch(
    setCredentials({
      token: 't',
      user: { user_id: 'u1', name: 'TCG User', email: 'tcg@tcgdigital.com', role, complaints_access: false, is_active: true },
    }),
  );
}

describe('Controls', () => {
  beforeEach(() => {
    signIn('hr_admin');
    api.status = { ...STATUS };
    api.killSwitch.mockReset().mockResolvedValue({ data: { kill_switch: true } });
    api.dryRun.mockReset().mockResolvedValue({ data: { dry_run: true, test_inbox: 'hr-test@tcgdigital.com' } });
  });

  it('asks before stopping all sending', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Controls />);
    await user.click(await screen.findByRole('button', { name: 'Stop sending' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Stop all sending?' });
    expect(api.killSwitch).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Stop sending' }));
    await vi.waitFor(() => expect(api.killSwitch).toHaveBeenCalledWith({ enabled: true, reason: null }));
  });

  it('asks before allowing sending again and says where held mail goes', async () => {
    const user = userEvent.setup();
    api.status = { ...STATUS, kill_switch: true };
    renderWithProviders(<Controls />);
    await user.click(await screen.findByRole('button', { name: 'Allow sending' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Allow sending again?' });
    expect(within(dialog).getByText(/go to the test inbox hr-test@tcgdigital.com/)).toBeInTheDocument();
  });

  it('warns that mail is held without a test inbox and validates the address', async () => {
    const user = userEvent.setup();
    api.status = { ...STATUS, test_inbox: '' };
    renderWithProviders(<Controls />);
    expect(await screen.findByText(/No test inbox is set, so every email is on hold/)).toBeInTheDocument();
    const field = screen.getByLabelText('Test inbox');
    await user.type(field, 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Save test inbox' }));
    expect(await screen.findByText('Enter an email address like hr-test@tcgdigital.com')).toBeInTheDocument();
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(api.dryRun).not.toHaveBeenCalled();

    await user.clear(field);
    await user.type(field, ' HR-Test@tcgdigital.com ');
    await user.click(screen.getByRole('button', { name: 'Save test inbox' }));
    await vi.waitFor(() =>
      expect(api.dryRun).toHaveBeenCalledWith({ enabled: true, test_inbox: 'hr-test@tcgdigital.com' }),
    );
  });

  it('shows viewers the state without any switches', async () => {
    signIn('hr_viewer');
    renderWithProviders(<Controls />);
    expect(await screen.findByText(/Only HR admins can change these switches/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Stop sending' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Test inbox')).not.toBeInTheDocument();
  });
});
