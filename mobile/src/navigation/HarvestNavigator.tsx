import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme';
import { HarvestTabParamList } from './types';
import { HarvestStack }          from './HarvestStack';
import { LogTransportStack }     from './LogTransportStack';
import { MaterialRequestsStack } from './MaterialRequestsStack';
import { CasualLabourStack }     from './CasualLabourStack';
import { MyRequestsScreen }      from '../screens/shared/MyRequestsScreen';
import { ProfileScreen }         from '../screens/profile/ProfileScreen';

const Tab = createBottomTabNavigator<HarvestTabParamList>();

const tabIcons: Record<keyof HarvestTabParamList, [string, string]> = {
  HarvestList:      ['leaf',    'leaf-outline'],
  LogTransportList: ['bus',     'bus-outline'],
  MaterialRequest:  ['cube',    'cube-outline'],
  CasualLabour:     ['people',  'people-outline'],
  MyRequests:       ['list',    'list-outline'],
  Profile:          ['person',  'person-outline'],
};

const tabLabels: Record<keyof HarvestTabParamList, string> = {
  HarvestList:      'Harvest',
  LogTransportList: 'Log Transport',
  MaterialRequest:  'Materials',
  CasualLabour:     'Labour',
  MyRequests:       'My Requests',
  Profile:          'Profile',
};

export function HarvestNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { backgroundColor: Colors.green, borderTopWidth: 0, height: 62, paddingBottom: 8 },
        tabBarActiveTintColor:   Colors.tabActive,
        tabBarInactiveTintColor: Colors.tabInactive,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        tabBarIcon: ({ focused, color, size }) => {
          const [active, inactive] = tabIcons[route.name as keyof HarvestTabParamList];
          return <Ionicons name={(focused ? active : inactive) as never} size={size} color={color} />;
        },
        title: tabLabels[route.name as keyof HarvestTabParamList],
      })}
    >
      <Tab.Screen name="HarvestList"      component={HarvestStack}      options={{ title: 'Harvest' }} />
      <Tab.Screen name="LogTransportList" component={LogTransportStack} options={{ title: 'Log Transport' }} />
      <Tab.Screen name="MaterialRequest"  component={MaterialRequestsStack} options={{ title: 'Materials' }} />
      <Tab.Screen name="CasualLabour"     component={CasualLabourStack}     options={{ title: 'Labour' }} />
      <Tab.Screen name="MyRequests"       component={MyRequestsScreen}      options={{ title: 'My Requests' }} />
      <Tab.Screen name="Profile"          component={ProfileScreen}         options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}
