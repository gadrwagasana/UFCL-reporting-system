import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MyRequestsStackParamList } from '../types';
import { MyRequestsScreen } from '../../screens/shared/MyRequestsScreen';
import { ChangesScreen }    from '../../screens/admin/ChangesScreen';

const Stack = createNativeStackNavigator<MyRequestsStackParamList>();

export function MyRequestsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MyRequestsMain" component={MyRequestsScreen} />
      <Stack.Screen name="Changes"        component={ChangesScreen} />
    </Stack.Navigator>
  );
}
