import { queryOptions } from '@tanstack/react-query';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import Users from './Users';

const createUser = vi.hoisted(() => vi.fn());
vi.mock('./Usersapi', () => ({
  userKeys: { all: ['users'] },
  userListQuery: () =>
    queryOptions({
      queryKey: ['users', 'list'],
      queryFn: async () => ({ total: 0, limit: 50, offset: 0, data: [] }),
    }),
  usersApi: { create: createUser, update: vi.fn() },
}));
vi.mock('@/utils/toast', () => ({ showToast: { success: vi.fn(), error: vi.fn() } }));

describe('Admins', () => {
  beforeEach(() => createUser.mockReset());

  it('validates a new admin before creating the account', async () => {
    const user = userEvent.setup();
    createUser.mockResolvedValue({ data: {} });
    renderWithProviders(<Users />);
    await user.click(screen.getByRole('button', { name: 'Add admin' }));
    await user.click(screen.getByRole('button', { name: 'Save admin' }));
    expect(await screen.findByText('Enter at least two characters')).toBeInTheDocument();
    expect(createUser).not.toHaveBeenCalled();

    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'TCG User');
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'tcg@tcgdigital.com');
    await user.type(screen.getByLabelText('Password'), 'StrongPass123');
    await user.click(screen.getByRole('button', { name: 'Save admin' }));
    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'TCG User',
        email: 'tcg@tcgdigital.com',
        role: 'hr_viewer',
        complaints_access: false,
      }),
    );
  });
});
