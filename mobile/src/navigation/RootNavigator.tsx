import React, { useEffect } from 'react';
import { hideAsync as hideSplashScreen } from 'expo-splash-screen';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../stores/authStore';
import { RootStackParamList } from './types';

import { SplashScreen }        from '../screens/auth/SplashScreen';
import { LoginScreen }         from '../screens/auth/LoginScreen';
import { MainNavigator }       from './MainNavigator';
import { GlobalSearchScreen }  from '../screens/search/GlobalSearchScreen';
import { NotificationsScreen } from '../screens/notifications/NotificationsScreen';
import { GovernanceScreen }    from '../screens/governance/GovernanceScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const isLoading       = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isLoading) {
      hideSplashScreen().catch(() => {});
    }
  }, [isLoading]);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
      {isLoading ? (
        <Stack.Screen name="Splash" component={SplashScreen} />
      ) : !isAuthenticated ? (
        <Stack.Screen name="Auth" component={LoginScreen} options={{ animation: 'none' }} />
      ) : (
        <>
          <Stack.Screen name="Main" component={MainNavigator} options={{ animation: 'none' }} />
          <Stack.Screen name="GlobalSearch" component={GlobalSearchScreen} options={{ animation: 'slide_from_bottom' }} />
          {/* ERP Enterprise Completion Phase 3 (Workstream 11) — root-level,
              same pattern as GlobalSearch above, so it's reachable from any
              role's AppHeader bell regardless of which tab navigator is
              currently mounted. */}
          <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ animation: 'slide_from_bottom' }} />
          {/* ERP Enterprise Completion Phase 4 — same root-level pattern,
              reachable via a role-conditional AppHeader icon. */}
          <Stack.Screen name="Governance" component={GovernanceScreen} options={{ animation: 'slide_from_bottom' }} />
        </>
      )}
    </Stack.Navigator>
  );
}
