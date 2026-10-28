import axiosInstance from '@/redux/axios';
import type { EmptyResponse, LoginResponse, UpdateMyPhotoRequest, UserResponse } from '@/types';

export const authApi = {
  login: async (email: string, password: string) => {
    const body = new URLSearchParams({ username: email, password });
    const { data } = await axiosInstance.post<LoginResponse>('/api/auth/login', body);
    return data;
  },
  me: async () => {
    const { data } = await axiosInstance.get<UserResponse>('/api/auth/me');
    return data.data;
  },
  updateMyPhoto: async (payload: UpdateMyPhotoRequest) => {
    const { data } = await axiosInstance.patch<UserResponse>('/api/auth/me/photo', payload);
    return data.data;
  },
  logout: async () => {
    await axiosInstance.post<EmptyResponse>('/api/auth/logout');
  },
};

export const authKeys = {
  me: ['auth', 'me'] as const,
};
