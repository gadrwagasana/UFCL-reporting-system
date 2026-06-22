import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme';
import { LogisticsTabParamList } from './types';
import { ComingSoonScreen } from '../screens/shared/ComingSoonScreen';
import { MyRequestsScreen } from '../screens/shared/MyRequestsScreen';

const Tab = createBottomTabNavigator<LogisticsTabParamList>();

export function LogisticsNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle:            { backgroundColor: Colors.navy, borderTopWidth: 0, height: 62, paddingBottom: 8 },
        tabBarActiveTintColor:  Colors.tabActive,
        tabBarInactiveTintColor:Colors.tabInactive,
        tabBarLabelStyle:       { fontSize: 11, fontWeight: '500' },
        tabBarIcon: ({ focused, color, size }) => {
          const icons: Record<keyof LogisticsTabParamList, [string, string]> = {
            DeliveryList: ['truck', 'truck-outline'],
            MyRequests:   ['list',  'list-outline'],
          };
          const [a, i] = icons[route.name as keyof LogisticsTabParamList];
          return <Ionicons name={(focused ? a : i) as any} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="DeliveryList" component={ComingSoonScreen} options={{ title: 'Deliveries' }} />
      <Tab.Screen name="MyRequests"   component={MyRequestsScreen} options={{ title: 'My Requests' }} />
    </Tab.Navigator>
  );
}
