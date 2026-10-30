import { screen, within } from '@testing-library/react';
import { queryOptions } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import Overview from './Overview';

const data = vi.hoisted(() => ({ approvals: 3, signOff: 2, release: 1, failures: 4, error: false }));

vi.mock('@/components/approvals/Approvalsapi', () => ({
  approvalListQuery: () =>
    queryOptions({
      queryKey: ['approvals'],
      queryFn: async () => {
        if (data.error) throw new Error('Server unavailable');
        return { total: data.approvals, data: [] };
      },
    }),
}));
vi.mock('@/components/joiners/Joinersapi', () => ({
  joinerListQuery: (params: Record<string, unknown>) =>
    queryOptions({
      queryKey: ['joiners', params],
      queryFn: async () => ({ total: data.signOff, data: [] }),
    }),
}));
vi.mock('@/components/exits/Exitsapi', () => ({
  exitListQuery: () =>
    queryOptions({
      queryKey: ['exits'],
      queryFn: async () => ({ total: data.release, data: [] }),
    }),
}));
vi.mock('@/components/admin/Adminapi', () => ({
  failuresQuery: () =>
    queryOptions({
      queryKey: ['failures'],
      queryFn: async () => ({ total: data.failures, data: [] }),
    }),
}));

describe('Overview', () => {
  beforeEach(() => {
    Object.assign(data, { approvals: 3, signOff: 2, release: 1, failures: 4, error: false });
  });

  it('shows server totals and links to the corresponding work', async () => {
    renderWithProviders(<Overview />);
    for (const [title, count, href] of [
      ['Drafts to review', '3', '/#approvals'],
      ['Ready for sign-off', '2', '/#joiners'],
      ['Ready for release', '1', '/#exits'],
      ['Failed work', '4', '/#admin-failures'],
    ]) {
      const tile = await screen.findByRole('link', { name: new RegExp(title) });
      expect(await within(tile).findByText(count)).toBeInTheDocument();
      expect(tile).toHaveAttribute('href', href);
    }
  });

  it('shows zero totals without adding sample records', async () => {
    Object.assign(data, { approvals: 0, signOff: 0, release: 0, failures: 0 });
    renderWithProviders(<Overview />);
    expect(await screen.findAllByText('0')).toHaveLength(4);
    expect(screen.queryByText(/Sample/)).not.toBeInTheDocument();
  });

  it('marks a failed count unavailable while other totals remain visible', async () => {
    data.error = true;
    renderWithProviders(<Overview />);
    const approvals = screen.getByRole('link', { name: /Drafts to review/ });
    expect(await within(approvals).findByText('Unavailable')).toBeInTheDocument();
    const release = screen.getByRole('link', { name: /Ready for release/ });
    expect(await within(release).findByText('1')).toBeInTheDocument();
  });
});
