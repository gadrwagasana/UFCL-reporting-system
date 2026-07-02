import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { DispatchStackParamList } from '../types';
import { DispatchListScreen } from '../../screens/dispatch/DispatchListScreen';
import { DispatchFormScreen } from '../../screens/dispatch/DispatchFormScreen';

const Stack = createNativeStackNavigator<DispatchStackParamList>();

export function DispatchStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DispatchList"       component={DispatchListScreen} />
      <Stack.Screen name="DispatchNewRequest" component={DispatchFormScreen} />
    </Stack.Navigator>
  );
}
