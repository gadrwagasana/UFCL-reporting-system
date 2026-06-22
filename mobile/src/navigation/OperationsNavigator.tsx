import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme';
import { OperationsTabParamList } from './types';
import { ComingSoonScreen } from '../screens/shared/ComingSoonScreen';
import { MyRequestsScreen } from '../screens/shared/MyRequestsScreen';

const Tab = createBottomTabNavigator<OperationsTabParamList>();

export function OperationsNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle:            { backgroundColor: Colors.navy, borderTopWidth: 0, height: 62, paddingBottom: 8 },
        tabBarActiveTintColor:  Colors.tabActive,
        tabBarInactiveTintColor:Colors.tabInactive,
        tabBarLabelStyle:       { fontSize: 11, fontWeight: '500' },
        tabBarIcon: ({ focused, color, size }) => {
          const icons: Record<keyof OperationsTabParamList, [string, string]> = {
            PendingReviews: ['notifications', 'notifications-outline'],
            MaterialReview: ['cube',          'cube-outline'],
            LabourReview:   ['people',        'people-outline'],
            MyRequests:     ['list',          'list-outline'],
          };
          const [a, i] = icons[route.name as keyof OperationsTabParamList];
          return <Ionicons name={(focused ? a : i) as any} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="PendingReviews" component={ComingSoonScreen} options={{ title: 'Pending' }} />
      <Tab.Screen name="MaterialReview" component={ComingSoonScreen} options={{ title: 'Materials' }} />
      <Tab.Screen name="LabourReview"   component={ComingSoonScreen} options={{ title: 'Labour' }} />
      <Tab.Screen name="MyRequests"     component={MyRequestsScreen} options={{ title: 'My Requests' }} />
    </Tab.Navigator>
  );
}
