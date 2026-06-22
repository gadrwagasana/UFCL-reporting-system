import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PolesProductionStackParamList } from './types';
import { PolesProductionScreen }       from '../screens/poles/PolesProductionScreen';
import { PolesProductionCreateScreen } from '../screens/poles/PolesProductionCreateScreen';
import { PolesProductionDetailScreen } from '../screens/poles/PolesProductionDetailScreen';

const Stack = createNativeStackNavigator<PolesProductionStackParamList>();

export function PolesProductionStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="PolesProductionList"   component={PolesProductionScreen} />
      <Stack.Screen name="PolesProductionCreate" component={PolesProductionCreateScreen} />
      <Stack.Screen name="PolesProductionDetail" component={PolesProductionDetailScreen} />
    </Stack.Navigator>
  );
}
