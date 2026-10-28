import { keepPreviousData, queryOptions } from '@tanstack/react-query';
// import axiosInstance from '@/redux/axios';
import type {
  ClearanceTeam,
  CreateExitRequest,
  ExitCreatedResponse,
  ExitListItem,
  ExitListResponse,
  ExitSortBy,
  ExitStage,
  PageParams,
  SortOrder,
} from '@/types';

export interface ExitListParams extends PageParams {
  search?: string;
  stage?: ExitStage;
  status?: string;
  pending_team?: ClearanceTeam;
  lwd_from?: string;
  lwd_to?: string;
  sort_by?: ExitSortBy;
  sort_order?: SortOrder;
}

// --- DUMMY DATA (backend disconnected, see dummy.md) ---
const DUMMY_EXITS: ExitListItem[] = [
  {
    case_id: 'case_dummy_exit_001',
    person_id: 'person_dummy_exit_001',
    full_name: 'Demo Leaver',
    employee_code: 'EMP099',
    last_working_day: new Date().toISOString(),
    stage: 'clearance_requested',
    status: 'open',
    flags: [],
    clearances: { it: 'pending', finance: 'pending', admin: 'pending', manager: 'pending' },
    updated_at: new Date().toISOString(),
  },
];

export const exitsApi = {
  // --- Original backend-connected implementation (commented out, see dummy.md) ---
  // list: async (params: ExitListParams) => (await axiosInstance.get<ExitListResponse>('/api/exits', { params })).data,
  // create: async (payload: CreateExitRequest) =>
  //   (await axiosInstance.post<ExitCreatedResponse>('/api/exits', payload)).data,

  // --- DUMMY implementation ---
  list: async (_params: ExitListParams): Promise<ExitListResponse> => ({
    success: true,
    message: 'Dummy exits list (backend disconnected)',
    total: DUMMY_EXITS.length,
    limit: 20,
    offset: 0,
    data: DUMMY_EXITS,
  }),
  create: async (payload: CreateExitRequest): Promise<ExitCreatedResponse> => ({
    success: true,
    message: 'Dummy exit created (backend disconnected)',
    data: {
      case_id: `case_dummy_exit_${Date.now()}`,
      person: {
        person_id: `person_dummy_exit_${Date.now()}`,
        full_name: payload.full_name ?? 'Demo Leaver',
        personal_email: null,
        work_email: payload.work_email ?? null,
        employee_code: payload.employee_code ?? null,
        designation: null,
        level: null,
        location: null,
        hire_category: null,
        joining_date: null,
        date_of_birth: null,
        manager_name: payload.manager_name ?? null,
        manager_email: payload.manager_email ?? null,
        recruiter_email: null,
        role: 'leaver',
        status: 'active',
        photo_url: null,
      },
      stage: 'clearance_requested',
      tasks: [],
    },
  }),
};

export const exitKeys = {
  all: ['exits'] as const,
  list: (params: ExitListParams) => [...exitKeys.all, 'list', params] as const,
};

export const exitListQuery = (params: ExitListParams) =>
  queryOptions({
    queryKey: exitKeys.list(params),
    queryFn: () => exitsApi.list(params),
    placeholderData: keepPreviousData,
  });
