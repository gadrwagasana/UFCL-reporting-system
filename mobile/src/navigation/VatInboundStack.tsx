import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { VatInboundStackParamList } from './types';
import { VatInboundScreen }         from '../screens/vat/VatInboundScreen';

const Stack = createNativeStackNavigator<VatInboundStackParamList>();

// Nyanza Value-Added Production Completion Phase — VatInboundScreen is now
// the batch-creation form directly (no more "pick a transfer, then create"
// 2-step flow), so this stack is down to one screen.
export function VatInboundStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="VatInboundList" component={VatInboundScreen} />
    </Stack.Navigator>
  );
}
