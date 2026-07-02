import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme';
import { SawmillSupervisorTabParamList } from './types';
import { SawmillStack }  from './SawmillStack';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { ReportsStack }  from './stacks/ReportsStack';

const Tab = createBottomTabNavigator<SawmillSupervisorTabParamList>();

const tabIcons: Record<keyof SawmillSupervisorTabParamList, [string, string]> = {
  SawmillList: ['construct',   'construct-outline'],
  Reports:     ['stats-chart', 'stats-chart-outline'],
  Profile:     ['person',      'person-outline'],
};

const tabLabels: Record<keyof SawmillSupervisorTabParamList, string> = {
  SawmillList: 'Production',
  Reports:     'Reports',
  Profile:     'Profile',
};

export function SawmillSupervisorNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { backgroundColor: Colors.green, borderTopWidth: 0, height: 62, paddingBottom: 8 },
        tabBarActiveTintColor:   Colors.tabActive,
        tabBarInactiveTintColor: Colors.tabInactive,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        tabBarIcon: ({ focused, color, size }) => {
          const [active, inactive] = tabIcons[route.name as keyof SawmillSupervisorTabParamList];
          return <Ionicons name={(focused ? active : inactive) as never} size={size} color={color} />;
        },
        title: tabLabels[route.name as keyof SawmillSupervisorTabParamList],
      })}
    >
      <Tab.Screen name="SawmillList" component={SawmillStack}  options={{ title: 'Production' }} />
      <Tab.Screen name="Reports"     component={ReportsStack}  options={{ title: 'Reports' }} />
      <Tab.Screen name="Profile"     component={ProfileScreen} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}
