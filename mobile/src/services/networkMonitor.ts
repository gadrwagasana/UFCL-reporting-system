import NetInfo from '@react-native-community/netinfo';
import { useOfflineStore } from '../stores/offlineStore';
import { useAuthStore }   from '../stores/authStore';
import { syncQueue }      from './syncService';

let _unsubscribe: (() => void) | null = null;

export function startNetworkMonitor(): void {
  if (_unsubscribe) return;
  try {
    _unsubscribe = NetInfo.addEventListener((state) => {
      const online     = state.isConnected === true && state.isInternetReachable !== false;
      const prevOnline = useOfflineStore.getState().isOnline;
      useOfflineStore.getState().setOnline(online);
      if (online && !prevOnline) {
        syncQueue().catch(console.error);
        useAuthStore.getState().revalidateSession();
      }
    });
  } catch {
    // NetInfo native module unavailable at startup — app runs in always-online
    // mode. Offline queue will not auto-sync; user can still log in and work.
  }
}

export function stopNetworkMonitor(): void {
  _unsubscribe?.();
  _unsubscribe = null;
}
