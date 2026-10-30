import axios, { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminApi } from '@/components/admin/Adminapi';
import { usersApi } from '@/components/admin/Usersapi';
import { approvalsApi } from '@/components/approvals/Approvalsapi';
import { authApi } from '@/components/auth/Authapi';
import { casesApi } from '@/components/cases/Casesapi';
import { complaintsApi } from '@/components/complaints/Complaintsapi';
import { exitsApi } from '@/components/exits/Exitsapi';
import { feedbackApi } from '@/components/feedback/Feedbackapi';
import { joinersApi } from '@/components/joiners/Joinersapi';
import { remindersApi } from '@/components/reminders/Remindersapi';
import { uploadFile } from '@/components/upload/Uploadapi';
import axiosInstance, { setTokenGetter } from '@/redux/axios';

const originalApiAdapter = axiosInstance.defaults.adapter;
const originalStorageAdapter = axios.defaults.adapter;
let requests: InternalAxiosRequestConfig[];
let responseBody: unknown;
let responseStatus: number;

const adapter: AxiosAdapter = async (config) => {
  requests.push(config);
  const response = { data: responseBody, status: responseStatus, statusText: '', headers: {}, config };
  if (responseStatus >= 400) {
    throw new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, undefined, response);
  }
  return response;
};

beforeEach(() => {
  requests = [];
  responseBody = { success: true, message: 'Saved', data: {} };
  responseStatus = 200;
  axiosInstance.defaults.adapter = adapter;
  axios.defaults.adapter = adapter;
  setTokenGetter(() => 'real-session-token');
});

afterEach(() => {
  axiosInstance.defaults.adapter = originalApiAdapter;
  axios.defaults.adapter = originalStorageAdapter;
  setTokenGetter(() => null);
});

describe('backend API integration', () => {
  it('authenticates through the OAuth form and returns the server session', async () => {
    setTokenGetter(() => null);
    responseBody = { access_token: 'server-token', user: { name: 'Actual user' } };
    expect(await authApi.login('hr@example.test', 'Pass&word+123')).toEqual(responseBody);
    expect(requests[0].url).toBe('/api/auth/login');
    expect(requests[0].headers.getContentType()).toContain('application/x-www-form-urlencoded');
    const form = new URLSearchParams(requests[0].data as string);
    expect(form.get('username')).toBe('hr@example.test');
    expect(form.get('password')).toBe('Pass&word+123');
  });

  it('rejects incorrect credentials instead of creating a fake session', async () => {
    setTokenGetter(() => null);
    responseStatus = 401;
    responseBody = { success: false, error: { message: 'Incorrect email or password' } };
    await expect(authApi.login('hr@example.test', 'wrong-password')).rejects.toMatchObject({
      response: { status: 401, data: responseBody },
    });
  });

  const page = { search: 'Actual', limit: 10, offset: 20, sort_order: 'latest' as const };
  it.each([
    { name: 'joiners', path: '/api/joiners', call: () => joinersApi.list(page) },
    { name: 'exits', path: '/api/exits', call: () => exitsApi.list(page) },
    { name: 'users', path: '/api/users', call: () => usersApi.list(page) },
    { name: 'complaints', path: '/api/complaints', call: () => complaintsApi.list(page) },
    { name: 'surveys', path: '/api/feedback/surveys', call: () => feedbackApi.surveys(page) },
    { name: 'approvals', path: '/api/approvals', call: () => approvalsApi.list(page) },
  ])('uses server pagination and bearer authentication for $name', async ({ path, call }) => {
    responseBody = { success: true, message: 'Found 47 records', data: [], total: 47, limit: 10, offset: 20 };
    expect(await call()).toEqual(responseBody);
    expect(requests[0].url).toBe(path);
    expect(requests[0].params).toEqual(page);
    expect(requests[0].headers.get('Authorization')).toBe('Bearer real-session-token');
  });

  it('reads configuration and reminder rules from the server response', async () => {
    responseBody = { success: true, message: 'Settings', data: [{ key: 'max_followups', value: 8 }] };
    expect(await adminApi.settings()).toEqual([{ key: 'max_followups', value: 8 }]);
    responseBody = { success: true, message: 'Rules', data: [] };
    expect(await remindersApi.rules({ is_active: false })).toEqual([]);
    expect(requests[1].params).toEqual({ is_active: false });
  });

  it('saves joiner edits and returns the stored person', async () => {
    const personId = 'f65b9040-e49a-4392-a189-519d903eb3d8';
    responseBody = {
      success: true,
      message: 'Joiner updated',
      data: { person: { person_id: personId, full_name: 'Actual person' } },
    };
    expect(await joinersApi.update(personId, { full_name: 'Actual person' })).toEqual(responseBody);
    expect(requests[0].method).toBe('patch');
    expect(requests[0].url).toBe(`/api/joiners/${personId}`);
    expect(JSON.parse(requests[0].data as string)).toEqual({ full_name: 'Actual person' });
  });

  it('sends approval decisions to the backend', async () => {
    const approvalId = 'f65b9040-e49a-4392-a189-519d903eb3d8';
    responseBody = {
      success: true,
      message: 'Rejected',
      data: { approval_id: approvalId, status: 'rejected' },
    };
    expect(await approvalsApi.reject(approvalId, 'Please revise')).toEqual(responseBody);
    expect(JSON.parse(requests[0].data as string)).toEqual({ reason: 'Please revise' });
    expect(requests[0].url).toBe(`/api/approvals/${approvalId}/reject`);
  });

  it('preserves backend errors when a save fails', async () => {
    responseStatus = 409;
    responseBody = { success: false, error: { message: 'Template key already exists' } };
    await expect(
      adminApi.createTemplate({ template_key: 'welcome', name: 'Welcome', subject: 'Hello' }),
    ).rejects.toMatchObject({ response: { status: 409, data: responseBody } });
  });

  it.each([
    {
      name: 'case attachment',
      path: '/api/attachments/file-id/download-url',
      call: () => casesApi.attachmentUrl('file-id'),
    },
    {
      name: 'complaint attachment',
      path: '/api/attachments/file-id/download-url',
      call: () => complaintsApi.attachmentUrl('file-id'),
    },
    {
      name: 'feedback report',
      path: '/api/feedback/reports/report-id/download-url',
      call: () => feedbackApi.reportUrl('report-id'),
    },
  ])('requests a fresh signed URL for a $name', async ({ path, call }) => {
    const link = { url: 'https://storage.example.test/private-file?signature=fresh', expires_in: 300 };
    responseBody = { success: true, message: 'Link ready', data: link };
    expect(await call()).toEqual(link);
    expect(requests[0].url).toBe(path);
    expect(requests[0].method).toBe('get');
  });

  it('uploads directly to storage without leaking the API bearer token', async () => {
    const file = new File(['a,b'], 'people.csv', { type: 'application/vnd.ms-excel' });
    const progress = vi.fn();
    responseBody = {
      success: true,
      message: 'Upload ready',
      data: {
        upload_url: 'https://storage.example.test/bucket',
        fields: { key: 'uploads/reminder_list/people.csv', policy: 'signed-policy' },
        file_url: 'uploads/reminder_list/people.csv',
        expires_in: 300,
      },
    };
    expect(await uploadFile(file, 'reminder_list', progress)).toEqual({
      file_name: 'people.csv',
      file_url: 'uploads/reminder_list/people.csv',
      mime_type: 'text/csv',
      size: 3,
    });
    expect(requests[0].url).toBe('/api/uploads/presign');
    expect(JSON.parse(requests[0].data as string)).toEqual({
      file_name: 'people.csv',
      mime_type: 'text/csv',
      size: 3,
      purpose: 'reminder_list',
    });
    const storageRequest = requests[1];
    expect(storageRequest.url).toBe('https://storage.example.test/bucket');
    expect(storageRequest.headers.get('Authorization')).toBeUndefined();
    const form = storageRequest.data as FormData;
    expect(form.get('policy')).toBe('signed-policy');
    expect(form.get('file')).toBe(file);
    expect([...form.keys()].at(-1)).toBe('file');
    storageRequest.onUploadProgress?.({ loaded: 3, total: 3, bytes: 3, lengthComputable: true });
    expect(progress).toHaveBeenCalledWith(100);
  });

  it('does not return file metadata when storage rejects the upload', async () => {
    responseBody = {
      data: { upload_url: 'https://storage.example.test/bucket', fields: {}, file_url: 'uploads/photo.png' },
    };
    axios.defaults.adapter = async () => {
      throw new Error('Storage unavailable');
    };
    await expect(uploadFile(new File(['x'], 'photo.png'), 'user_photo')).rejects.toThrow(
      'Storage unavailable',
    );
  });
});
