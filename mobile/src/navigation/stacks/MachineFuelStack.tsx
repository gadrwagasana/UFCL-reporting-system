import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MachineFuelStackParamList }  from '../types';
import { MachineFuelListScreen }      from '../../screens/machineFuel/MachineFuelListScreen';
import { MachineFuelCreateScreen }    from '../../screens/machineFuel/MachineFuelCreateScreen';
import { MachineFuelDetailScreen }    from '../../screens/machineFuel/MachineFuelDetailScreen';

const Stack = createNativeStackNavigator<MachineFuelStackParamList>();

export function MachineFuelStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MachineFuelList"   component={MachineFuelListScreen} />
      <Stack.Screen name="MachineFuelCreate" component={MachineFuelCreateScreen} />
      <Stack.Screen name="MachineFuelDetail" component={MachineFuelDetailScreen} />
    </Stack.Navigator>
  );
}
