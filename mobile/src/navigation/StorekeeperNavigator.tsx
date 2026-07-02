import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme';
import { StorekeeperTabParamList } from './types';
import { DASHBOARD_TAB_OPTIONS, DASHBOARD_TAB_ICON } from './shared/dashboardTabConfig';
import { DashboardScreen }          from '../screens/shared/DashboardScreen';
import { ComingSoonScreen }          from '../screens/shared/ComingSoonScreen';
import { MyRequestsScreen }          from '../screens/shared/MyRequestsScreen';
import { WorkshopOverviewStack }     from './stacks/WorkshopOverviewStack';
import { WorkshopManagementStack }   from './stacks/WorkshopManagementStack';

const Tab = createBottomTabNavigator<StorekeeperTabParamList>();

export function StorekeeperNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle:            { backgroundColor: Colors.navy, borderTopWidth: 0, height: 62, paddingBottom: 8 },
        tabBarActiveTintColor:  Colors.tabActive,
        tabBarInactiveTintColor:Colors.tabInactive,
        tabBarLabelStyle:       { fontSize: 11, fontWeight: '500' },
        tabBarIcon: ({ focused, color, size }) => {
          const icons: Record<keyof StorekeeperTabParamList, [string, string]> = {
            Dashboard:          DASHBOARD_TAB_ICON,
            WorkshopOverview:   ['eye',      'eye-outline'],
            WorkshopManagement: ['business', 'business-outline'],
            MaterialReview:     ['cube',     'cube-outline'],
            MyRequests:         ['list',     'list-outline'],
          };
          const [a, i] = icons[route.name as keyof StorekeeperTabParamList];
          return <Ionicons name={(focused ? a : i) as any} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard"          component={DashboardScreen}          options={DASHBOARD_TAB_OPTIONS} />
      <Tab.Screen name="WorkshopOverview"   component={WorkshopOverviewStack}    options={{ title: 'Wk Overview' }} />
      <Tab.Screen name="WorkshopManagement" component={WorkshopManagementStack}  options={{ title: 'Workshops' }} />
      <Tab.Screen name="MaterialReview"     component={ComingSoonScreen}         options={{ title: 'Materials' }} />
      <Tab.Screen name="MyRequests"         component={MyRequestsScreen}         options={{ title: 'My Requests' }} />
    </Tab.Navigator>
  );
}
