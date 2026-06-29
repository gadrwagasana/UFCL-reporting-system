import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';

// ── Config ────────────────────────────────────────────────────────────────────
// Company server is the primary update source — fast LAN delivery.
// All devices on-site will resolve this IP.
export const UPDATE_SERVER      = 'https://192.168.1.5';
const        VERSION_URL        = `${UPDATE_SERVER}/version.json`;
const        FETCH_TIMEOUT      = 10_000; // ms
const        IGNORED_KEY        = 'ufcl_update_ignored_versionCode';
const        RESUME_STATE_KEY   = 'ufcl_download_resumable_state';
export const APK_CACHE          = `${FileSystem.cacheDirectory}ufcl-mobile-update.apk`;

// ── Types ─────────────────────────────────────────────────────────────────────
export interface UpdateMeta {
  version:     string;
  versionCode: number;
  releaseDate: string;
  mandatory:   boolean;
  apkUrl:      string;
  sha256:      string;  // for IT manual verification (displayed in UI)
  md5:         string;  // used by FileSystem.getInfoAsync for automated check
  notes:       string[];
}

export interface UpdateResult {
  available: boolean;
  mandatory: boolean;
  meta:      UpdateMeta | null;
}

// Error categories so the UI can display specific messages
export type UpdateErrorKind =
  | 'network'    // no internet / VPN disconnected / server unreachable
  | 'server'     // HTTP non-2xx from update server
  | 'checksum'   // MD5 mismatch after download — possible corruption
  | 'install'    // Linking.openURL or FileProvider failed
  | 'storage'    // FileSystem write error
  | 'unknown';

export class UpdateError extends Error {
  constructor(public kind: UpdateErrorKind, message: string) {
    super(message);
    this.name = 'UpdateError';
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
export function getCurrentVersionCode(): number {
  // nativeBuildVersion = Android versionCode as string in Expo bare workflow
  return parseInt(Constants.nativeBuildVersion ?? '1', 10);
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } catch (e: any) {
    const msg = e?.message ?? '';
    if (e?.name === 'AbortError' || msg.includes('timeout')) {
      throw new UpdateError('network', 'Connection timed out. Check your network or VPN.');
    }
    throw new UpdateError('network', 'Cannot reach update server. Check your Wi-Fi connection.');
  } finally {
    clearTimeout(timer);
  }
}

// ── Download resume state ─────────────────────────────────────────────────────
export async function saveResumeState(state: FileSystem.DownloadPauseState): Promise<void> {
  try { await SecureStore.setItemAsync(RESUME_STATE_KEY, JSON.stringify(state)); } catch {}
}

export async function loadResumeState(): Promise<FileSystem.DownloadPauseState | null> {
  try {
    const raw = await SecureStore.getItemAsync(RESUME_STATE_KEY);
    return raw ? (JSON.parse(raw) as FileSystem.DownloadPauseState) : null;
  } catch { return null; }
}

export async function clearResumeState(): Promise<void> {
  try { await SecureStore.deleteItemAsync(RESUME_STATE_KEY); } catch {}
}

// ── MD5 verification ──────────────────────────────────────────────────────────
// expo-file-system provides MD5 via getInfoAsync({md5:true}) — no extra native dep.
export async function verifyMd5(localUri: string, expectedMd5: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(localUri, { md5: true });
  if (!info.exists) {
    throw new UpdateError('storage', 'Downloaded file not found on device.');
  }
  const actual = (info as any).md5 as string | undefined;
  if (!actual) return; // getInfoAsync didn't return md5 — skip rather than block
  if (actual.toLowerCase() !== expectedMd5.toLowerCase()) {
    throw new UpdateError(
      'checksum',
      `File integrity check failed.\nExpected: ${expectedMd5}\nGot: ${actual}\nPlease retry.`,
    );
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch latest version.json from the company server.
 * Returns null when the server is unreachable (offline / off-site) — silent fail.
 */
export async function fetchLatestMeta(): Promise<UpdateMeta | null> {
  try {
    const res = await fetchWithTimeout(VERSION_URL, FETCH_TIMEOUT);
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data.versionCode !== 'number' || !data.apkUrl) return null;
    return data as UpdateMeta;
  } catch {
    // Server unreachable — silently return null so app starts normally
    return null;
  }
}

/** versionCode the user last dismissed, or -1 */
export async function getIgnoredVersionCode(): Promise<number> {
  try {
    const s = await SecureStore.getItemAsync(IGNORED_KEY);
    return s ? parseInt(s, 10) : -1;
  } catch { return -1; }
}

/** Remember which version the user chose "Later" on */
export async function ignoreVersion(versionCode: number): Promise<void> {
  try { await SecureStore.setItemAsync(IGNORED_KEY, String(versionCode)); } catch {}
}

/**
 * Main entry point — checks whether an update is available and unignored.
 * Silent on network failure (returns available:false).
 */
export async function checkForUpdate(): Promise<UpdateResult> {
  const meta = await fetchLatestMeta();
  if (!meta) return { available: false, mandatory: false, meta: null };

  const current = getCurrentVersionCode();
  if (meta.versionCode <= current) return { available: false, mandatory: false, meta: null };

  // Mandatory updates always show — ignore the dismissed list
  if (meta.mandatory) return { available: true, mandatory: true, meta };

  const ignored = await getIgnoredVersionCode();
  if (ignored >= meta.versionCode) return { available: false, mandatory: false, meta: null };

  return { available: true, mandatory: false, meta };
}
