import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LogTransportStackParamList } from './types';
import { LogTransportListScreen }   from '../screens/harvest/LogTransportListScreen';
import { LogTransportCreateScreen } from '../screens/harvest/LogTransportCreateScreen';
import { LogTransportDetailScreen } from '../screens/harvest/LogTransportDetailScreen';

const Stack = createNativeStackNavigator<LogTransportStackParamList>();

export function LogTransportStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="LogTransportList"   component={LogTransportListScreen} />
      <Stack.Screen name="LogTransportCreate" component={LogTransportCreateScreen} />
      <Stack.Screen name="LogTransportDetail" component={LogTransportDetailScreen} />
    </Stack.Navigator>
  );
}
