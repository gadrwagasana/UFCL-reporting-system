import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme';
import { VatSupervisorTabParamList } from './types';
import { VatInboundStack }  from './VatInboundStack';
import { VatEntriesStack }  from './VatEntriesStack';
import { StockTransfersStack } from './stacks/StockTransfersStack';
import { ProfileScreen }    from '../screens/profile/ProfileScreen';

const Tab = createBottomTabNavigator<VatSupervisorTabParamList>();

// Nyanza Value-Added Production Completion Phase — the VatInbound route key
// is kept unchanged (lower-risk than a nav param rename) but now points to
// the batch-creation form instead of a "pick a transfer" list.
const tabIcons: Record<keyof VatSupervisorTabParamList, [string, string]> = {
  VatInbound: ['add-circle', 'add-circle-outline'],
  VatEntries: ['layers',            'layers-outline'],
  // Stock & Inventory Phase 4 (audit finding M-15/M-16) / ERP UI/UX
  // Completion Phase 8 — vat-supervisor holds the backend 'stock-transfers'
  // permission but had no navigation entry point to reach it at all.
  StockTransfers: ['swap-vertical', 'swap-vertical-outline'],
  Profile:    ['person',            'person-outline'],
};

const tabLabels: Record<keyof VatSupervisorTabParamList, string> = {
  VatInbound: 'New Batch',
  VatEntries: 'Processed',
  StockTransfers: 'Transfers',
  Profile:    'Profile',
};

export function VatSupervisorNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { backgroundColor: Colors.navy, borderTopWidth: 0, height: 62, paddingBottom: 8 },
        tabBarActiveTintColor:   Colors.tabActive,
        tabBarInactiveTintColor: Colors.tabInactive,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        tabBarIcon: ({ focused, color, size }) => {
          const [active, inactive] = tabIcons[route.name as keyof VatSupervisorTabParamList];
          return <Ionicons name={(focused ? active : inactive) as never} size={size} color={color} />;
        },
        title: tabLabels[route.name as keyof VatSupervisorTabParamList],
      })}
    >
      <Tab.Screen name="VatInbound" component={VatInboundStack}  options={{ title: 'New Batch' }} />
      <Tab.Screen name="VatEntries" component={VatEntriesStack}  options={{ title: 'Processed' }} />
      <Tab.Screen name="StockTransfers" component={StockTransfersStack} options={{ title: 'Transfers' }} />
      <Tab.Screen name="Profile"    component={ProfileScreen}    options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}
