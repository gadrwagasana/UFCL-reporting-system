import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme';
import { CeoTabParamList } from './types';

// Screens
import { CeoOverviewScreen } from '../screens/ceo/CeoOverviewScreen';
import { ApprovalsScreen }   from '../screens/ceo/ApprovalsScreen';
import { MyRequestsScreen }  from '../screens/shared/MyRequestsScreen';

const Tab = createBottomTabNavigator<CeoTabParamList>();

export function CeoNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle:            { backgroundColor: Colors.navy, borderTopWidth: 0, height: 62, paddingBottom: 8 },
        tabBarActiveTintColor:  Colors.tabActive,
        tabBarInactiveTintColor:Colors.tabInactive,
        tabBarLabelStyle:       { fontSize: 11, fontWeight: '500' },
        tabBarIcon: ({ focused, color, size }) => {
          const icons: Record<keyof CeoTabParamList, { active: string; inactive: string }> = {
            CeoOverview: { active: 'home',          inactive: 'home-outline' },
            Approvals:   { active: 'checkmark-done',inactive: 'checkmark-done-outline' },
            MyRequests:  { active: 'list',          inactive: 'list-outline' },
          };
          const set  = icons[route.name as keyof CeoTabParamList];
          const name = focused ? set.active : set.inactive;
          return <Ionicons name={name as any} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="CeoOverview" component={CeoOverviewScreen} options={{ title: 'Overview' }} />
      <Tab.Screen name="Approvals"   component={ApprovalsScreen}   options={{ title: 'Approvals' }} />
      <Tab.Screen name="MyRequests"  component={MyRequestsScreen}  options={{ title: 'My Requests' }} />
    </Tab.Navigator>
  );
}
