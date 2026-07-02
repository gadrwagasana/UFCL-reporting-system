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

// Detect versioned envelope and unwrap it.
// Success envelope  → { ok: true, ...data }   (backward-compat: screens can still check result.ok)
// Error envelope    → { ok: false, error: message, errorCode: code }
// Legacy format     → returned as-is
function unwrapEnvelope<T>(raw: unknown): T {
  if (raw && typeof raw === 'object' && 'ok' in raw && 'version' in raw) {
    const env = raw as { ok: boolean; version: number; data?: unknown; error?: { code: string; message: string } };
    if (!env.ok) {
      const err = env.error ?? { code: 'INTERNAL_ERROR', message: 'Unknown error' };
      return { ok: false, error: err.message, errorCode: err.code } as T;
    }
    return { ok: true, ...(env.data as object) } as T;
  }
  return raw as T;
}

export async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const r = await apiClient.get<unknown>(url, { params });
  return unwrapEnvelope<T>(r.data);
}

export async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await apiClient.post<unknown>(url, body);
  return unwrapEnvelope<T>(r.data);
}

export async function put<T>(url: string, body: unknown): Promise<T> {
  const r = await apiClient.put<unknown>(url, body);
  return unwrapEnvelope<T>(r.data);
}

export async function patch<T>(url: string, body: unknown): Promise<T> {
  const r = await apiClient.patch<unknown>(url, body);
  return unwrapEnvelope<T>(r.data);
}

export async function del<T>(url: string, body?: unknown): Promise<T> {
  const r = await apiClient.delete<unknown>(url, { data: body });
  return unwrapEnvelope<T>(r.data);
}
