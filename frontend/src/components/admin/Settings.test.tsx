import { queryOptions } from '@tanstack/react-query';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setCredentials } from '@/redux/authSlice';
import { store } from '@/redux/store';
import { renderWithProviders } from '@/test/render';
import Settings from './Settings';

const updateSettings = vi.hoisted(() => vi.fn());
const ITEMS = [
  { key: 'kill_switch', value: false, description: 'Stops every outgoing email' },
  { key: 'max_followups', value: 3, description: 'Follow-ups before one escalation and stop' },
  { key: 'sending_days', value: [0, 1, 2, 3, 4], description: 'Weekdays mail can go out' },
  { key: 'sending_start', value: '09:00', description: 'Start of the daily sending window' },
  { key: 'document_reading_enabled', value: false, description: 'Reads document content' },
  { key: 'survey_levels', value: ['L1', 'L2'], description: 'Levels that get surveys' },
  { key: 'contacts', value: { it_team: '', hr_owner: 'hr@tcgdigital.com' }, description: 'Team mailboxes' },
];
vi.mock('./Adminapi', () => ({
  adminKeys: { all: ['admin'], settings: ['admin', 'settings'] },
  settingsQuery: () => queryOptions({ queryKey: ['admin', 'settings'], queryFn: async () => ITEMS }),
  adminApi: { updateSettings, uploadStatement: vi.fn() },
}));
vi.mock('@/utils/toast', () => ({ showToast: { success: vi.fn(), error: vi.fn() } }));

function rowOf(label: string) {
  return screen.getByText(label, { selector: 'label' }).closest('form') as HTMLElement;
}

describe('Settings', () => {
  beforeEach(() => {
    updateSettings.mockReset();
    updateSettings.mockResolvedValue({ data: [] });
    store.dispatch(
      setCredentials({
        token: 't',
        user: {
          user_id: 'u1',
          name: 'TCG User',
          email: 'tcg@tcgdigital.com',
          role: 'hr_admin',
          complaints_access: false,
          is_active: true,
        },
      }),
    );
  });

  it('shows typed editors and keeps sending controls off this screen', async () => {
    renderWithProviders(<Settings />);
    expect(await screen.findByText('Max followups')).toBeInTheDocument();
    expect(screen.queryByText('Kill switch')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Sending start')).toHaveAttribute('role', 'combobox');
    expect(screen.getByLabelText('Sending start')).toHaveTextContent('09:00');
    expect(screen.getByLabelText('Survey levels')).toHaveValue('L1, L2');
    expect(screen.getByLabelText('HR owner')).toHaveValue('hr@tcgdigital.com');
  });

  it('saves weekday picks as numbers and toggles switches right away', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Settings />);
    await screen.findByText('Sending days');
    await user.click(screen.getByLabelText('Sat'));
    await user.click(within(rowOf('Sending days')).getByRole('button', { name: 'Save' }));
    expect(updateSettings).toHaveBeenCalledWith({ sending_days: [0, 1, 2, 3, 4, 5] });

    await user.click(screen.getByRole('switch', { name: 'Document reading enabled' }));
    expect(updateSettings).toHaveBeenCalledWith({ document_reading_enabled: true });
  });

  it('names empty team addresses and explains each contact', async () => {
    renderWithProviders(<Settings />, ['/admin/settings#teams-and-integrations']);
    expect(await screen.findByText(/1 team address is empty: IT team\./)).toBeInTheDocument();
    expect(screen.getByLabelText('IT team')).toHaveAccessibleDescription(
      'Gets the email ID and D365 request for joiners, and IT exit clearance',
    );
    expect(document.getElementById('teams-and-integrations')).not.toBeNull();
  });

  it('tells viewers they can only look', async () => {
    store.dispatch(
      setCredentials({
        token: 't',
        user: {
          user_id: 'u2',
          name: 'Viewer',
          email: 'viewer@tcgdigital.com',
          role: 'hr_viewer',
          complaints_access: false,
          is_active: true,
        },
      }),
    );
    renderWithProviders(<Settings />);
    expect(await screen.findByLabelText('Max followups')).toBeDisabled();
    expect(
      screen.getByText('You can see every setting. Only HR admins can change them.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('saves numbers as numbers', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Settings />);
    const field = await screen.findByLabelText('Max followups');
    await user.clear(field);
    await user.type(field, '4');
    await user.click(within(rowOf('Max followups')).getByRole('button', { name: 'Save' }));
    expect(updateSettings).toHaveBeenCalledWith({ max_followups: 4 });
  });
});
