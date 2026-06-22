import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PolesDeliveryStackParamList }  from './types';
import { PolesDeliveriesScreen }        from '../screens/poles/PolesDeliveriesScreen';
import { PolesDeliveryCreateScreen }    from '../screens/poles/PolesDeliveryCreateScreen';

const Stack = createNativeStackNavigator<PolesDeliveryStackParamList>();

export function PolesDeliveryStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="PolesDeliveryList"   component={PolesDeliveriesScreen} />
      <Stack.Screen name="PolesDeliveryCreate" component={PolesDeliveryCreateScreen} />
    </Stack.Navigator>
  );
}
