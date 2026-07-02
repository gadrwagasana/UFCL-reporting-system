import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme';
import { SawmillTabParamList } from './types';
import { SawmillStack }          from './SawmillStack';
import { MaterialRequestsStack } from './MaterialRequestsStack';
import { CasualLabourStack }     from './CasualLabourStack';
import { StockMovementsStack }   from './stacks/StockMovementsStack';
import { MyRequestsScreen }      from '../screens/shared/MyRequestsScreen';
import { ProfileScreen }         from '../screens/profile/ProfileScreen';

const Tab = createBottomTabNavigator<SawmillTabParamList>();

const tabIcons: Record<keyof SawmillTabParamList, [string, string]> = {
  SawmillList:     ['construct', 'construct-outline'],
  MaterialRequest: ['cube',      'cube-outline'],
  CasualLabour:    ['people',          'people-outline'],
  StockMovements:  ['swap-horizontal', 'swap-horizontal-outline'],
  MyRequests:      ['list',      'list-outline'],
  Profile:         ['person',    'person-outline'],
};

const tabLabels: Record<keyof SawmillTabParamList, string> = {
  SawmillList:     'Production',
  MaterialRequest: 'Materials',
  CasualLabour:    'Labour',
  StockMovements:  'Stock Mvmt',
  MyRequests:      'My Requests',
  Profile:         'Profile',
};

export function SawmillNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { backgroundColor: Colors.green, borderTopWidth: 0, height: 62, paddingBottom: 8 },
        tabBarActiveTintColor:   Colors.tabActive,
        tabBarInactiveTintColor: Colors.tabInactive,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        tabBarIcon: ({ focused, color, size }) => {
          const [active, inactive] = tabIcons[route.name as keyof SawmillTabParamList];
          return <Ionicons name={(focused ? active : inactive) as never} size={size} color={color} />;
        },
        title: tabLabels[route.name as keyof SawmillTabParamList],
      })}
    >
      <Tab.Screen name="SawmillList"     component={SawmillStack}          options={{ title: 'Production' }} />
      <Tab.Screen name="MaterialRequest" component={MaterialRequestsStack} options={{ title: 'Materials' }} />
      <Tab.Screen name="CasualLabour"    component={CasualLabourStack}     options={{ title: 'Labour' }} />
      <Tab.Screen name="StockMovements"  component={StockMovementsStack}   options={{ title: 'Stock Mvmt' }} />
      <Tab.Screen name="MyRequests"      component={MyRequestsScreen}      options={{ title: 'My Requests' }} />
      <Tab.Screen name="Profile"         component={ProfileScreen}         options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}
