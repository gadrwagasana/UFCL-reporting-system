import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme';
import { PolesSupervisorTabParamList } from './types';
import { PolesProductionStack } from './PolesProductionStack';
import { PolesDeliveryStack }   from './PolesDeliveryStack';
import { ProfileScreen }        from '../screens/profile/ProfileScreen';

const Tab = createBottomTabNavigator<PolesSupervisorTabParamList>();

const tabIcons: Record<keyof PolesSupervisorTabParamList, [string, string]> = {
  PolesList:    ['podium', 'podium-outline'],
  PolesDelivery: ['cube',  'cube-outline'],
  Profile:      ['person', 'person-outline'],
};

const tabLabels: Record<keyof PolesSupervisorTabParamList, string> = {
  PolesList:    'Production',
  PolesDelivery: 'Delivery',
  Profile:      'Profile',
};

export function PolesSupervisorNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { backgroundColor: Colors.orange, borderTopWidth: 0, height: 62, paddingBottom: 8 },
        tabBarActiveTintColor:   Colors.tabActive,
        tabBarInactiveTintColor: Colors.tabInactive,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        tabBarIcon: ({ focused, color, size }) => {
          const [active, inactive] = tabIcons[route.name as keyof PolesSupervisorTabParamList];
          return <Ionicons name={(focused ? active : inactive) as never} size={size} color={color} />;
        },
        title: tabLabels[route.name as keyof PolesSupervisorTabParamList],
      })}
    >
      <Tab.Screen name="PolesList"    component={PolesProductionStack} options={{ title: 'Production' }} />
      <Tab.Screen name="PolesDelivery" component={PolesDeliveryStack}  options={{ title: 'Delivery' }} />
      <Tab.Screen name="Profile"      component={ProfileScreen}        options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}
