import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { checkForUpdate, UpdateMeta } from '../services/updateChecker';

const CHECK_INTERVAL_MS  = 4 * 60 * 60 * 1_000;  // 4 h periodic re-check
const FOREGROUND_COOL_MS = 10 * 60 * 1_000;       // only re-check if backgrounded 10+ min
const STARTUP_DELAY_MS   = 3_000;                  // wait 3 s so splash/login renders first

interface UpdateState {
  updateAvailable: boolean;
  mandatory:       boolean;
  meta:            UpdateMeta | null;
  dismiss:         () => void;
  triggerCheck:    () => void; // call after login for immediate re-check
}

export function useUpdateChecker(): UpdateState {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [mandatory,       setMandatory]       = useState(false);
  const [meta,            setMeta]            = useState<UpdateMeta | null>(null);

  const intervalRef     = useRef<ReturnType<typeof setInterval>  | null>(null);
  const checkingRef     = useRef(false);   // prevent concurrent checks
  const backgroundedAt  = useRef<number>(0); // timestamp when app went to background

  // ── Core check ─────────────────────────────────────────────────────────────
  const runCheck = useCallback(async () => {
    if (checkingRef.current) return; // deduplicate concurrent calls
    checkingRef.current = true;
    try {
      const result = await checkForUpdate();
      if (result.available && result.meta) {
        setMeta(result.meta);
        setMandatory(result.mandatory);
        setUpdateAvailable(true);
      }
    } catch {
      // silent — network may be unavailable
    } finally {
      checkingRef.current = false;
    }
  }, []);

  // ── AppState foreground listener ────────────────────────────────────────────
  // Re-checks when the app returns to foreground after being away for 10+ minutes.
  // This covers the "After successful login" case: Splash → Lock screen → Unlock
  // → user is back — check now rather than waiting for the periodic interval.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') {
        backgroundedAt.current = Date.now();
      } else if (next === 'active') {
        const away = Date.now() - backgroundedAt.current;
        if (backgroundedAt.current > 0 && away >= FOREGROUND_COOL_MS) {
          runCheck();
        }
      }
    });
    return () => sub.remove();
  }, [runCheck]);

  // ── Startup check + 4-hour periodic interval ────────────────────────────────
  useEffect(() => {
    const initial = setTimeout(runCheck, STARTUP_DELAY_MS);
    intervalRef.current = setInterval(runCheck, CHECK_INTERVAL_MS);
    return () => {
      clearTimeout(initial);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [runCheck]);

  // ── Dismiss ────────────────────────────────────────────────────────────────
  const dismiss = useCallback(() => {
    setUpdateAvailable(false);
    setMeta(null);
  }, []);

  // ── Manual trigger (e.g. post-login) ───────────────────────────────────────
  const triggerCheck = useCallback(() => {
    runCheck();
  }, [runCheck]);

  return { updateAvailable, mandatory, meta, dismiss, triggerCheck };
}
