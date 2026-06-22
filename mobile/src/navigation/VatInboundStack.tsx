import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { VatInboundStackParamList } from './types';
import { VatInboundScreen }         from '../screens/vat/VatInboundScreen';
import { VatIntakeScreen }          from '../screens/vat/VatIntakeScreen';

const Stack = createNativeStackNavigator<VatInboundStackParamList>();

export function VatInboundStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="VatInboundList"  component={VatInboundScreen} />
      <Stack.Screen name="VatIntakeCreate" component={VatIntakeScreen} />
    </Stack.Navigator>
  );
}
