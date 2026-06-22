import { create } from 'zustand';
import { User } from '../types/auth';
import {
  saveToken, loadToken, deleteToken,
  saveUserCache, loadUserCache, clearUserCache,
} from '../utils/storage';
import { loginApi, meApi } from '../api/auth';

interface AuthState {
  user:              User | null;
  token:             string | null;
  isLoading:         boolean;    // true while restoring session on startup
  isAuthenticated:   boolean;
  isOfflineSession:  boolean;    // true when session was restored from cache (no /me call)
  error:             string | null;

  // Actions
  login:             (username: string, password: string) => Promise<void>;
  logout:            () => Promise<void>;
  restoreSession:    () => Promise<void>;
  revalidateSession: () => Promise<void>;  // called on network reconnect
  onUnauthorized:    () => void;           // called by Axios interceptor on 401
  clearError:        () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user:             null,
  token:            null,
  isLoading:        true,
  isAuthenticated:  false,
  isOfflineSession: false,
  error:            null,

  login: async (username, password) => {
    set({ error: null });
    try {
      const data = await loginApi({ username, password });
      if (!data.ok) {
        set({ error: (data as unknown as { error: string }).error ?? 'Login failed' });
        return;
      }
      await saveToken(data.token);
      await saveUserCache(data.user);
      set({ token: data.token, user: data.user, isAuthenticated: true, isOfflineSession: false, error: null });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Unable to connect to server';
      set({ error: msg });
    }
  },

  logout: async () => {
    await deleteToken();
    await clearUserCache();
    set({ user: null, token: null, isAuthenticated: false, isOfflineSession: false, error: null });
  },

  restoreSession: async () => {
    set({ isLoading: true });
    try {
      const token = await loadToken();
      if (!token) {
        set({ isLoading: false });
        return;
      }

      try {
        // Online path: verify token is still valid against the server.
        const data = await meApi();
        if (data.ok) {
          await saveUserCache(data);          // refresh cache with latest user data
          set({ token, user: data, isAuthenticated: true, isOfflineSession: false });
        } else {
          // Server responded but rejected the session (unusual — normally a 401)
          await deleteToken();
          await clearUserCache();
        }
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;

        if (status === 401 || status === 403) {
          // Server explicitly rejected the token — clear everything, force re-login.
          await deleteToken();
          await clearUserCache();
          return;
        }

        // Network unreachable (status is undefined), server error (5xx), or timeout.
        // Restore from cache so the user can work offline with read-only access.
        // Role checks and workshop restrictions are enforced by the server on every
        // write; the cached user is only used to render the UI and route to screens.
        const cachedUser = await loadUserCache();
        if (cachedUser) {
          set({ token, user: cachedUser, isAuthenticated: true, isOfflineSession: true });
        } else {
          // No cache — cannot restore without a server round-trip.
          await deleteToken();
        }
      }
    } finally {
      set({ isLoading: false });
    }
  },

  // Called by networkMonitor when connectivity is restored.
  // Re-checks /api/auth/me and refreshes the user profile (role may have changed).
  // On 401 (token expired while offline) → logs out.
  // On network error → does nothing (still offline, stay as-is).
  revalidateSession: async () => {
    const { isAuthenticated } = get();
    if (!isAuthenticated) return;

    try {
      const data = await meApi();
      if (data.ok) {
        await saveUserCache(data);
        set({ user: data, isOfflineSession: false });
      }
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403) {
        // Token expired while the device was offline
        get().onUnauthorized();
      }
      // Network still unreachable — leave session as-is
    }
  },

  onUnauthorized: () => {
    // Called by the Axios 401 interceptor. The interceptor has already cleared
    // the token from SecureStore; clear the cache here synchronously.
    clearUserCache().catch(() => {});
    set({ user: null, token: null, isAuthenticated: false, isOfflineSession: false });
  },

  clearError: () => set({ error: null }),
}));
