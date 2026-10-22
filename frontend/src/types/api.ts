export interface ApiResponse<T> {
  success?: boolean;
  message: string;
  data: T;
}

export interface Paginated<T> {
  success?: boolean;
  message: string;
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface ApiErrorBody {
  success: false;
  error: {
    status_code: number;
    status_message: string;
    message: string;
    code?: string;
    details?: { field: string; message: string; type: string }[];
  };
}

export interface PageParams {
  limit: number;
  offset: number;
}
