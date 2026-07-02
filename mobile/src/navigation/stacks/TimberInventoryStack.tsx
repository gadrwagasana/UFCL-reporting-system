import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TimberInventoryStackParamList } from '../types';
import { TimberInventoryScreen } from '../../screens/timberInventory/TimberInventoryScreen';

const Stack = createNativeStackNavigator<TimberInventoryStackParamList>();

export function TimberInventoryStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TimberInventoryDashboard" component={TimberInventoryScreen} />
    </Stack.Navigator>
  );
}
