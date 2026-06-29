import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme';
import { VatSupervisorTabParamList } from './types';
import { VatInboundStack }  from './VatInboundStack';
import { VatEntriesStack }  from './VatEntriesStack';
import { ProfileScreen }    from '../screens/profile/ProfileScreen';

const Tab = createBottomTabNavigator<VatSupervisorTabParamList>();

const tabIcons: Record<keyof VatSupervisorTabParamList, [string, string]> = {
  VatInbound: ['arrow-down-circle', 'arrow-down-circle-outline'],
  VatEntries: ['layers',            'layers-outline'],
  Profile:    ['person',            'person-outline'],
};

const tabLabels: Record<keyof VatSupervisorTabParamList, string> = {
  VatInbound: 'Inbound',
  VatEntries: 'Processed',
  Profile:    'Profile',
};

export function VatSupervisorNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { backgroundColor: Colors.navy, borderTopWidth: 0, height: 62, paddingBottom: 8 },
        tabBarActiveTintColor:   Colors.tabActive,
        tabBarInactiveTintColor: Colors.tabInactive,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        tabBarIcon: ({ focused, color, size }) => {
          const [active, inactive] = tabIcons[route.name as keyof VatSupervisorTabParamList];
          return <Ionicons name={(focused ? active : inactive) as never} size={size} color={color} />;
        },
        title: tabLabels[route.name as keyof VatSupervisorTabParamList],
      })}
    >
      <Tab.Screen name="VatInbound" component={VatInboundStack}  options={{ title: 'Inbound' }} />
      <Tab.Screen name="VatEntries" component={VatEntriesStack}  options={{ title: 'Processed' }} />
      <Tab.Screen name="Profile"    component={ProfileScreen}    options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}
