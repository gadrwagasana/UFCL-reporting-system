import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { VehiclesStackParamList }             from '../types';
import { VehiclesListScreen }                 from '../../screens/vehicles/VehiclesListScreen';
import { VehicleDetailScreen }                from '../../screens/vehicles/VehicleDetailScreen';
import { VehicleFormScreen }                  from '../../screens/vehicles/VehicleFormScreen';
import { VehicleFuelLogCreateScreen }         from '../../screens/vehicles/VehicleFuelLogCreateScreen';
import { VehicleMaintenanceCreateScreen }     from '../../screens/vehicles/VehicleMaintenanceCreateScreen';

const Stack = createNativeStackNavigator<VehiclesStackParamList>();

export function VehiclesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="VehiclesList"             component={VehiclesListScreen} />
      <Stack.Screen name="VehicleDetail"            component={VehicleDetailScreen} />
      <Stack.Screen name="VehicleForm"              component={VehicleFormScreen} />
      <Stack.Screen name="VehicleFuelLogCreate"     component={VehicleFuelLogCreateScreen} />
      <Stack.Screen name="VehicleMaintenanceCreate" component={VehicleMaintenanceCreateScreen} />
    </Stack.Navigator>
  );
}
