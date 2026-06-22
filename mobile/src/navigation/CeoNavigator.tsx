import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme';
import { CeoTabParamList } from './types';

// Screens / stacks
import { CeoOverviewScreen } from '../screens/ceo/CeoOverviewScreen';
import { CeoApprovalsStack } from './CeoApprovalsStack';
import { ProfileScreen }     from '../screens/profile/ProfileScreen';

const Tab = createBottomTabNavigator<CeoTabParamList>();

export function CeoNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.navy,
          borderTopWidth: 0,
          height: 62,
          paddingBottom: 8,
        },
        tabBarActiveTintColor:   Colors.tabActive,
        tabBarInactiveTintColor: Colors.tabInactive,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        tabBarIcon: ({ focused, color, size }) => {
          const icons: Record<keyof CeoTabParamList, { active: string; inactive: string }> = {
            CeoOverview:  { active: 'home',          inactive: 'home-outline' },
            CeoApprovals: { active: 'checkmark-done', inactive: 'checkmark-done-outline' },
            Profile:      { active: 'person',         inactive: 'person-outline' },
          };
          const set  = icons[route.name as keyof CeoTabParamList];
          const name = focused ? set.active : set.inactive;
          return <Ionicons name={name as never} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="CeoOverview"
        component={CeoOverviewScreen}
        options={{ title: 'Overview' }}
      />
      <Tab.Screen
        name="CeoApprovals"
        component={CeoApprovalsStack}
        options={{ title: 'Approvals' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
    </Tab.Navigator>
  );
}
