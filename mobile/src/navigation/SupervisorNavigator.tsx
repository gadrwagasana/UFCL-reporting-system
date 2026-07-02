import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme';
import { SupervisorTabParamList } from './types';
import { DashboardScreen }       from '../screens/shared/DashboardScreen';
import { MaterialRequestsStack } from './MaterialRequestsStack';
import { CasualLabourStack }     from './CasualLabourStack';
import { CompartmentsStack }    from './stacks/CompartmentsStack';
import { StockMovementsStack }  from './stacks/StockMovementsStack';
import { TimberInventoryStack }  from './stacks/TimberInventoryStack';
import { StockTransfersStack } from './stacks/StockTransfersStack';
import { MyRequestsStack }       from './stacks/MyRequestsStack';
import { ProfileScreen }         from '../screens/profile/ProfileScreen';
import { ReportsStack }          from './stacks/ReportsStack';

const Tab = createBottomTabNavigator<SupervisorTabParamList>();

const tabIcons: Record<keyof SupervisorTabParamList, [string, string]> = {
  TodayDashboard:  ['today',   'today-outline'],
  MaterialRequest: ['cube',    'cube-outline'],
  CasualLabour:    ['people',  'people-outline'],
  Compartments:    ['map-pin',         'map-pin-outline'],
  StockMovements:  ['swap-horizontal', 'swap-horizontal-outline'],
  TimberInventory: ['leaf',           'leaf-outline'],
  StockTransfers:  ['swap-vertical', 'swap-vertical-outline'],
  Reports:         ['stats-chart',  'stats-chart-outline'],
  MyRequests:      ['list',    'list-outline'],
  Profile:         ['person',  'person-outline'],
};

const tabLabels: Record<keyof SupervisorTabParamList, string> = {
  TodayDashboard:  'Today',
  MaterialRequest: 'Materials',
  CasualLabour:    'Labour',
  Compartments:    'Compartments',
  StockMovements:  'Stock Mvmt',
  TimberInventory: 'Timber Inv.',
  StockTransfers:  'Transfers',
  Reports:         'Reports',
  MyRequests:      'My Requests',
  Profile:         'Profile',
};

export function SupervisorNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { backgroundColor: Colors.navy, borderTopWidth: 0, height: 62, paddingBottom: 8 },
        tabBarActiveTintColor:   Colors.tabActive,
        tabBarInactiveTintColor: Colors.tabInactive,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        tabBarIcon: ({ focused, color, size }) => {
          const [active, inactive] = tabIcons[route.name as keyof SupervisorTabParamList];
          return <Ionicons name={(focused ? active : inactive) as never} size={size} color={color} />;
        },
        title: tabLabels[route.name as keyof SupervisorTabParamList],
      })}
    >
      <Tab.Screen name="TodayDashboard"  component={DashboardScreen}       options={{ title: 'Today' }} />
      <Tab.Screen name="MaterialRequest" component={MaterialRequestsStack} options={{ title: 'Materials' }} />
      <Tab.Screen name="CasualLabour"    component={CasualLabourStack}     options={{ title: 'Labour' }} />
      <Tab.Screen name="Compartments"   component={CompartmentsStack}     options={{ title: 'Compartments' }} />
      <Tab.Screen name="StockMovements"  component={StockMovementsStack}   options={{ title: 'Stock Mvmt' }} />
      <Tab.Screen name="TimberInventory" component={TimberInventoryStack}  options={{ title: 'Timber Inv.' }} />
      <Tab.Screen name="StockTransfers"  component={StockTransfersStack}  options={{ title: 'Transfers' }} />
      <Tab.Screen name="Reports"         component={ReportsStack}          options={{ title: 'Reports' }} />
      <Tab.Screen name="MyRequests"      component={MyRequestsStack}       options={{ title: 'My Requests' }} />
      <Tab.Screen name="Profile"         component={ProfileScreen}         options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}
