import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SawmillStackParamList } from './types';
import { SawmillProductionListScreen }   from '../screens/sawmill/SawmillProductionListScreen';
import { SawmillProductionCreateScreen } from '../screens/sawmill/SawmillProductionCreateScreen';
import { SawmillProductionDetailScreen } from '../screens/sawmill/SawmillProductionDetailScreen';

const Stack = createNativeStackNavigator<SawmillStackParamList>();

export function SawmillStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="SawmillProductionList"   component={SawmillProductionListScreen} />
      <Stack.Screen name="SawmillProductionCreate" component={SawmillProductionCreateScreen} />
      <Stack.Screen name="SawmillProductionDetail" component={SawmillProductionDetailScreen} />
    </Stack.Navigator>
  );
}
