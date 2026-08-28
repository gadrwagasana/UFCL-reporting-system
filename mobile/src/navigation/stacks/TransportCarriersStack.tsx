import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { TransportCarriersStackParamList } from '../types';
import { TransportCarriersListScreen } from '../../screens/transport/TransportCarriersListScreen';
import { TransportCarrierFormScreen } from '../../screens/transport/TransportCarrierFormScreen';

const Stack = createNativeStackNavigator<TransportCarriersStackParamList>();

export function TransportCarriersStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TransportCarriersList" component={TransportCarriersListScreen} />
      <Stack.Screen name="TransportCarrierForm"  component={TransportCarrierFormScreen} />
    </Stack.Navigator>
  );
}
