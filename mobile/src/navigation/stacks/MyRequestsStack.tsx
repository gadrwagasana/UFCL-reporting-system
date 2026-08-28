import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MyRequestsStackParamList } from '../types';
import { MyRequestsScreen } from '../../screens/shared/MyRequestsScreen';
import { ChangesScreen }    from '../../screens/admin/ChangesScreen';
import { MaterialRequestCreateScreen } from '../../screens/material/MaterialRequestCreateScreen';

const Stack = createNativeStackNavigator<MyRequestsStackParamList>();

export function MyRequestsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MyRequestsMain" component={MyRequestsScreen} />
      <Stack.Screen name="Changes"        component={ChangesScreen} />
      {/* ERP Enterprise Cross-Department Verification — closes Logistics' */}
      {/* mobile Material Request creation gap; see types.ts for context. */}
      <Stack.Screen name="MaterialRequestCreate" component={MaterialRequestCreateScreen} options={{ animation: 'slide_from_right' }} />
    </Stack.Navigator>
  );
}
