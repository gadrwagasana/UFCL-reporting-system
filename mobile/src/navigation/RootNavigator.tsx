import React, { useEffect } from 'react';
import { hideAsync as hideSplashScreen } from 'expo-splash-screen';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../stores/authStore';
import { RootStackParamList } from './types';

import { SplashScreen }  from '../screens/auth/SplashScreen';
import { LoginScreen }   from '../screens/auth/LoginScreen';
import { MainNavigator } from './MainNavigator';

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
        <Stack.Screen name="Main" component={MainNavigator} options={{ animation: 'none' }} />
      )}
    </Stack.Navigator>
  );
}
