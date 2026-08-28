import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MaintenanceJobsStackParamList } from './types';
import { MaintenanceJobsListScreen } from '../screens/maintenance/MaintenanceJobsListScreen';
import { MaintenanceJobDetailScreen } from '../screens/maintenance/MaintenanceJobDetailScreen';
import { MaintenanceJobCreateScreen } from '../screens/maintenance/MaintenanceJobCreateScreen';
import { MaintenanceWaitingForPartsScreen } from '../screens/maintenance/MaintenanceWaitingForPartsScreen';

const Stack = createNativeStackNavigator<MaintenanceJobsStackParamList>();

// Mechanician Phase 3 — shared across role navigators, same pattern as
// MaterialRequestsStack/MachineLogStack.
export function MaintenanceJobsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="MaintenanceJobsList"  component={MaintenanceJobsListScreen} />
      <Stack.Screen name="MaintenanceJobDetail" component={MaintenanceJobDetailScreen} />
      <Stack.Screen name="MaintenanceJobCreate" component={MaintenanceJobCreateScreen} />
      {/* Stabilization Phase 5 (F-28) */}
      <Stack.Screen name="MaintenanceWaitingForParts" component={MaintenanceWaitingForPartsScreen} />
    </Stack.Navigator>
  );
}
