import { queryOptions } from '@tanstack/react-query';
import axiosInstance from '@/redux/axios';
import type {
  AppointmentLetterResponse,
  BookSessionRequest,
  CaseDetailResponse,
  CaseUpdateResponse,
  ChecklistOverrideRequest,
  ChecklistOverrideResponse,
  DownloadUrlResponse,
  FileAttachment,
  PlanInductionRequest,
  PlanInductionResponse,
  ReleaseConfirmRequest,
  ReleaseConfirmResponse,
  SessionResponse,
  SignOffRequest,
  SignOffResponse,
  TaskResponse,
  UpdateCaseRequest,
  UpdateTaskRequest,
} from '@/types';

export const casesApi = {
  detail: async (caseId: string) =>
    (await axiosInstance.get<CaseDetailResponse>(`/api/cases/${caseId}`)).data.data,
  update: async (caseId: string, payload: UpdateCaseRequest) =>
    (await axiosInstance.patch<CaseUpdateResponse>(`/api/cases/${caseId}`, payload)).data,
  updateTask: async (taskId: string, payload: UpdateTaskRequest) =>
    (await axiosInstance.patch<TaskResponse>(`/api/tasks/${taskId}`, payload)).data,
  signOff: async (caseId: string, payload: SignOffRequest) =>
    (await axiosInstance.post<SignOffResponse>(`/api/cases/${caseId}/sign-off`, payload)).data,
  overrideChecklist: async (caseId: string, itemId: string, payload: ChecklistOverrideRequest) =>
    (await axiosInstance.patch<ChecklistOverrideResponse>(`/api/cases/${caseId}/checklist/${itemId}`, payload)).data,
  releaseConfirm: async (caseId: string, payload: ReleaseConfirmRequest) =>
    (await axiosInstance.post<ReleaseConfirmResponse>(`/api/cases/${caseId}/release-confirm`, payload)).data,
  planInduction: async (caseId: string, payload: PlanInductionRequest) =>
    (await axiosInstance.post<PlanInductionResponse>(`/api/cases/${caseId}/induction`, payload)).data,
  uploadAppointmentLetter: async (caseId: string, file: FileAttachment) =>
    (await axiosInstance.post<AppointmentLetterResponse>(`/api/cases/${caseId}/appointment-letter`, file)).data,
  bookSession: async (sessionId: string, payload: BookSessionRequest) =>
    (await axiosInstance.post<SessionResponse>(`/api/induction-sessions/${sessionId}/book`, payload)).data,
  attachmentUrl: async (attachmentId: string) =>
    (await axiosInstance.get<DownloadUrlResponse>(`/api/attachments/${attachmentId}/download-url`)).data.data,
};

export const caseKeys = {
  all: ['cases'] as const,
  detail: (caseId: string) => [...caseKeys.all, 'detail', caseId] as const,
};

const CASE_REFRESH_MS = 30_000;

export const caseDetailQuery = (caseId: string) =>
  queryOptions({
    queryKey: caseKeys.detail(caseId),
    queryFn: () => casesApi.detail(caseId),
    refetchInterval: CASE_REFRESH_MS,
  });
