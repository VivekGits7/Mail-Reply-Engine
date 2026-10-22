import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import { logoutUser, setCredentials } from '@/redux/authSlice';
import { store } from '@/redux/store';
import { RequireAdmin, RequireAuth } from './RequireAuth';

function LoginProbe() {
  const location = useLocation();
  return <p>login page {location.search}</p>;
}

function renderAt(path: string) {
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/login" element={<LoginProbe />} />
          <Route
            path="/admin/users"
            element={
              <RequireAuth>
                <RequireAdmin>
                  <p>users screen</p>
                </RequireAdmin>
              </RequireAuth>
            }
          />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
}

const viewer = { user_id: 'u2', name: 'Viewer', email: 'v@tcgdigital.com', role: 'hr_viewer' as const, complaints_access: false, is_active: true };

describe('RequireAuth', () => {
  it('sends signed out visitors to login and remembers where they were going', () => {
    store.dispatch(logoutUser());
    renderAt('/admin/users?role=hr_admin');
    expect(screen.getByText(/login page/)).toHaveTextContent('?next=%2Fadmin%2Fusers%3Frole%3Dhr_admin');
  });

  it('blocks viewers from admin only screens', () => {
    store.dispatch(setCredentials({ token: 't', user: viewer }));
    renderAt('/admin/users');
    expect(screen.getByText("You don't have access to user management")).toBeInTheDocument();
    expect(screen.queryByText('users screen')).not.toBeInTheDocument();
  });
});
