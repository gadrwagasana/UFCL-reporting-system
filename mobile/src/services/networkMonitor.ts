import NetInfo from '@react-native-community/netinfo';
import { useOfflineStore } from '../stores/offlineStore';
import { syncQueue } from './syncService';

let _unsubscribe: (() => void) | null = null;

export function startNetworkMonitor(): void {
  if (_unsubscribe) return;

  _unsubscribe = NetInfo.addEventListener((state) => {
    const online = state.isConnected === true && state.isInternetReachable !== false;
    const prevOnline = useOfflineStore.getState().isOnline;
    useOfflineStore.getState().setOnline(online);

    // Flush the queue the moment we come back online
    if (online && !prevOnline) {
      syncQueue();
    }
  });
}

export function stopNetworkMonitor(): void {
  _unsubscribe?.();
  _unsubscribe = null;
}
