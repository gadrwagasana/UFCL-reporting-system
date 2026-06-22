import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';
import { loadToken, deleteToken } from '../utils/storage';

// Resolved from app.json extra.apiUrl at build time
const API_URL: string = (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? 'http://192.168.1.5:3001';

export const apiClient = axios.create({
  baseURL:        API_URL,
  timeout:        15_000,
  headers:        { 'Content-Type': 'application/json' },
});

// ─── Request interceptor: attach JWT ─────────────────────────────────────────
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await loadToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ─── Response interceptor: 401 → logout ──────────────────────────────────────
// We use a lazy import of the auth store to avoid a circular dependency at
// module initialisation time.
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Clear token and let the store / RootNavigator handle redirect
      await deleteToken();
      const { useAuthStore } = await import('../stores/authStore');
      useAuthStore.getState().onUnauthorized();
    }
    return Promise.reject(error);
  },
);

// Helper: unwrap data and surface API-layer errors as thrown exceptions
export async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const r = await apiClient.get<T>(url, { params });
  return r.data;
}

export async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await apiClient.post<T>(url, body);
  return r.data;
}

export async function put<T>(url: string, body: unknown): Promise<T> {
  const r = await apiClient.put<T>(url, body);
  return r.data;
}

export async function patch<T>(url: string, body: unknown): Promise<T> {
  const r = await apiClient.patch<T>(url, body);
  return r.data;
}
