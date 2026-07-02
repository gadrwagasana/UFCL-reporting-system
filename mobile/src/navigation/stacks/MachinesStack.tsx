import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MachinesStackParamList } from '../types';
import { MachinesListScreen }               from '../../screens/machines/MachinesListScreen';
import { MachineDetailScreen }              from '../../screens/machines/MachineDetailScreen';
import { MachineFormScreen }                from '../../screens/machines/MachineFormScreen';
import { MachineMaintScheduleCreateScreen } from '../../screens/machines/MachineMaintScheduleCreateScreen';
import { MachineCategoriesScreen }          from '../../screens/machines/MachineCategoriesScreen';

const Stack = createNativeStackNavigator<MachinesStackParamList>();

export function MachinesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MachinesList"               component={MachinesListScreen} />
      <Stack.Screen name="MachineDetail"              component={MachineDetailScreen} />
      <Stack.Screen name="MachineForm"                component={MachineFormScreen} />
      <Stack.Screen name="MachineMaintScheduleCreate" component={MachineMaintScheduleCreateScreen} />
      <Stack.Screen name="MachineCategories"          component={MachineCategoriesScreen} />
    </Stack.Navigator>
  );
}
