import { queryOptions } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { SendingMenuIndicator, SendingRailIndicator } from './SendingIndicator';

const data = vi.hoisted(() => ({ status: {} as Record<string, unknown> }));

vi.mock('@/components/admin/Adminapi', () => ({
  statusQuery: () => queryOptions({ queryKey: ['status'], queryFn: async () => data.status }),
  failuresQuery: () =>
    queryOptions({ queryKey: ['failures'], queryFn: async () => ({ total: 0, data: [] }) }),
}));

function setStatus(kill_switch: boolean, dry_run: boolean, test_inbox: string) {
  data.status = { kill_switch, dry_run, test_inbox };
}

describe('SendingRailIndicator', () => {
  it('shows dry run as a small icon and explains it on click', async () => {
    setStatus(false, true, 'hr-test@tcgdigital.com');
    renderWithProviders(<SendingRailIndicator />);

    await userEvent.setup().click(await screen.findByRole('button', { name: /^Dry run\./ }));
    expect(await screen.findByText(/every email goes to hr-test@tcgdigital.com/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open controls' })).toHaveAttribute('href', '/#admin-controls');
  });

  it('points to the test inbox when every email is on hold', async () => {
    setStatus(false, true, '');
    renderWithProviders(<SendingRailIndicator />);

    await userEvent.setup().click(await screen.findByRole('button', { name: /^On hold\./ }));
    expect(screen.getByRole('link', { name: 'Set test inbox' })).toHaveAttribute('href', '/#admin-controls');
  });

  it('stays hidden while emails go to real people', async () => {
    setStatus(false, false, '');
    const { queryClient } = renderWithProviders(<SendingRailIndicator />);

    await waitFor(() => expect(queryClient.getQueryState(['status'])?.status).toBe('success'));
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('SendingMenuIndicator', () => {
  it('links the phone menu row to the controls page', async () => {
    setStatus(true, true, 'hr-test@tcgdigital.com');
    renderWithProviders(<SendingMenuIndicator />);

    expect(await screen.findByRole('link', { name: /Sending is stopped/ })).toHaveAttribute(
      'href',
      '/#admin-controls',
    );
  });
});
