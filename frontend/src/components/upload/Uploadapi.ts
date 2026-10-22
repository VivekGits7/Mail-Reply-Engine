import axios from 'axios';
import axiosInstance from '@/redux/axios';
import type { FileAttachment, PresignData, PresignResponse, UploadPurpose } from '@/types';

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  csv: 'text/csv',
  txt: 'text/plain',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export const ACCEPT_BY_PURPOSE: Record<UploadPurpose, string> = {
  appointment_letter: '.pdf',
  statement_of_understanding: '.pdf',
  reminder_list: '.csv,.xlsx',
  survey_export: '.xlsx',
  transcript: '.pdf,.docx,.txt',
};

// Browsers report CSV as application/vnd.ms-excel on Windows, so trust the extension first.
export function mimeTypeOf(file: File): string {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXTENSION[extension] ?? (file.type || 'application/octet-stream');
}

export const uploadApi = {
  presign: async (file: File, purpose: UploadPurpose) => {
    const { data } = await axiosInstance.post<PresignResponse>('/api/uploads/presign', {
      file_name: file.name,
      mime_type: mimeTypeOf(file),
      size: file.size,
      purpose,
    });
    return data.data;
  },
  // Storage gets a plain axios call: the shared instance would attach our API baseURL and bearer token.
  send: async (presigned: PresignData, file: File, onProgress: (percent: number) => void) => {
    const form = new FormData();
    Object.entries(presigned.fields).forEach(([key, value]) => form.append(key, value));
    form.append('file', file);
    await axios.post(presigned.upload_url, form, {
      onUploadProgress: (event) => onProgress(event.total ? Math.round((event.loaded / event.total) * 100) : 0),
    });
  },
};

export async function uploadFile(
  file: File,
  purpose: UploadPurpose,
  onProgress: (percent: number) => void = () => {},
): Promise<FileAttachment> {
  const presigned = await uploadApi.presign(file, purpose);
  await uploadApi.send(presigned, file, onProgress);
  return { file_name: file.name, file_url: presigned.file_url, mime_type: mimeTypeOf(file), size: file.size };
}
