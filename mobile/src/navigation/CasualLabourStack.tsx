import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CasualLabourStackParamList } from './types';
import { CasualLabourListScreen }   from '../screens/labour/CasualLabourListScreen';
import { CasualLabourCreateScreen } from '../screens/labour/CasualLabourCreateScreen';
import { CasualLabourDetailScreen } from '../screens/labour/CasualLabourDetailScreen';
import { CasualsListScreen }        from '../screens/casuals/CasualsListScreen';
import { CasualFormScreen }         from '../screens/casuals/CasualFormScreen';
import { AttendanceChecklistScreen } from '../screens/attendance/AttendanceChecklistScreen';
import { AttendanceHistoryScreen }   from '../screens/attendance/AttendanceHistoryScreen';
import { AttendanceEditScreen }      from '../screens/attendance/AttendanceEditScreen';
import { PayrollPeriodsListScreen }  from '../screens/payroll/PayrollPeriodsListScreen';
import { PayrollPeriodDetailScreen } from '../screens/payroll/PayrollPeriodDetailScreen';
import { PayrollLineDetailScreen }   from '../screens/payroll/PayrollLineDetailScreen';

const Stack = createNativeStackNavigator<CasualLabourStackParamList>();

export function CasualLabourStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="CasualLabourList"   component={CasualLabourListScreen} />
      <Stack.Screen name="CasualLabourCreate" component={CasualLabourCreateScreen} />
      <Stack.Screen name="CasualLabourDetail" component={CasualLabourDetailScreen} />
      {/* HR Enterprise Phase 1 — Casuals registry, see types.ts */}
      <Stack.Screen name="CasualsList"        component={CasualsListScreen} />
      <Stack.Screen name="CasualForm"         component={CasualFormScreen} />
      {/* HR Enterprise Phase 2 — Attendance, see types.ts */}
      <Stack.Screen name="AttendanceChecklist" component={AttendanceChecklistScreen} />
      <Stack.Screen name="AttendanceHistory"   component={AttendanceHistoryScreen} />
      <Stack.Screen name="AttendanceEdit"      component={AttendanceEditScreen} />
      {/* Payroll Enterprise Phase 2 — see types.ts */}
      <Stack.Screen name="PayrollPeriodsList"  component={PayrollPeriodsListScreen} />
      <Stack.Screen name="PayrollPeriodDetail" component={PayrollPeriodDetailScreen} />
      <Stack.Screen name="PayrollLineDetail"   component={PayrollLineDetailScreen} />
    </Stack.Navigator>
  );
}
