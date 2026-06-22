import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme';
import { MechanicianTabParamList } from './types';
import { ComingSoonScreen } from '../screens/shared/ComingSoonScreen';
import { MyRequestsScreen } from '../screens/shared/MyRequestsScreen';

const Tab = createBottomTabNavigator<MechanicianTabParamList>();

export function MechanicianNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle:            { backgroundColor: Colors.navy, borderTopWidth: 0, height: 62, paddingBottom: 8 },
        tabBarActiveTintColor:  Colors.tabActive,
        tabBarInactiveTintColor:Colors.tabInactive,
        tabBarLabelStyle:       { fontSize: 11, fontWeight: '500' },
        tabBarIcon: ({ focused, color, size }) => {
          const icons: Record<keyof MechanicianTabParamList, [string, string]> = {
            MachineLogList:  ['hardware-chip', 'hardware-chip-outline'],
            MachineFuelList: ['flame',         'flame-outline'],
            MyRequests:      ['list',          'list-outline'],
          };
          const [a, i] = icons[route.name as keyof MechanicianTabParamList];
          return <Ionicons name={(focused ? a : i) as any} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="MachineLogList"  component={ComingSoonScreen} options={{ title: 'Machine Logs' }} />
      <Tab.Screen name="MachineFuelList" component={ComingSoonScreen} options={{ title: 'Fuel' }} />
      <Tab.Screen name="MyRequests"      component={MyRequestsScreen} options={{ title: 'My Requests' }} />
    </Tab.Navigator>
  );
}
