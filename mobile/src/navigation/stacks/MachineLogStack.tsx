import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MachineLogStackParamList }   from '../types';
import { MachineLogListScreen }       from '../../screens/machineLogs/MachineLogListScreen';
import { MachineLogCreateScreen }     from '../../screens/machineLogs/MachineLogCreateScreen';
import { MachineLogDetailScreen }     from '../../screens/machineLogs/MachineLogDetailScreen';

const Stack = createNativeStackNavigator<MachineLogStackParamList>();

export function MachineLogStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MachineLogList"   component={MachineLogListScreen} />
      <Stack.Screen name="MachineLogCreate" component={MachineLogCreateScreen} />
      <Stack.Screen name="MachineLogDetail" component={MachineLogDetailScreen} />
    </Stack.Navigator>
  );
}
