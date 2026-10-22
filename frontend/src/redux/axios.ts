import axios from 'axios';
import { logout } from '@/utils/logout';

let getToken: () => string | null = () => null;

export function setTokenGetter(fn: () => string | null) {
  getToken = fn;
}

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_REACT_APP_API_URL,
  timeout: 30_000,
});

axiosInstance.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only a logged-in 401 means the session died; a failed login attempt must not reload the page.
    if (axios.isAxiosError(error) && error.response?.status === 401 && getToken()) logout();
    return Promise.reject(error);
  },
);

export default axiosInstance;
