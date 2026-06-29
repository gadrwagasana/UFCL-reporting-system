import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme';
import { FinanceTabParamList } from './types';
import { DashboardScreen } from '../screens/shared/DashboardScreen';
import { MyRequestsScreen } from '../screens/shared/MyRequestsScreen';

const Tab = createBottomTabNavigator<FinanceTabParamList>();

export function FinanceNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle:            { backgroundColor: Colors.navy, borderTopWidth: 0, height: 62, paddingBottom: 8 },
        tabBarActiveTintColor:  Colors.tabActive,
        tabBarInactiveTintColor:Colors.tabInactive,
        tabBarLabelStyle:       { fontSize: 11, fontWeight: '500' },
        tabBarIcon: ({ focused, color, size }) => {
          const icons: Record<keyof FinanceTabParamList, [string, string]> = {
            Overview:   ['bar-chart', 'bar-chart-outline'],
            MyRequests: ['list',      'list-outline'],
          };
          const [a, i] = icons[route.name as keyof FinanceTabParamList];
          return <Ionicons name={(focused ? a : i) as any} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Overview"   component={DashboardScreen}  options={{ title: 'Overview' }} />
      <Tab.Screen name="MyRequests" component={MyRequestsScreen} options={{ title: 'My Requests' }} />
    </Tab.Navigator>
  );
}
