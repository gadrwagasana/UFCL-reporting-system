import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HarvestStackParamList } from './types';
import { HarvestListScreen }      from '../screens/harvest/HarvestListScreen';
import { HarvestCreateScreen }    from '../screens/harvest/HarvestCreateScreen';
import { HarvestDetailScreen }    from '../screens/harvest/HarvestDetailScreen';
import { HarvestDashboardScreen } from '../screens/harvest/HarvestDashboardScreen';
import { HarvestPlanListScreen }  from '../screens/harvest/HarvestPlanListScreen';
import { HarvestPlanFormScreen }  from '../screens/harvest/HarvestPlanFormScreen';
import { HarvestOperationsScreen } from '../screens/harvest/HarvestOperationsScreen';
import { HarvestDelaysScreen }     from '../screens/harvest/HarvestDelaysScreen';
import { HarvestDelayFormScreen }  from '../screens/harvest/HarvestDelayFormScreen';
import { HarvestWasteScreen }      from '../screens/harvest/HarvestWasteScreen';

const Stack = createNativeStackNavigator<HarvestStackParamList>();

export function HarvestStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="HarvestList"      component={HarvestListScreen} />
      <Stack.Screen name="HarvestCreate"    component={HarvestCreateScreen} />
      <Stack.Screen name="HarvestDetail"    component={HarvestDetailScreen} />
      {/* Harvesting Phase 1 (Workstream 2) */}
      <Stack.Screen name="HarvestDashboard" component={HarvestDashboardScreen} />
      {/* Harvesting Phase 2 (Workstream 1) */}
      <Stack.Screen name="HarvestPlanList"  component={HarvestPlanListScreen} />
      <Stack.Screen name="HarvestPlanForm"  component={HarvestPlanFormScreen} />
      {/* Harvesting Phase 3 (Workstreams 1-3) */}
      <Stack.Screen name="HarvestOperations" component={HarvestOperationsScreen} />
      <Stack.Screen name="HarvestDelays"     component={HarvestDelaysScreen} />
      <Stack.Screen name="HarvestDelayForm"  component={HarvestDelayFormScreen} />
      {/* Enterprise Timber Lifecycle Integration Program — Phase 1 */}
      <Stack.Screen name="HarvestWaste"      component={HarvestWasteScreen} />
    </Stack.Navigator>
  );
}
