import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme';
import { MechanicianTabParamList } from './types';
import { MechanicianDashboardScreen } from '../screens/mechanician/MechanicianDashboardScreen';
import { MaterialRequestsStack } from './MaterialRequestsStack';
import { MachineLogStack } from './stacks/MachineLogStack';
import { MachineFuelStack } from './stacks/MachineFuelStack';
import { MachineMaintScheduleListScreen } from '../screens/machines/MachineMaintScheduleListScreen';
import { MaintenanceJobsStack } from './MaintenanceJobsStack';

const Tab = createBottomTabNavigator<MechanicianTabParamList>();

// Mechanician Phase 1 (Priority 4) — MachineLogList/MachineFuelList/MyRequests
// tabs were removed here because this role didn't hold the matching backend
// permissions at the time (100% dead navigation). MaterialRequestsStack and a
// tailored dashboard were added — this role's Material Requests permission
// now actually works.
//
// Mechanician Phase 2 (Priority 1/5) — this role now genuinely holds
// 'machine-logs'/'machine-fuel' (MECHANICIAN_PHASE2_OPERATIONAL_AUDIT.md), so
// MachineLogStack/MachineFuelStack are restored — the exact same stacks
// Supervisor/leader roles already use, not rebuilt. A new MaintSchedule tab
// (read-only for this role) closes the "no maintenance visibility at all"
// gap the audit identified.
export function MechanicianNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle:            { backgroundColor: Colors.navy, borderTopWidth: 0, height: 62, paddingBottom: 8 },
        tabBarActiveTintColor:  Colors.tabActive,
        tabBarInactiveTintColor:Colors.tabInactive,
        tabBarLabelStyle:       { fontSize: 10, fontWeight: '500' },
        tabBarIcon: ({ focused, color, size }) => {
          const icons: Record<keyof MechanicianTabParamList, [string, string]> = {
            MechanicianDashboard: ['home',          'home-outline'],
            MaterialRequest:      ['clipboard',     'clipboard-outline'],
            MachineLog:           ['hardware-chip', 'hardware-chip-outline'],
            MachineFuel:          ['flame',         'flame-outline'],
            MaintSchedule:        ['calendar',      'calendar-outline'],
            MaintenanceJobs:      ['construct',     'construct-outline'],
          };
          const [a, i] = icons[route.name as keyof MechanicianTabParamList];
          return <Ionicons name={(focused ? a : i) as any} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="MechanicianDashboard" component={MechanicianDashboardScreen}      options={{ title: 'Dashboard' }} />
      <Tab.Screen name="MaterialRequest"      component={MaterialRequestsStack}           options={{ title: 'Materials' }} />
      <Tab.Screen name="MachineLog"           component={MachineLogStack}                 options={{ title: 'Logs' }} />
      <Tab.Screen name="MachineFuel"          component={MachineFuelStack}                options={{ title: 'Fuel' }} />
      <Tab.Screen name="MaintSchedule"        component={MachineMaintScheduleListScreen}  options={{ title: 'Schedule' }} />
      <Tab.Screen name="MaintenanceJobs"      component={MaintenanceJobsStack}            options={{ title: 'Jobs' }} />
    </Tab.Navigator>
  );
}
