import 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
SplashScreen.preventAutoHideAsync().catch(() => {});
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, View, Text, ScrollView } from 'react-native';

import { RootNavigator }  from './src/navigation/RootNavigator';
import { UpdateModal }    from './src/components/UpdateModal';
import { useUpdateChecker } from './src/hooks/useUpdateChecker';

// ─── Release error boundary ───────────────────────────────────────────────────
// Catches React render errors and displays them on-screen instead of crashing.
// Removed in a future release once stability is confirmed.
interface EBState { error: Error | null }
class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, EBState> {
  state: EBState = { error: null };
  static getDerivedStateFromError(e: Error): EBState { return { error: e }; }
  render() {
    const { error } = this.state;
    if (error) {
      return (
        <View style={eb.wrap}>
          <Text style={eb.title}>UFCL — Startup Error</Text>
          <Text style={eb.msg}>{error.message}</Text>
          <ScrollView><Text style={eb.stack}>{error.stack ?? ''}</Text></ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}
const eb = StyleSheet.create({
  wrap:  { flex: 1, backgroundColor: '#7b0000', padding: 24, paddingTop: 60 },
  title: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  msg:   { color: '#ffd0d0', fontSize: 14, marginBottom: 12 },
  stack: { color: 'rgba(255,255,255,0.7)', fontSize: 10 },
});

// ─── Query client ─────────────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:            5  * 60_000,
      gcTime:               24 * 60 * 60 * 1_000,
      retry:                1,
      refetchOnWindowFocus: false,
    },
  },
});

// ─── Root ─────────────────────────────────────────────────────────────────────
// No useEffect here. All service initialisation (offline queue, network monitor)
// is deferred to MainNavigator, which only mounts after the user has logged in.
// This guarantees the Login screen renders without any service dependencies.
function AppShell() {
  const { updateAvailable, mandatory, meta, dismiss } = useUpdateChecker();
  return (
    <>
      <RootNavigator />
      {updateAvailable && meta && (
        <UpdateModal meta={meta} onDismiss={dismiss} />
      )}
    </>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <NavigationContainer>
              <AppShell />
            </NavigationContainer>
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </AppErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
