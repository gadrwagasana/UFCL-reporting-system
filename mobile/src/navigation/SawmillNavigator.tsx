import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme';
import { SawmillTabParamList } from './types';
import { ComingSoonScreen } from '../screens/shared/ComingSoonScreen';
import { MyRequestsScreen } from '../screens/shared/MyRequestsScreen';

const Tab = createBottomTabNavigator<SawmillTabParamList>();

export function SawmillNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle:            { backgroundColor: Colors.green, borderTopWidth: 0, height: 62, paddingBottom: 8 },
        tabBarActiveTintColor:  Colors.tabActive,
        tabBarInactiveTintColor:Colors.tabInactive,
        tabBarLabelStyle:       { fontSize: 11, fontWeight: '500' },
        tabBarIcon: ({ focused, color, size }) => {
          const icons: Record<keyof SawmillTabParamList, [string, string]> = {
            SawmillList:    ['construct',  'construct-outline'],
            MaterialRequest:['cube',       'cube-outline'],
            CasualLabour:   ['people',     'people-outline'],
            MyRequests:     ['list',       'list-outline'],
          };
          const [a, i] = icons[route.name as keyof SawmillTabParamList];
          return <Ionicons name={(focused ? a : i) as any} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="SawmillList"    component={ComingSoonScreen} options={{ title: 'Production' }} />
      <Tab.Screen name="MaterialRequest"component={ComingSoonScreen} options={{ title: 'Materials' }} />
      <Tab.Screen name="CasualLabour"   component={ComingSoonScreen} options={{ title: 'Labour' }} />
      <Tab.Screen name="MyRequests"     component={MyRequestsScreen} options={{ title: 'My Requests' }} />
    </Tab.Navigator>
  );
}
