import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme';
import { HarvestSupervisorTabParamList } from './types';
import { HarvestStack }      from './HarvestStack';
import { LogTransportStack } from './LogTransportStack';
import { ProfileScreen }     from '../screens/profile/ProfileScreen';
import { ReportsStack }      from './stacks/ReportsStack';

const Tab = createBottomTabNavigator<HarvestSupervisorTabParamList>();

const tabIcons: Record<keyof HarvestSupervisorTabParamList, [string, string]> = {
  HarvestList:      ['leaf',        'leaf-outline'],
  LogTransportList: ['bus',         'bus-outline'],
  Reports:          ['stats-chart', 'stats-chart-outline'],
  Profile:          ['person',      'person-outline'],
};

const tabLabels: Record<keyof HarvestSupervisorTabParamList, string> = {
  HarvestList:      'Harvest',
  LogTransportList: 'Log Transport',
  Reports:          'Reports',
  Profile:          'Profile',
};

export function HarvestSupervisorNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { backgroundColor: Colors.green, borderTopWidth: 0, height: 62, paddingBottom: 8 },
        tabBarActiveTintColor:   Colors.tabActive,
        tabBarInactiveTintColor: Colors.tabInactive,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        tabBarIcon: ({ focused, color, size }) => {
          const [active, inactive] = tabIcons[route.name as keyof HarvestSupervisorTabParamList];
          return <Ionicons name={(focused ? active : inactive) as never} size={size} color={color} />;
        },
        title: tabLabels[route.name as keyof HarvestSupervisorTabParamList],
      })}
    >
      <Tab.Screen name="HarvestList"      component={HarvestStack}      options={{ title: 'Harvest' }} />
      <Tab.Screen name="LogTransportList" component={LogTransportStack} options={{ title: 'Log Transport' }} />
      <Tab.Screen name="Reports"          component={ReportsStack}      options={{ title: 'Reports' }} />
      <Tab.Screen name="Profile"          component={ProfileScreen}     options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}
