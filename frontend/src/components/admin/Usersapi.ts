import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import axiosInstance from '@/redux/axios';
import type {
  CreateUserRequest,
  PageParams,
  SortOrder,
  UpdateUserRequest,
  UserListResponse,
  UserResponse,
  UserRole,
  UserSortBy,
} from '@/types';

export interface UserListParams extends PageParams {
  search?: string;
  role?: UserRole;
  is_active?: boolean;
  sort_by?: UserSortBy;
  sort_order?: SortOrder;
}

export const usersApi = {
  list: async (params: UserListParams) =>
    (await axiosInstance.get<UserListResponse>('/api/users', { params })).data,
  create: async (payload: CreateUserRequest) =>
    (await axiosInstance.post<UserResponse>('/api/users', payload)).data,
  update: async (userId: string, payload: UpdateUserRequest) =>
    (await axiosInstance.patch<UserResponse>(`/api/users/${userId}`, payload)).data,
  remove: async (userId: string) => (await axiosInstance.delete(`/api/users/${userId}`)).data,
};

export const userKeys = {
  all: ['users'] as const,
  list: (params: UserListParams) => [...userKeys.all, 'list', params] as const,
};

export const userListQuery = (params: UserListParams) =>
  queryOptions({
    queryKey: userKeys.list(params),
    queryFn: () => usersApi.list(params),
    placeholderData: keepPreviousData,
  });
