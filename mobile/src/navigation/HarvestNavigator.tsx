import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme';
import { HarvestTabParamList } from './types';
import { ComingSoonScreen } from '../screens/shared/ComingSoonScreen';
import { MyRequestsScreen } from '../screens/shared/MyRequestsScreen';

const Tab = createBottomTabNavigator<HarvestTabParamList>();

export function HarvestNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle:            { backgroundColor: Colors.green, borderTopWidth: 0, height: 62, paddingBottom: 8 },
        tabBarActiveTintColor:  Colors.tabActive,
        tabBarInactiveTintColor:Colors.tabInactive,
        tabBarLabelStyle:       { fontSize: 11, fontWeight: '500' },
        tabBarIcon: ({ focused, color, size }) => {
          const icons: Record<keyof HarvestTabParamList, [string, string]> = {
            HarvestList:      ['leaf',       'leaf-outline'],
            LogTransportList: ['bus',        'bus-outline'],
            MaterialRequest:  ['cube',       'cube-outline'],
            CasualLabour:     ['people',     'people-outline'],
            MyRequests:       ['list',       'list-outline'],
          };
          const [a, i] = icons[route.name as keyof HarvestTabParamList];
          return <Ionicons name={(focused ? a : i) as any} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="HarvestList"      component={ComingSoonScreen} options={{ title: 'Harvest' }} />
      <Tab.Screen name="LogTransportList" component={ComingSoonScreen} options={{ title: 'Log Transport' }} />
      <Tab.Screen name="MaterialRequest"  component={ComingSoonScreen} options={{ title: 'Materials' }} />
      <Tab.Screen name="CasualLabour"     component={ComingSoonScreen} options={{ title: 'Labour' }} />
      <Tab.Screen name="MyRequests"       component={MyRequestsScreen} options={{ title: 'My Requests' }} />
    </Tab.Navigator>
  );
}
