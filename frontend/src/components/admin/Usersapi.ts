import { keepPreviousData, queryOptions } from '@tanstack/react-query';
// import axiosInstance from '@/redux/axios';
import { UserRole } from '@/types';
import type {
  CreateUserRequest,
  PageParams,
  SortOrder,
  UpdateUserRequest,
  UserData,
  UserListResponse,
  UserResponse,
  UserSortBy,
} from '@/types';

export interface UserListParams extends PageParams {
  search?: string;
  role?: UserRole;
  is_active?: boolean;
  sort_by?: UserSortBy;
  sort_order?: SortOrder;
}

// --- DUMMY DATA (backend disconnected, see dummy.md) ---
const DUMMY_USERS: UserData[] = [
  {
    user_id: 'usr_dummy_001',
    name: 'Demo HR Admin',
    email: 'demo.admin@tcgdigital.com',
    role: UserRole.HR_ADMIN,
    complaints_access: true,
    is_active: true,
    photo_url: null,
    last_login_at: new Date().toISOString(),
  },
  {
    user_id: 'usr_dummy_002',
    name: 'Demo HR Viewer',
    email: 'demo.viewer@tcgdigital.com',
    role: UserRole.HR_VIEWER,
    complaints_access: false,
    is_active: true,
    photo_url: null,
    last_login_at: new Date().toISOString(),
  },
];

export const usersApi = {
  // --- Original backend-connected implementation (commented out, see dummy.md) ---
  // list: async (params: UserListParams) => (await axiosInstance.get<UserListResponse>('/api/users', { params })).data,
  // create: async (payload: CreateUserRequest) => (await axiosInstance.post<UserResponse>('/api/users', payload)).data,
  // update: async (userId: string, payload: UpdateUserRequest) =>
  //   (await axiosInstance.patch<UserResponse>(`/api/users/${userId}`, payload)).data,

  // --- DUMMY implementation ---
  list: async (_params: UserListParams): Promise<UserListResponse> => ({
    success: true,
    message: 'Dummy users list (backend disconnected)',
    total: DUMMY_USERS.length,
    limit: 20,
    offset: 0,
    data: DUMMY_USERS,
  }),
  create: async (payload: CreateUserRequest): Promise<UserResponse> => ({
    success: true,
    message: 'Dummy user created (backend disconnected)',
    data: {
      user_id: `usr_dummy_${Date.now()}`,
      name: payload.name,
      email: payload.email,
      role: payload.role ?? UserRole.HR_VIEWER,
      complaints_access: payload.complaints_access ?? false,
      is_active: true,
      photo_url: payload.photo?.file_url ?? null,
      last_login_at: null,
    },
  }),
  update: async (userId: string, payload: UpdateUserRequest): Promise<UserResponse> => ({
    success: true,
    message: 'Dummy user updated (backend disconnected)',
    data: {
      ...(DUMMY_USERS.find((u) => u.user_id === userId) ?? DUMMY_USERS[0]),
      role: payload.role ?? DUMMY_USERS[0].role,
      complaints_access: payload.complaints_access ?? DUMMY_USERS[0].complaints_access,
      is_active: payload.is_active ?? DUMMY_USERS[0].is_active,
      photo_url: payload.photo?.file_url ?? DUMMY_USERS[0].photo_url,
    },
  }),
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
