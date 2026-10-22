import { isAxiosError } from 'axios';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import type { ApiErrorBody } from '@/types';

// FastAPI 422 details arrive as "body.email"; strip the location prefix to match the form field name.
export function applyServerErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>): boolean {
  if (!isAxiosError<ApiErrorBody>(error)) return false;
  const details = error.response?.data?.error?.details;
  if (!details?.length) return false;
  details.forEach(({ field, message }) => {
    setError(field.replace(/^(body|query|path)\./, '') as Path<T>, { type: 'server', message });
  });
  return true;
}
