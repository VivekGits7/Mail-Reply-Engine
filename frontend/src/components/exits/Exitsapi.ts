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
  {
    case_id: 'case_sample_exit_progress',
    person_id: 'person_sample_exit_progress',
    full_name: 'Sample Leaver',
    employee_code: 'EMP101',
    last_working_day: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
    stage: 'clearances_in_progress',
    status: 'open',
    flags: [],
    clearances: { it: 'done', finance: 'pending', admin: 'pending', manager: 'done' },
    updated_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
  },
  {
    case_id: 'case_sample_exit_cleared',
    person_id: 'person_sample_exit_cleared',
    full_name: 'Sample Employee',
    employee_code: 'EMP102',
    last_working_day: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    stage: 'all_cleared',
    status: 'open',
    flags: [],
    clearances: { it: 'done', finance: 'done', admin: 'done', manager: 'done' },
    updated_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
  },
  {
    case_id: 'case_sample_exit_closed',
    person_id: 'person_sample_exit_closed',
    full_name: 'Sample Closed Exit',
    employee_code: 'EMP103',
    last_working_day: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    stage: 'closed',
    status: 'closed',
    flags: [],
    clearances: { it: 'done', finance: 'done', admin: 'done', manager: 'done' },
    updated_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
  },
];

export const exitsApi = {
  // --- Original backend-connected implementation (commented out, see dummy.md) ---
  // list: async (params: ExitListParams) => (await axiosInstance.get<ExitListResponse>('/api/exits', { params })).data,
  // create: async (payload: CreateExitRequest) =>
  //   (await axiosInstance.post<ExitCreatedResponse>('/api/exits', payload)).data,

  // --- DUMMY implementation ---
  list: async (params: ExitListParams): Promise<ExitListResponse> => {
    const search = params.search?.trim().toLowerCase();
    const filtered = DUMMY_EXITS.filter(
      (item) =>
        (!search ||
          item.full_name.toLowerCase().includes(search) ||
          item.employee_code?.toLowerCase().includes(search)) &&
        (!params.stage || item.stage === params.stage) &&
        (!params.status || item.status === params.status) &&
        (!params.pending_team || !['done', 'not_applicable'].includes(item.clearances[params.pending_team])) &&
        (!params.lwd_from || (item.last_working_day ?? '') >= params.lwd_from) &&
        (!params.lwd_to || (item.last_working_day ?? '') <= params.lwd_to),
    );
    const sorted = [...filtered].sort((a, b) => {
      if (params.sort_by === 'full_name') {
        const diff = a.full_name.localeCompare(b.full_name);
        return params.sort_order === 'z_to_a' ? -diff : diff;
      }
      const field = params.sort_by === 'last_working_day' ? 'last_working_day' : 'updated_at';
      const diff = new Date(a[field] ?? 0).getTime() - new Date(b[field] ?? 0).getTime();
      return params.sort_order === 'latest' ? -diff : diff;
    });
    const limit = params.limit ?? 20;
    const offset = params.offset ?? 0;
    return {
      success: true,
      message: 'Dummy exits list (backend disconnected)',
      total: sorted.length,
      limit,
      offset,
      data: sorted.slice(offset, offset + limit),
    };
  },
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
