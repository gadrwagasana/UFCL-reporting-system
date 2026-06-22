import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types/auth';

const TOKEN_KEY    = 'ufcl_jwt_token';
const USER_CACHE_KEY = '@ufcl/session_user';

// ── JWT (SecureStore — hardware-backed encryption) ────────────────────────────

export async function saveToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function loadToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function deleteToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    // already absent
  }
}

// ── User cache (AsyncStorage) ─────────────────────────────────────────────────
// Stores the last known User object so the app can restore a session during
// offline startup without making a network call. The JWT in SecureStore is the
// authoritative credential; this cache is only for the user profile fields.
// On reconnect, GET /api/auth/me revalidates and overwrites this cache.

export async function saveUserCache(user: User): Promise<void> {
  try {
    await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
  } catch {
    // non-fatal — worst case is an extra login prompt
  }
}

export async function loadUserCache(): Promise<User | null> {
  try {
    const raw = await AsyncStorage.getItem(USER_CACHE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export async function clearUserCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(USER_CACHE_KEY);
  } catch {
    // non-fatal
  }
}
