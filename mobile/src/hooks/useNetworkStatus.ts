import { useEffect } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useOfflineStore } from '../stores/offlineStore';

export function useNetworkStatus(): { isOnline: boolean } {
  const setOnline = useOfflineStore((s) => s.setOnline);
  const isOnline  = useOfflineStore((s) => s.isOnline);

  useEffect(() => {
    // Set initial state
    NetInfo.fetch().then((state: NetInfoState) => {
      setOnline(state.isConnected === true && state.isInternetReachable !== false);
    });

    const unsub = NetInfo.addEventListener((state: NetInfoState) => {
      setOnline(state.isConnected === true && state.isInternetReachable !== false);
    });

    return unsub;
  }, [setOnline]);

  return { isOnline };
}
