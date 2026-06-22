import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PolesPurchaseStackParamList }   from './types';
import { PolesPurchaseRequestsScreen }   from '../screens/poles/PolesPurchaseRequestsScreen';
import { PolesPurchaseCreateScreen }     from '../screens/poles/PolesPurchaseCreateScreen';

const Stack = createNativeStackNavigator<PolesPurchaseStackParamList>();

export function PolesPurchaseStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="PolesPurchaseList"   component={PolesPurchaseRequestsScreen} />
      <Stack.Screen name="PolesPurchaseCreate" component={PolesPurchaseCreateScreen} />
    </Stack.Navigator>
  );
}
