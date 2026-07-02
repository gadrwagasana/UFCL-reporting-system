import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DeliveryStackParamList } from '../types';
import { DeliveriesListScreen }   from '../../screens/deliveries/DeliveriesListScreen';
import { DeliveryCreateScreen }   from '../../screens/deliveries/DeliveryCreateScreen';
import { DeliveryEditScreen }     from '../../screens/deliveries/DeliveryEditScreen';
import { DeliveryDetailScreen }   from '../../screens/deliveries/DeliveryDetailScreen';
import { DeliveryStatusScreen }   from '../../screens/deliveries/DeliveryStatusScreen';
import { PODListScreen }          from '../../screens/deliveries/PODListScreen';
import { PODCaptureScreen }       from '../../screens/deliveries/PODCaptureScreen';
import { PODDetailScreen }        from '../../screens/deliveries/PODDetailScreen';

const Stack = createNativeStackNavigator<DeliveryStackParamList>();

export function DeliveryStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DeliveriesList"  component={DeliveriesListScreen} />
      <Stack.Screen name="DeliveryCreate"  component={DeliveryCreateScreen} />
      <Stack.Screen name="DeliveryEdit"    component={DeliveryEditScreen} />
      <Stack.Screen name="DeliveryDetail"  component={DeliveryDetailScreen} />
      <Stack.Screen name="DeliveryStatus"  component={DeliveryStatusScreen} />
      <Stack.Screen name="PODList"         component={PODListScreen} />
      <Stack.Screen name="PODCapture"      component={PODCaptureScreen} />
      <Stack.Screen name="PODDetail"       component={PODDetailScreen} />
    </Stack.Navigator>
  );
}
