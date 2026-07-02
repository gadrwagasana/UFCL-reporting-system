import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CompartmentsStackParamList } from '../types';
import { CompartmentsListScreen } from '../../screens/compartments/CompartmentsListScreen';
import { CompartmentFormScreen }  from '../../screens/compartments/CompartmentFormScreen';

const Stack = createNativeStackNavigator<CompartmentsStackParamList>();

export function CompartmentsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CompartmentsList" component={CompartmentsListScreen} />
      <Stack.Screen name="CompartmentForm"  component={CompartmentFormScreen} />
    </Stack.Navigator>
  );
}
