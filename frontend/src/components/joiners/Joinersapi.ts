import { keepPreviousData, queryOptions } from '@tanstack/react-query';
// import axiosInstance from '@/redux/axios';
import type {
  CaseFlag,
  CreateJoinerRequest,
  HireCategory,
  JoinerCreatedResponse,
  JoinerListItem,
  JoinerListResponse,
  JoinerSortBy,
  JoinerUpdateResponse,
  OnboardingStage,
  PageParams,
  SortOrder,
  UpdateJoinerRequest,
} from '@/types';

export interface JoinerListParams extends PageParams {
  search?: string;
  stage?: OnboardingStage;
  status?: string;
  flag?: CaseFlag;
  hire_category?: HireCategory;
  location?: string;
  joining_from?: string;
  joining_to?: string;
  sort_by?: JoinerSortBy;
  sort_order?: SortOrder;
}

// --- DUMMY DATA (backend disconnected, see dummy.md) ---
const DUMMY_JOINERS: JoinerListItem[] = [
  {
    person_id: 'person_dummy_001',
    case_id: 'case_dummy_001',
    full_name: 'Demo Joiner',
    joining_date: new Date().toISOString(),
    hire_category: 'lateral',
    level: 'L2',
    location: 'Bengaluru',
    stage: 'docs_in_progress',
    status: 'open',
    flags: [],
    docs_verified: 1,
    docs_total: 3,
    next_followup_at: null,
    updated_at: new Date().toISOString(),
    photo_url: null,
  },
  {
    person_id: 'person_sample_requested',
    case_id: 'case_sample_requested',
    full_name: 'Sample Joiner',
    joining_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    hire_category: 'campus',
    level: 'L1',
    location: 'Pune',
    stage: 'docs_requested',
    status: 'open',
    flags: [],
    docs_verified: 0,
    docs_total: 3,
    next_followup_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    photo_url: null,
  },
  {
    person_id: 'person_sample_signoff',
    case_id: 'case_sample_signoff',
    full_name: 'Sample Candidate',
    joining_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    hire_category: 'lateral',
    level: 'L3',
    location: 'Hyderabad',
    stage: 'ready_for_signoff',
    status: 'open',
    flags: [],
    docs_verified: 3,
    docs_total: 3,
    next_followup_at: null,
    updated_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    photo_url: null,
  },
  {
    person_id: 'person_sample_it',
    case_id: 'case_sample_it',
    full_name: 'Sample Employee',
    joining_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    hire_category: 'lateral',
    level: 'L2',
    location: 'Bengaluru',
    stage: 'it_requested',
    status: 'open',
    flags: [],
    docs_verified: 3,
    docs_total: 3,
    next_followup_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    photo_url: null,
  },
  {
    person_id: 'person_sample_dropout',
    case_id: 'case_sample_dropout',
    full_name: 'Sample Dropout',
    joining_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    hire_category: 'campus',
    level: 'L1',
    location: 'Pune',
    stage: 'dropout',
    status: 'open',
    flags: ['dropout_risk'],
    docs_verified: 1,
    docs_total: 3,
    next_followup_at: null,
    updated_at: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
    photo_url: null,
  },
  {
    person_id: 'person_sample_closed',
    case_id: 'case_sample_closed',
    full_name: 'Sample Closed Case',
    joining_date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    hire_category: 'lateral',
    level: 'L4',
    location: 'Mumbai',
    stage: 'closed',
    status: 'closed',
    flags: [],
    docs_verified: 3,
    docs_total: 3,
    next_followup_at: null,
    updated_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    photo_url: null,
  },
];

export const joinersApi = {
  // --- Original backend-connected implementation (commented out, see dummy.md) ---
  // list: async (params: JoinerListParams) =>
  //   (await axiosInstance.get<JoinerListResponse>('/api/joiners', { params })).data,
  // create: async (payload: CreateJoinerRequest) =>
  //   (await axiosInstance.post<JoinerCreatedResponse>('/api/joiners', payload)).data,
  // update: async (personId: string, payload: UpdateJoinerRequest) =>
  //   (await axiosInstance.patch<JoinerUpdateResponse>(`/api/joiners/${personId}`, payload)).data,

  // --- DUMMY implementation ---
  list: async (params: JoinerListParams): Promise<JoinerListResponse> => {
    const search = params.search?.trim().toLowerCase();
    const filtered = DUMMY_JOINERS.filter(
      (item) =>
        (!search || item.full_name.toLowerCase().includes(search)) &&
        (!params.stage || item.stage === params.stage) &&
        (!params.status || item.status === params.status) &&
        (!params.flag || item.flags.includes(params.flag)) &&
        (!params.hire_category || item.hire_category === params.hire_category) &&
        (!params.location || item.location === params.location) &&
        (!params.joining_from || (item.joining_date ?? '') >= params.joining_from) &&
        (!params.joining_to || (item.joining_date ?? '') <= params.joining_to),
    );
    const sorted = [...filtered].sort((a, b) => {
      if (params.sort_by === 'full_name') {
        const diff = a.full_name.localeCompare(b.full_name);
        return params.sort_order === 'z_to_a' ? -diff : diff;
      }
      const field = params.sort_by === 'joining_date' ? 'joining_date' : 'updated_at';
      const diff = new Date(a[field] ?? 0).getTime() - new Date(b[field] ?? 0).getTime();
      return params.sort_order === 'latest' ? -diff : diff;
    });
    const limit = params.limit ?? 20;
    const offset = params.offset ?? 0;
    return {
      success: true,
      message: 'Dummy joiners list (backend disconnected)',
      total: sorted.length,
      limit,
      offset,
      data: sorted.slice(offset, offset + limit),
    };
  },
  create: async (payload: CreateJoinerRequest): Promise<JoinerCreatedResponse> => ({
    success: true,
    message: 'Dummy joiner created (backend disconnected)',
    data: {
      person: {
        person_id: `person_dummy_${Date.now()}`,
        full_name: payload.full_name,
        personal_email: payload.personal_email,
        work_email: null,
        employee_code: null,
        designation: null,
        level: payload.level,
        location: payload.location,
        hire_category: payload.hire_category,
        joining_date: payload.joining_date,
        date_of_birth: payload.date_of_birth,
        manager_name: payload.manager_name,
        manager_email: payload.manager_email,
        recruiter_email: payload.recruiter_email,
        role: 'joiner',
        status: 'active',
        photo_url: payload.photo?.file_url ?? null,
      },
      case_id: `case_dummy_${Date.now()}`,
      stage: 'docs_requested',
      checklist: [],
    },
  }),
  update: async (personId: string, payload: UpdateJoinerRequest): Promise<JoinerUpdateResponse> => ({
    success: true,
    message: 'Dummy joiner updated (backend disconnected)',
    data: {
      person: {
        person_id: personId,
        full_name: payload.full_name ?? DUMMY_JOINERS[0].full_name,
        personal_email: payload.personal_email ?? null,
        work_email: null,
        employee_code: null,
        designation: null,
        level: DUMMY_JOINERS[0].level,
        recruiter_email: payload.recruiter_email ?? null,
        location: payload.location ?? DUMMY_JOINERS[0].location,
        hire_category: DUMMY_JOINERS[0].hire_category,
        joining_date: payload.joining_date ?? DUMMY_JOINERS[0].joining_date,
        date_of_birth: payload.date_of_birth ?? null,
        manager_name: payload.manager_name ?? null,
        manager_email: payload.manager_email ?? null,
        role: 'joiner',
        status: 'active',
        photo_url: payload.photo?.file_url ?? DUMMY_JOINERS[0].photo_url,
      },
      rechecked_documents: 0,
    },
  }),
};

export const joinerKeys = {
  all: ['joiners'] as const,
  list: (params: JoinerListParams) => [...joinerKeys.all, 'list', params] as const,
};

export const joinerListQuery = (params: JoinerListParams) =>
  queryOptions({
    queryKey: joinerKeys.list(params),
    queryFn: () => joinersApi.list(params),
    placeholderData: keepPreviousData,
  });
