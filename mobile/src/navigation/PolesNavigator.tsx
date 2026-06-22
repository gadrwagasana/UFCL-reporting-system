import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme';
import { PolesTabParamList } from './types';
import { ComingSoonScreen } from '../screens/shared/ComingSoonScreen';
import { MyRequestsScreen } from '../screens/shared/MyRequestsScreen';

const Tab = createBottomTabNavigator<PolesTabParamList>();

export function PolesNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle:            { backgroundColor: Colors.orange, borderTopWidth: 0, height: 62, paddingBottom: 8 },
        tabBarActiveTintColor:  Colors.tabActive,
        tabBarInactiveTintColor:Colors.tabInactive,
        tabBarLabelStyle:       { fontSize: 11, fontWeight: '500' },
        tabBarIcon: ({ focused, color, size }) => {
          const icons: Record<keyof PolesTabParamList, [string, string]> = {
            PolesList:     ['podium',     'podium-outline'],
            PolesPurchase: ['cart',       'cart-outline'],
            PolesDelivery: ['truck',      'truck-outline'],
            PolesQC:       ['shield-checkmark','shield-checkmark-outline'],
            MyRequests:    ['list',       'list-outline'],
          };
          const [a, i] = icons[route.name as keyof PolesTabParamList];
          return <Ionicons name={(focused ? a : i) as any} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="PolesList"     component={ComingSoonScreen} options={{ title: 'Production' }} />
      <Tab.Screen name="PolesPurchase" component={ComingSoonScreen} options={{ title: 'Purchase' }} />
      <Tab.Screen name="PolesDelivery" component={ComingSoonScreen} options={{ title: 'Delivery' }} />
      <Tab.Screen name="PolesQC"       component={ComingSoonScreen} options={{ title: 'QC' }} />
      <Tab.Screen name="MyRequests"    component={MyRequestsScreen} options={{ title: 'My Requests' }} />
    </Tab.Navigator>
  );
}
