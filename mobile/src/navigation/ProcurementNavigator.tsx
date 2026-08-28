import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme';
import { ProcurementTabParamList } from './types';
import { ProcurementStack } from './stacks/ProcurementStack';
import { ProfileScreen }    from '../screens/profile/ProfileScreen';

const Tab = createBottomTabNavigator<ProcurementTabParamList>();

const tabIcons: Record<keyof ProcurementTabParamList, [string, string]> = {
  Procurement: ['cart',   'cart-outline'],
  Profile:     ['person', 'person-outline'],
};

export function ProcurementNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { backgroundColor: Colors.navy, borderTopWidth: 0, height: 62, paddingBottom: 8 },
        tabBarActiveTintColor:   Colors.tabActive,
        tabBarInactiveTintColor: Colors.tabInactive,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        tabBarIcon: ({ focused, color, size }) => {
          const [active, inactive] = tabIcons[route.name as keyof ProcurementTabParamList];
          return <Ionicons name={(focused ? active : inactive) as never} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Procurement" component={ProcurementStack} options={{ title: 'Procurement' }} />
      <Tab.Screen name="Profile"     component={ProfileScreen}    options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}
