import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HarvestStackParamList } from './types';
import { HarvestListScreen }   from '../screens/harvest/HarvestListScreen';
import { HarvestCreateScreen } from '../screens/harvest/HarvestCreateScreen';
import { HarvestDetailScreen } from '../screens/harvest/HarvestDetailScreen';

const Stack = createNativeStackNavigator<HarvestStackParamList>();

export function HarvestStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="HarvestList"   component={HarvestListScreen} />
      <Stack.Screen name="HarvestCreate" component={HarvestCreateScreen} />
      <Stack.Screen name="HarvestDetail" component={HarvestDetailScreen} />
    </Stack.Navigator>
  );
}
