import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MaterialRequestsStackParamList } from './types';
import { MaterialRequestsListScreen }  from '../screens/material/MaterialRequestsListScreen';
import { MaterialRequestCreateScreen } from '../screens/material/MaterialRequestCreateScreen';
import { MaterialRequestDetailScreen } from '../screens/material/MaterialRequestDetailScreen';

const Stack = createNativeStackNavigator<MaterialRequestsStackParamList>();

export function MaterialRequestsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="MaterialRequestsList"  component={MaterialRequestsListScreen} />
      <Stack.Screen name="MaterialRequestCreate" component={MaterialRequestCreateScreen} />
      <Stack.Screen name="MaterialRequestDetail" component={MaterialRequestDetailScreen} />
    </Stack.Navigator>
  );
}
