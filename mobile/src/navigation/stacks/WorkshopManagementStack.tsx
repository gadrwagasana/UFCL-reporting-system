import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { WorkshopManagementStackParamList } from '../types';
import { WorkshopsListScreen } from '../../screens/workshops/WorkshopsListScreen';
import { WorkshopFormScreen }  from '../../screens/workshops/WorkshopFormScreen';

const Stack = createNativeStackNavigator<WorkshopManagementStackParamList>();

export function WorkshopManagementStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="WorkshopsList" component={WorkshopsListScreen} />
      <Stack.Screen name="WorkshopForm"  component={WorkshopFormScreen} />
    </Stack.Navigator>
  );
}
