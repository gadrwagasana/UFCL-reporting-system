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
import { EpmHomeScreen }              from '../../screens/reports/EpmHomeScreen';
import { EpmDepartmentsScreen }       from '../../screens/reports/EpmDepartmentsScreen';
import { EpmDepartmentKpisScreen }    from '../../screens/reports/EpmDepartmentKpisScreen';
import { EpmKpisScreen }              from '../../screens/reports/EpmKpisScreen';
import { EpmActionPlansScreen }       from '../../screens/reports/EpmActionPlansScreen';
import { EpmTrendsScreen }            from '../../screens/reports/EpmTrendsScreen';

const Stack = createNativeStackNavigator<ReportsStackParamList>();

export function ReportsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ReportsHome"        component={ReportsHomeScreen} />
      <Stack.Screen name="WeeklyCost"         component={WeeklyCostScreen} />
      <Stack.Screen name="WeeklyPerf"         component={WeeklyPerfScreen} />
      <Stack.Screen name="KpiScorecard"       component={KpiScreen} />
      <Stack.Screen name="Executive"          component={ExecutiveScreen} />
      <Stack.Screen name="BI"                 component={BiScreen} />
      <Stack.Screen name="Monthly"            component={MonthlyScreen} />
      <Stack.Screen name="Export"             component={ExportScreen} />
      <Stack.Screen name="EpmHome"            component={EpmHomeScreen} />
      <Stack.Screen name="EpmDepartments"     component={EpmDepartmentsScreen} />
      <Stack.Screen name="EpmDepartmentKpis"  component={EpmDepartmentKpisScreen} />
      <Stack.Screen name="EpmKpis"            component={EpmKpisScreen} />
      <Stack.Screen name="EpmActionPlans"     component={EpmActionPlansScreen} />
      <Stack.Screen name="EpmTrends"          component={EpmTrendsScreen} />
    </Stack.Navigator>
  );
}
