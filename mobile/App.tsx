import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';

import { RootNavigator }         from './src/navigation/RootNavigator';
import { startNetworkMonitor, stopNetworkMonitor } from './src/services/networkMonitor';
import { useOfflineStore }       from './src/stores/offlineStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:   5  * 60_000,   // 5 minutes
      gcTime:      24 * 60 * 60 * 1_000, // 24 hours
      retry:       1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  const loadQueue = useOfflineStore((s) => s.loadQueue);

  useEffect(() => {
    loadQueue();
    startNetworkMonitor();
    return () => stopNetworkMonitor();
  }, [loadQueue]);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
