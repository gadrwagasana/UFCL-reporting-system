import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { VehicleFuelStackParamList }    from '../types';
import { VehicleFuelListScreen }        from '../../screens/vehicleFuel/VehicleFuelListScreen';
import { VehicleFuelCreateScreen }      from '../../screens/vehicleFuel/VehicleFuelCreateScreen';
import { VehicleFuelDetailScreen }      from '../../screens/vehicleFuel/VehicleFuelDetailScreen';

const Stack = createNativeStackNavigator<VehicleFuelStackParamList>();

export function VehicleFuelStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="VehicleFuelList"   component={VehicleFuelListScreen} />
      <Stack.Screen name="VehicleFuelCreate" component={VehicleFuelCreateScreen} />
      <Stack.Screen name="VehicleFuelDetail" component={VehicleFuelDetailScreen} />
    </Stack.Navigator>
  );
}
