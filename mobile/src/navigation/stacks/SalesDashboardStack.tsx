import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SalesDashboardStackParamList } from '../types';
import { SalesDashboardScreen } from '../../screens/salesOrders/SalesDashboardScreen';
import { SalesHistoryScreen }   from '../../screens/salesOrders/SalesHistoryScreen';

const Stack = createNativeStackNavigator<SalesDashboardStackParamList>();

// ERP Final Enterprise Completion Gate — replaces the generic shared
// DashboardScreen on SalesNavigator's "Dashboard" tab with real sales-scoped
// data (revenue/status KPIs + a drill-in Sales History report).
export function SalesDashboardStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SalesDashboard" component={SalesDashboardScreen} />
      <Stack.Screen name="SalesHistory"   component={SalesHistoryScreen} />
    </Stack.Navigator>
  );
}
