import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types/auth';
import type { SearchFilters } from '../types/api';

const TOKEN_KEY    = 'ufcl_jwt_token';
const USER_CACHE_KEY = '@ufcl/session_user';
const RECENT_SEARCHES_KEY = '@ufcl/recent_searches';
const MAX_RECENT_SEARCHES = 10;
const FAVORITE_SEARCHES_KEY = '@ufcl/favorite_searches';
const MAX_FAVORITE_SEARCHES = 20;

export interface FavoriteSearch {
  id: string;
  query: string;
  filters: SearchFilters;
  savedAt: string;
}

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

// ── Recent searches (AsyncStorage) ────────────────────────────────────────────
// Most-recent-first, deduplicated, capped at MAX_RECENT_SEARCHES. Purely a local
// UX convenience — never sent to the server.

export async function loadRecentSearches(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export async function saveRecentSearch(query: string): Promise<string[]> {
  const q = query.trim();
  if (!q) return loadRecentSearches();
  try {
    const existing = await loadRecentSearches();
    const next = [q, ...existing.filter((s) => s.toLowerCase() !== q.toLowerCase())].slice(0, MAX_RECENT_SEARCHES);
    await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
    return next;
  } catch {
    // non-fatal — worst case recent searches just don't persist
    return loadRecentSearches();
  }
}

export async function removeRecentSearch(query: string): Promise<string[]> {
  try {
    const existing = await loadRecentSearches();
    const next = existing.filter((s) => s.toLowerCase() !== query.trim().toLowerCase());
    await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
    return next;
  } catch {
    return loadRecentSearches();
  }
}

export async function clearRecentSearches(): Promise<void> {
  try {
    await AsyncStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch {
    // non-fatal
  }
}

// ── Favorite searches (AsyncStorage) ──────────────────────────────────────────
// Starred {query, filters} combos the user wants to re-run quickly. Same
// local-only, fail-soft pattern as recent searches — never sent to the server.

export async function loadFavoriteSearches(): Promise<FavoriteSearch[]> {
  try {
    const raw = await AsyncStorage.getItem(FAVORITE_SEARCHES_KEY);
    return raw ? (JSON.parse(raw) as FavoriteSearch[]) : [];
  } catch {
    return [];
  }
}

export async function saveFavoriteSearch(query: string, filters: SearchFilters): Promise<FavoriteSearch[]> {
  const q = query.trim();
  if (!q) return loadFavoriteSearches();
  try {
    const existing = await loadFavoriteSearches();
    const entry: FavoriteSearch = { id: `${Date.now()}`, query: q, filters, savedAt: new Date().toISOString() };
    const next = [entry, ...existing.filter((f) => f.query.toLowerCase() !== q.toLowerCase())].slice(0, MAX_FAVORITE_SEARCHES);
    await AsyncStorage.setItem(FAVORITE_SEARCHES_KEY, JSON.stringify(next));
    return next;
  } catch {
    return loadFavoriteSearches();
  }
}

export async function removeFavoriteSearch(id: string): Promise<FavoriteSearch[]> {
  try {
    const existing = await loadFavoriteSearches();
    const next = existing.filter((f) => f.id !== id);
    await AsyncStorage.setItem(FAVORITE_SEARCHES_KEY, JSON.stringify(next));
    return next;
  } catch {
    return loadFavoriteSearches();
  }
}

// ── Saved Filters (AsyncStorage) ──────────────────────────────────────────────
// Enterprise UI/UX Standardization Phase 3 — generic, per-screen-keyed
// filter presets, same capped/fail-soft architecture as favorite searches
// above (mirrors the desktop app's identical localStorage helpers). This is
// a reference implementation applied to one list screen only — see
// ERP_DESIGN_SYSTEM_GUIDE.md for rollout to other screens.
const SAVED_FILTERS_PREFIX = '@ufcl/saved_filters_';
const MAX_SAVED_FILTERS = 10;

export interface SavedFilterPreset<T = Record<string, unknown>> {
  id: string;
  name: string;
  filterValues: T;
  savedAt: string;
}

export async function loadSavedFilters<T = Record<string, unknown>>(screenKey: string): Promise<SavedFilterPreset<T>[]> {
  try {
    const raw = await AsyncStorage.getItem(SAVED_FILTERS_PREFIX + screenKey);
    return raw ? (JSON.parse(raw) as SavedFilterPreset<T>[]) : [];
  } catch {
    return [];
  }
}

export async function saveFilterPreset<T = Record<string, unknown>>(screenKey: string, name: string, filterValues: T): Promise<SavedFilterPreset<T>[]> {
  const n = name.trim();
  if (!n) return loadSavedFilters<T>(screenKey);
  try {
    const existing = await loadSavedFilters<T>(screenKey);
    const entry: SavedFilterPreset<T> = { id: `${Date.now()}`, name: n, filterValues, savedAt: new Date().toISOString() };
    const next = [entry, ...existing.filter((f) => f.name.toLowerCase() !== n.toLowerCase())].slice(0, MAX_SAVED_FILTERS);
    await AsyncStorage.setItem(SAVED_FILTERS_PREFIX + screenKey, JSON.stringify(next));
    return next;
  } catch {
    return loadSavedFilters<T>(screenKey);
  }
}

export async function removeFilterPreset<T = Record<string, unknown>>(screenKey: string, id: string): Promise<SavedFilterPreset<T>[]> {
  try {
    const existing = await loadSavedFilters<T>(screenKey);
    const next = existing.filter((f) => f.id !== id);
    await AsyncStorage.setItem(SAVED_FILTERS_PREFIX + screenKey, JSON.stringify(next));
    return next;
  } catch {
    return loadSavedFilters<T>(screenKey);
  }
}

// ── Recently Viewed (AsyncStorage) ────────────────────────────────────────────
// Enterprise UI/UX Standardization Phase 3 — generic, per-record-type-keyed
// recently-viewed list, same architecture as Saved Filters above. Reference
// implementation: call pushRecentlyViewed() from a detail screen's mount,
// render loadRecentlyViewed() as a small widget on the corresponding list
// screen.
const RECENTLY_VIEWED_PREFIX = '@ufcl/recently_viewed_';
const MAX_RECENTLY_VIEWED = 8;

export interface RecentlyViewedEntry {
  id: string;
  label: string;
  viewedAt: string;
}

export async function loadRecentlyViewed(recordType: string): Promise<RecentlyViewedEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENTLY_VIEWED_PREFIX + recordType);
    return raw ? (JSON.parse(raw) as RecentlyViewedEntry[]) : [];
  } catch {
    return [];
  }
}

export async function pushRecentlyViewed(recordType: string, id: string, label: string): Promise<RecentlyViewedEntry[]> {
  try {
    const existing = await loadRecentlyViewed(recordType);
    const entry: RecentlyViewedEntry = { id, label, viewedAt: new Date().toISOString() };
    const next = [entry, ...existing.filter((e) => e.id !== id)].slice(0, MAX_RECENTLY_VIEWED);
    await AsyncStorage.setItem(RECENTLY_VIEWED_PREFIX + recordType, JSON.stringify(next));
    return next;
  } catch {
    return loadRecentlyViewed(recordType);
  }
}
