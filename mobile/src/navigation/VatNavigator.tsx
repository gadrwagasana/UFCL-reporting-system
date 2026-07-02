import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme';
import { VatTabParamList }         from './types';
import { VatInboundStack }         from './VatInboundStack';
import { VatEntriesStack }         from './VatEntriesStack';
import { MaterialRequestsStack }   from './MaterialRequestsStack';
import { CasualLabourStack }       from './CasualLabourStack';
import { StockMovementsStack }     from './stacks/StockMovementsStack';
import { MyRequestsScreen }        from '../screens/shared/MyRequestsScreen';
import { ProfileScreen }           from '../screens/profile/ProfileScreen';
import { ReportsStack }            from './stacks/ReportsStack';

const Tab = createBottomTabNavigator<VatTabParamList>();

const tabIcons: Record<keyof VatTabParamList, [string, string]> = {
  VatInbound:      ['arrow-down-circle', 'arrow-down-circle-outline'],
  VatEntries:      ['layers',            'layers-outline'],
  MaterialRequest: ['cube',              'cube-outline'],
  CasualLabour:    ['people',            'people-outline'],
  StockMovements:  ['swap-horizontal',   'swap-horizontal-outline'],
  Reports:         ['stats-chart',       'stats-chart-outline'],
  MyRequests:      ['list',              'list-outline'],
  Profile:         ['person',            'person-outline'],
};

const tabLabels: Record<keyof VatTabParamList, string> = {
  VatInbound:      'Inbound',
  VatEntries:      'Processed',
  MaterialRequest: 'Materials',
  CasualLabour:    'Labour',
  StockMovements:  'Stock Mvmt',
  Reports:         'Reports',
  MyRequests:      'My Requests',
  Profile:         'Profile',
};

export function VatNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { backgroundColor: Colors.navy, borderTopWidth: 0, height: 62, paddingBottom: 8 },
        tabBarActiveTintColor:   Colors.tabActive,
        tabBarInactiveTintColor: Colors.tabInactive,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        tabBarIcon: ({ focused, color, size }) => {
          const [active, inactive] = tabIcons[route.name as keyof VatTabParamList];
          return <Ionicons name={(focused ? active : inactive) as never} size={size} color={color} />;
        },
        title: tabLabels[route.name as keyof VatTabParamList],
      })}
    >
      <Tab.Screen name="VatInbound"      component={VatInboundStack}       options={{ title: 'Inbound' }} />
      <Tab.Screen name="VatEntries"      component={VatEntriesStack}       options={{ title: 'Processed' }} />
      <Tab.Screen name="MaterialRequest" component={MaterialRequestsStack} options={{ title: 'Materials' }} />
      <Tab.Screen name="CasualLabour"    component={CasualLabourStack}     options={{ title: 'Labour' }} />
      <Tab.Screen name="StockMovements"  component={StockMovementsStack}   options={{ title: 'Stock Mvmt' }} />
      <Tab.Screen name="Reports"         component={ReportsStack}          options={{ title: 'Reports' }} />
      <Tab.Screen name="MyRequests"      component={MyRequestsScreen}      options={{ title: 'My Requests' }} />
      <Tab.Screen name="Profile"         component={ProfileScreen}         options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}
