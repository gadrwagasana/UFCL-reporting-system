import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { SalesOrdersStackParamList }    from '../types';
import { SalesOrdersListScreen }             from '../../screens/salesOrders/SalesOrdersListScreen';
import { SalesOrderFormScreen }              from '../../screens/salesOrders/SalesOrderFormScreen';
import { SalesOrderDetailScreen }            from '../../screens/salesOrders/SalesOrderDetailScreen';
import { SalesOrderDeliverScreen }           from '../../screens/salesOrders/SalesOrderDeliverScreen';
import { SalesCustomerCreateScreen }         from '../../screens/salesOrders/SalesCustomerCreateScreen';
import { CustomerDetailScreen }              from '../../screens/customers/CustomerDetailScreen';
import { CustomerFormScreen }                from '../../screens/customers/CustomerFormScreen';

const Stack = createNativeStackNavigator<SalesOrdersStackParamList>();

export function SalesOrdersStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SalesOrdersList"      component={SalesOrdersListScreen} />
      <Stack.Screen name="SalesOrderCreate"     component={SalesOrderFormScreen} />
      <Stack.Screen name="SalesOrderEdit"       component={SalesOrderFormScreen} />
      <Stack.Screen name="SalesOrderDetail"     component={SalesOrderDetailScreen} />
      <Stack.Screen name="SalesOrderDeliver"    component={SalesOrderDeliverScreen} />
      <Stack.Screen name="SalesCustomerCreate"  component={SalesCustomerCreateScreen} />
      {/* Sales Enterprise Phase 2 — "View Customer" entry point, see types.ts */}
      <Stack.Screen name="CustomerDetail"       component={CustomerDetailScreen} />
      <Stack.Screen name="CustomerForm"         component={CustomerFormScreen} />
    </Stack.Navigator>
  );
}
