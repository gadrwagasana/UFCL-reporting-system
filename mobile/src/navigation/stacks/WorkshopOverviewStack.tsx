import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { WorkshopOverviewStackParamList } from '../types';
import { WorkshopOverviewScreen } from '../../screens/workshops/WorkshopOverviewScreen';

const Stack = createNativeStackNavigator<WorkshopOverviewStackParamList>();

export function WorkshopOverviewStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="WorkshopOverview" component={WorkshopOverviewScreen} />
    </Stack.Navigator>
  );
}
