import { queryOptions } from '@tanstack/react-query';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { uploadApi } from '@/components/upload/Uploadapi';
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

describe('Users', () => {
  beforeEach(() => {
    createUser.mockReset();
    vi.restoreAllMocks();
  });

  it('validates a new user before creating the account', async () => {
    const user = userEvent.setup();
    createUser.mockResolvedValue({ data: {} });
    renderWithProviders(<Users />);
    await user.click(screen.getByRole('button', { name: 'Add user' }));
    await user.click(screen.getByRole('button', { name: 'Save user' }));
    expect(await screen.findByText('Enter at least two characters')).toBeInTheDocument();
    expect(createUser).not.toHaveBeenCalled();

    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'TCG User');
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'tcg@tcgdigital.com');
    await user.type(screen.getByLabelText('Password'), 'StrongPass123');
    await user.click(screen.getByRole('button', { name: 'Save user' }));
    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'TCG User',
        email: 'tcg@tcgdigital.com',
        role: 'hr_viewer',
        complaints_access: false,
      }),
    );
  });

  it('uploads the chosen photo and sends it with the new user', async () => {
    const user = userEvent.setup();
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();
    const presign = vi.spyOn(uploadApi, 'presign').mockResolvedValue({
      upload_url: 'https://files.test/bucket',
      fields: { key: 'uploads/user_photo/abc.png' },
      file_url: 'uploads/user_photo/abc.png',
      expires_in: 300,
    });
    vi.spyOn(uploadApi, 'send').mockResolvedValue();
    createUser.mockResolvedValue({ data: {} });
    renderWithProviders(<Users />);
    await user.click(screen.getByRole('button', { name: 'Add user' }));
    await user.upload(screen.getByLabelText('Photo'), new File(['icon'], 'me.png', { type: 'image/png' }));
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'TCG User');
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'tcg@tcgdigital.com');
    await user.type(screen.getByLabelText('Password'), 'StrongPass123');
    await user.click(screen.getByRole('button', { name: 'Save user' }));
    expect(presign).toHaveBeenCalledWith(expect.any(File), 'user_photo');
    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        photo: {
          file_name: 'me.png',
          file_url: 'uploads/user_photo/abc.png',
          mime_type: 'image/png',
          size: 4,
        },
      }),
    );
  });
});
