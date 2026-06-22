import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme';
import { SupervisorTabParamList } from './types';
import { ComingSoonScreen }  from '../screens/shared/ComingSoonScreen';
import { MyRequestsScreen }  from '../screens/shared/MyRequestsScreen';

const Tab = createBottomTabNavigator<SupervisorTabParamList>();

const tabIcons: Record<keyof SupervisorTabParamList, [string, string]> = {
  TodayDashboard:  ['today',          'today-outline'],
  MaterialRequest: ['cube',           'cube-outline'],
  CasualLabour:    ['people',         'people-outline'],
  VehicleFuel:     ['car',            'car-outline'],
  MyRequests:      ['list',           'list-outline'],
};

const tabLabels: Record<keyof SupervisorTabParamList, string> = {
  TodayDashboard:  'Today',
  MaterialRequest: 'Materials',
  CasualLabour:    'Labour',
  VehicleFuel:     'Fuel',
  MyRequests:      'My Requests',
};

export function SupervisorNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle:            { backgroundColor: Colors.navy, borderTopWidth: 0, height: 62, paddingBottom: 8 },
        tabBarActiveTintColor:  Colors.tabActive,
        tabBarInactiveTintColor:Colors.tabInactive,
        tabBarLabelStyle:       { fontSize: 11, fontWeight: '500' },
        tabBarIcon: ({ focused, color, size }) => {
          const [active, inactive] = tabIcons[route.name as keyof SupervisorTabParamList];
          return <Ionicons name={(focused ? active : inactive) as any} size={size} color={color} />;
        },
        title: tabLabels[route.name as keyof SupervisorTabParamList],
      })}
    >
      <Tab.Screen name="TodayDashboard"  component={ComingSoonScreen} options={{ title: 'Today' }} />
      <Tab.Screen name="MaterialRequest" component={ComingSoonScreen} options={{ title: 'Materials' }} />
      <Tab.Screen name="CasualLabour"    component={ComingSoonScreen} options={{ title: 'Labour' }} />
      <Tab.Screen name="VehicleFuel"     component={ComingSoonScreen} options={{ title: 'Fuel' }} />
      <Tab.Screen name="MyRequests"      component={MyRequestsScreen} options={{ title: 'My Requests' }} />
    </Tab.Navigator>
  );
}
