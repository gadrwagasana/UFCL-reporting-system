import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme';
import { PolesTabParamList }       from './types';
import { PolesProductionStack }    from './PolesProductionStack';
import { PolesPurchaseStack }      from './PolesPurchaseStack';
import { PolesDeliveryStack }      from './PolesDeliveryStack';
import { PolesQCStack }            from './PolesQCStack';
import { MaterialRequestsStack }   from './MaterialRequestsStack';
import { CasualLabourStack }       from './CasualLabourStack';
import { MyRequestsScreen }        from '../screens/shared/MyRequestsScreen';
import { ProfileScreen }           from '../screens/profile/ProfileScreen';

const Tab = createBottomTabNavigator<PolesTabParamList>();

const tabIcons: Record<keyof PolesTabParamList, [string, string]> = {
  PolesList:     ['podium',           'podium-outline'],
  PolesPurchase: ['cart',             'cart-outline'],
  PolesDelivery: ['cube',             'cube-outline'],
  PolesQC:       ['shield-checkmark', 'shield-checkmark-outline'],
  MyRequests:    ['list',             'list-outline'],
  Profile:       ['person',           'person-outline'],
};

const tabLabels: Record<keyof PolesTabParamList, string> = {
  PolesList:     'Production',
  PolesPurchase: 'Purchase',
  PolesDelivery: 'Delivery',
  PolesQC:       'QC',
  MyRequests:    'My Requests',
  Profile:       'Profile',
};

export function PolesNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { backgroundColor: Colors.orange, borderTopWidth: 0, height: 62, paddingBottom: 8 },
        tabBarActiveTintColor:   Colors.tabActive,
        tabBarInactiveTintColor: Colors.tabInactive,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        tabBarIcon: ({ focused, color, size }) => {
          const [active, inactive] = tabIcons[route.name as keyof PolesTabParamList];
          return <Ionicons name={(focused ? active : inactive) as never} size={size} color={color} />;
        },
        title: tabLabels[route.name as keyof PolesTabParamList],
      })}
    >
      <Tab.Screen name="PolesList"     component={PolesProductionStack} options={{ title: 'Production' }} />
      <Tab.Screen name="PolesPurchase" component={PolesPurchaseStack}   options={{ title: 'Purchase' }} />
      <Tab.Screen name="PolesDelivery" component={PolesDeliveryStack}   options={{ title: 'Delivery' }} />
      <Tab.Screen name="PolesQC"       component={PolesQCStack}         options={{ title: 'QC' }} />
      <Tab.Screen name="MyRequests"    component={MyRequestsScreen}     options={{ title: 'My Requests' }} />
      <Tab.Screen name="Profile"       component={ProfileScreen}        options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}
