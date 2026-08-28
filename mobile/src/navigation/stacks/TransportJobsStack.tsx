import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { TransportJobsStackParamList } from '../types';
import { TransportJobsListScreen } from '../../screens/transport/TransportJobsListScreen';
import { TransportJobFormScreen } from '../../screens/transport/TransportJobFormScreen';

const Stack = createNativeStackNavigator<TransportJobsStackParamList>();

export function TransportJobsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TransportJobsList" component={TransportJobsListScreen} />
      <Stack.Screen name="TransportJobForm"  component={TransportJobFormScreen} />
    </Stack.Navigator>
  );
}
