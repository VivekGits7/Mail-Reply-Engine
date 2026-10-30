import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import axiosInstance from '@/redux/axios';
import type {
  CaseFlag,
  CreateJoinerRequest,
  HireCategory,
  JoinerCreatedResponse,
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

export const joinersApi = {
  list: async (params: JoinerListParams) =>
    (await axiosInstance.get<JoinerListResponse>('/api/joiners', { params })).data,
  create: async (payload: CreateJoinerRequest) =>
    (await axiosInstance.post<JoinerCreatedResponse>('/api/joiners', payload)).data,
  update: async (personId: string, payload: UpdateJoinerRequest) =>
    (await axiosInstance.patch<JoinerUpdateResponse>(`/api/joiners/${personId}`, payload)).data,
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
