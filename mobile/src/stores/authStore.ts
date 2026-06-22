import { create } from 'zustand';
import { User } from '../types/auth';
import { saveToken, loadToken, deleteToken } from '../utils/storage';
import { loginApi, meApi } from '../api/auth';

interface AuthState {
  user:            User | null;
  token:           string | null;
  isLoading:       boolean;   // true while restoring session on startup
  isAuthenticated: boolean;
  error:           string | null;

  // Actions
  login:           (username: string, password: string) => Promise<void>;
  logout:          () => Promise<void>;
  restoreSession:  () => Promise<void>;
  onUnauthorized:  () => void;    // called by Axios interceptor on 401
  clearError:      () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user:            null,
  token:           null,
  isLoading:       true,
  isAuthenticated: false,
  error:           null,

  login: async (username, password) => {
    set({ error: null });
    try {
      const data = await loginApi({ username, password });
      if (!data.ok) {
        set({ error: (data as unknown as { error: string }).error ?? 'Login failed' });
        return;
      }
      await saveToken(data.token);
      set({ token: data.token, user: data.user, isAuthenticated: true, error: null });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Unable to connect to server';
      set({ error: msg });
    }
  },

  logout: async () => {
    await deleteToken();
    set({ user: null, token: null, isAuthenticated: false, error: null });
  },

  restoreSession: async () => {
    set({ isLoading: true });
    try {
      const token = await loadToken();
      if (!token) {
        set({ isLoading: false });
        return;
      }
      // Verify token is still valid
      const data = await meApi();
      if (data.ok) {
        set({ token, user: data, isAuthenticated: true });
      } else {
        await deleteToken();
      }
    } catch {
      // Token expired or server unreachable — clear it
      await deleteToken();
    } finally {
      set({ isLoading: false });
    }
  },

  onUnauthorized: () => {
    // Called by the Axios 401 interceptor — clear local state without
    // needing an async deleteToken call (the interceptor already cleared it)
    set({ user: null, token: null, isAuthenticated: false });
  },

  clearError: () => set({ error: null }),
}));
