// import axiosInstance from '@/redux/axios';
import { UserRole } from '@/types';
import type { LoginResponse, UpdateMyPhotoRequest, UserData } from '@/types';

// --- DUMMY DATA (backend disconnected, see dummy.md) ---
const DUMMY_USER: UserData = {
  user_id: 'usr_dummy_001',
  name: 'Demo HR Admin',
  email: 'demo.admin@tcgdigital.com',
  role: UserRole.HR_ADMIN,
  complaints_access: true,
  is_active: true,
  photo_url: null,
  last_login_at: new Date().toISOString(),
};

export const authApi = {
  // --- Original backend-connected implementation (commented out, see dummy.md) ---
  // login: async (email: string, password: string) => {
  //   const body = new URLSearchParams({ username: email, password });
  //   const { data } = await axiosInstance.post<LoginResponse>('/api/auth/login', body);
  //   return data;
  // },
  // me: async () => {
  //   const { data } = await axiosInstance.get<UserResponse>('/api/auth/me');
  //   return data.data;
  // },
  // updateMyPhoto: async (payload: UpdateMyPhotoRequest) => {
  //   const { data } = await axiosInstance.patch<UserResponse>('/api/auth/me/photo', payload);
  //   return data.data;
  // },
  // logout: async () => {
  //   await axiosInstance.post<EmptyResponse>('/api/auth/logout');
  // },

  // --- DUMMY implementation ---
  login: async (_email: string, _password: string): Promise<LoginResponse> => ({
    success: true,
    message: 'Dummy login (backend disconnected)',
    access_token: 'dummy-access-token',
    token_type: 'bearer',
    expires_in: 3600,
    user: DUMMY_USER,
  }),
  me: async (): Promise<UserData> => DUMMY_USER,
  updateMyPhoto: async (payload: UpdateMyPhotoRequest): Promise<UserData> => ({
    ...DUMMY_USER,
    photo_url: payload.photo?.file_url ?? null,
  }),
  logout: async (): Promise<void> => {},
};

export const authKeys = {
  me: ['auth', 'me'] as const,
};
