import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { FinanceCenterStackParamList } from './types';
import { FinanceDashboardScreen } from '../screens/finance/FinanceDashboardScreen';
import { FinanceApprovalsScreen }  from '../screens/finance/FinanceApprovalsScreen';
import { FinanceInventoryScreen }  from '../screens/finance/FinanceInventoryScreen';
import { FinanceStockCountsScreen } from '../screens/finance/FinanceStockCountsScreen';
import { FinanceStockCountDetailScreen } from '../screens/finance/FinanceStockCountDetailScreen';
import { FinanceExceptionsScreen } from '../screens/finance/FinanceExceptionsScreen';
import { FinanceExceptionDetailScreen } from '../screens/finance/FinanceExceptionDetailScreen';

const Stack = createNativeStackNavigator<FinanceCenterStackParamList>();

// Finance Enterprise — mobile exposure. Dashboard, Approval Center,
// Inventory Overview + Stock Variance, Stock Count review (enter counts +
// submit for review; initiation and adjustment submission stay desktop-
// only), and the Exception Center (view/comment/resolve). Operations
// Center/Reports/Configuration/Sage Export/Production-Maintenance-Customer-
// Supplier drill-downs remain desktop-only — see the Gap Register.
export function FinanceCenterStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="FinanceDashboard" component={FinanceDashboardScreen} />
      <Stack.Screen name="FinanceApprovals" component={FinanceApprovalsScreen} />
      <Stack.Screen name="FinanceInventory" component={FinanceInventoryScreen} />
      <Stack.Screen name="FinanceStockCounts" component={FinanceStockCountsScreen} />
      <Stack.Screen name="FinanceStockCountDetail" component={FinanceStockCountDetailScreen} />
      <Stack.Screen name="FinanceExceptions" component={FinanceExceptionsScreen} />
      <Stack.Screen name="FinanceExceptionDetail" component={FinanceExceptionDetailScreen} />
    </Stack.Navigator>
  );
}
