import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logoutUser } from '@/redux/authSlice';
import { store } from '@/redux/store';
import { renderWithProviders } from '@/test/render';
import { LoginForm } from './LoginForm';

const login = vi.hoisted(() => vi.fn());
vi.mock('./Authapi', () => ({ authApi: { login } }));

function apiError(status: number, message: string) {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError(message, String(status), config, undefined, {
    status,
    statusText: '',
    headers: {},
    config,
    data: { success: false, error: { status_code: status, status_message: '', message } },
  });
}

describe('LoginForm', () => {
  beforeEach(() => {
    login.mockReset();
    store.dispatch(logoutUser());
  });

  it('shows field errors instead of calling the API when input is invalid', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginForm />);
    await user.type(screen.getByLabelText('Work email'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText('Enter your password')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('rejects passwords shorter than 8 characters', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginForm />);
    await user.type(screen.getByLabelText('Work email'), 'tcg@tcgdigital.com');
    await user.type(screen.getByLabelText('Password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Password must be at least 8 characters')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('shows the backend message when the password is wrong', async () => {
    const user = userEvent.setup();
    login.mockRejectedValue(apiError(401, 'Incorrect email or password'));
    renderWithProviders(<LoginForm />);
    await user.type(screen.getByLabelText('Work email'), 'tcg@tcgdigital.com');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password');
    expect(store.getState().auth.token).toBeNull();
  });

  it('stores the session and calls onSuccess', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    login.mockResolvedValue({
      message: 'Login successful',
      access_token: 'token-1',
      expires_in: 3600,
      user: { user_id: 'u1', name: 'TCG User', email: 'tcg@tcgdigital.com', role: 'hr_admin', complaints_access: false, is_active: true },
    });
    renderWithProviders(<LoginForm onSuccess={onSuccess} />);
    await user.type(screen.getByLabelText('Work email'), 'tcg@tcgdigital.com');
    await user.type(screen.getByLabelText('Password'), 'Right-Pass-2026');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(login).toHaveBeenCalledWith('tcg@tcgdigital.com', 'Right-Pass-2026');
    expect(store.getState().auth.user?.name).toBe('TCG User');
  });
});
