import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { VatEntriesStackParamList } from './types';
import { VatProcessingScreen }      from '../screens/vat/VatProcessingScreen';
import { VatDetailScreen }          from '../screens/vat/VatDetailScreen';

const Stack = createNativeStackNavigator<VatEntriesStackParamList>();

export function VatEntriesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="VatProcessingList" component={VatProcessingScreen} />
      <Stack.Screen name="VatDetail"         component={VatDetailScreen} />
    </Stack.Navigator>
  );
}
