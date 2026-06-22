import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CasualLabourStackParamList } from './types';
import { CasualLabourListScreen }   from '../screens/labour/CasualLabourListScreen';
import { CasualLabourCreateScreen } from '../screens/labour/CasualLabourCreateScreen';
import { CasualLabourDetailScreen } from '../screens/labour/CasualLabourDetailScreen';

const Stack = createNativeStackNavigator<CasualLabourStackParamList>();

export function CasualLabourStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="CasualLabourList"   component={CasualLabourListScreen} />
      <Stack.Screen name="CasualLabourCreate" component={CasualLabourCreateScreen} />
      <Stack.Screen name="CasualLabourDetail" component={CasualLabourDetailScreen} />
    </Stack.Navigator>
  );
}
