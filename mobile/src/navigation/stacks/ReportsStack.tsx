import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ReportsStackParamList }      from '../types';
import { ReportsHomeScreen }          from '../../screens/reports/ReportsHomeScreen';
import { WeeklyCostScreen }           from '../../screens/reports/WeeklyCostScreen';
import { WeeklyPerfScreen }           from '../../screens/reports/WeeklyPerfScreen';
import { KpiScreen }                  from '../../screens/reports/KpiScreen';
import { ExecutiveScreen }            from '../../screens/reports/ExecutiveScreen';
import { BiScreen }                   from '../../screens/reports/BiScreen';
import { MonthlyScreen }              from '../../screens/reports/MonthlyScreen';
import { ExportScreen }               from '../../screens/reports/ExportScreen';

const Stack = createNativeStackNavigator<ReportsStackParamList>();

export function ReportsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ReportsHome" component={ReportsHomeScreen} />
      <Stack.Screen name="WeeklyCost"  component={WeeklyCostScreen} />
      <Stack.Screen name="WeeklyPerf"  component={WeeklyPerfScreen} />
      <Stack.Screen name="KpiScorecard" component={KpiScreen} />
      <Stack.Screen name="Executive"   component={ExecutiveScreen} />
      <Stack.Screen name="BI"          component={BiScreen} />
      <Stack.Screen name="Monthly"     component={MonthlyScreen} />
      <Stack.Screen name="Export"      component={ExportScreen} />
    </Stack.Navigator>
  );
}
