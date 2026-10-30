import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import axiosInstance from '@/redux/axios';
import type {
  ClearanceTeam,
  CreateExitRequest,
  ExitCreatedResponse,
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

export const exitsApi = {
  list: async (params: ExitListParams) =>
    (await axiosInstance.get<ExitListResponse>('/api/exits', { params })).data,
  create: async (payload: CreateExitRequest) =>
    (await axiosInstance.post<ExitCreatedResponse>('/api/exits', payload)).data,
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
