import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme';
import { SalesTabParamList } from './types';
import { ComingSoonScreen } from '../screens/shared/ComingSoonScreen';
import { MyRequestsScreen } from '../screens/shared/MyRequestsScreen';

const Tab = createBottomTabNavigator<SalesTabParamList>();

export function SalesNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle:            { backgroundColor: Colors.navy, borderTopWidth: 0, height: 62, paddingBottom: 8 },
        tabBarActiveTintColor:  Colors.tabActive,
        tabBarInactiveTintColor:Colors.tabInactive,
        tabBarLabelStyle:       { fontSize: 11, fontWeight: '500' },
        tabBarIcon: ({ focused, color, size }) => {
          const icons: Record<keyof SalesTabParamList, [string, string]> = {
            DeliveryStatus: ['receipt', 'receipt-outline'],
            MyRequests:     ['list',    'list-outline'],
          };
          const [a, i] = icons[route.name as keyof SalesTabParamList];
          return <Ionicons name={(focused ? a : i) as any} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="DeliveryStatus" component={ComingSoonScreen} options={{ title: 'Orders' }} />
      <Tab.Screen name="MyRequests"     component={MyRequestsScreen} options={{ title: 'My Requests' }} />
    </Tab.Navigator>
  );
}
