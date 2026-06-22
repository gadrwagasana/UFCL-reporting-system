import NetInfo from '@react-native-community/netinfo';
import { useOfflineStore } from '../stores/offlineStore';
import { useAuthStore }   from '../stores/authStore';
import { syncQueue }      from './syncService';

let _unsubscribe: (() => void) | null = null;

export function startNetworkMonitor(): void {
  if (_unsubscribe) return;

  _unsubscribe = NetInfo.addEventListener((state) => {
    const online    = state.isConnected === true && state.isInternetReachable !== false;
    const prevOnline = useOfflineStore.getState().isOnline;
    useOfflineStore.getState().setOnline(online);

    if (online && !prevOnline) {
      // Flush any queued offline writes first, then revalidate the session.
      // Revalidation refreshes the user profile and catches tokens that expired
      // while the device was offline (logout if 401, no-op if still valid).
      syncQueue();
      useAuthStore.getState().revalidateSession();
    }
  });
}

export function stopNetworkMonitor(): void {
  _unsubscribe?.();
  _unsubscribe = null;
}
