import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { SalesOrdersStackParamList }    from '../types';
import { SalesOrdersListScreen }             from '../../screens/salesOrders/SalesOrdersListScreen';
import { SalesOrderFormScreen }              from '../../screens/salesOrders/SalesOrderFormScreen';
import { SalesOrderDeliverScreen }           from '../../screens/salesOrders/SalesOrderDeliverScreen';
import { SalesCustomerCreateScreen }         from '../../screens/salesOrders/SalesCustomerCreateScreen';

const Stack = createNativeStackNavigator<SalesOrdersStackParamList>();

export function SalesOrdersStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SalesOrdersList"      component={SalesOrdersListScreen} />
      <Stack.Screen name="SalesOrderCreate"     component={SalesOrderFormScreen} />
      <Stack.Screen name="SalesOrderEdit"       component={SalesOrderFormScreen} />
      <Stack.Screen name="SalesOrderDeliver"    component={SalesOrderDeliverScreen} />
      <Stack.Screen name="SalesCustomerCreate"  component={SalesCustomerCreateScreen} />
    </Stack.Navigator>
  );
}
