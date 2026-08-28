import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme';
import { SalesTabParamList } from './types';
import { DASHBOARD_TAB_OPTIONS, DASHBOARD_TAB_ICON } from './shared/dashboardTabConfig';
import { SalesDashboardStack } from './stacks/SalesDashboardStack';
import { ComingSoonScreen } from '../screens/shared/ComingSoonScreen';
import { MyRequestsStack }  from './stacks/MyRequestsStack';
import { CustomersStack }     from './stacks/CustomersStack';
import { ProductsStack }      from './stacks/ProductsStack';
import { SalesOrdersStack }   from './stacks/SalesOrdersStack';
import { DeliveryStack }      from './stacks/DeliveryStack';
import { ShowroomScreen }     from '../screens/showroom/ShowroomScreen';
import { StockTransfersStack } from './stacks/StockTransfersStack';
import { useAuthStore }       from '../stores/authStore';

const Tab = createBottomTabNavigator<SalesTabParamList>();

// Timber Lifecycle Phase 3 — this navigator is shared by 'sales', 'sales-staff',
// and 'showroom-staff' (MainNavigator.tsx), but the Showroom tab (stock,
// damage checks) is only relevant to showroom-staff, so it's added
// conditionally rather than shown to every role that reaches this navigator.
//
// Sales Enterprise Phase 2 (Priority 10) — the Customers tab was previously
// shown unconditionally to all three roles, but customersList/customersUpdate
// still require the 'customers' permission, which only 'sales' holds
// ('sales-staff'/'showroom-staff' only got the narrower customersOrders
// read-only access this phase, by explicit user decision — see
// customersOrders in data.js). Without this, the tab was reachable but
// permanently returned a 403 for those two roles. They reach Customer
// History instead via the "View Customer" link on the Sales Orders list.
export function SalesNavigator() {
  const role = useAuthStore((s) => s.user?.role);
  const showShowroom  = role === 'showroom-staff';
  const showCustomers = role === 'sales';

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
            Dashboard:      DASHBOARD_TAB_ICON,
            SalesOrders:    ['cart',      'cart-outline'],
            DeliveryStatus: ['truck',     'truck-outline'],
            Customers:      ['briefcase', 'briefcase-outline'],
            Products:       ['cube',      'cube-outline'],
            MyRequests:     ['list',      'list-outline'],
            Showroom:       ['storefront', 'storefront-outline'],
            StockTransfers: ['swap-vertical', 'swap-vertical-outline'],
          };
          const [a, i] = icons[route.name as keyof SalesTabParamList];
          return <Ionicons name={(focused ? a : i) as any} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard"      component={SalesDashboardStack} options={DASHBOARD_TAB_OPTIONS} />
      <Tab.Screen name="SalesOrders"    component={SalesOrdersStack}  options={{ title: 'Sales Orders' }} />
      <Tab.Screen name="DeliveryStatus" component={DeliveryStack}    options={{ title: 'Deliveries' }} />
      {showCustomers && <Tab.Screen name="Customers" component={CustomersStack} options={{ title: 'Customers' }} />}
      <Tab.Screen name="Products"   component={ProductsStack}    options={{ title: 'Products' }} />
      {showShowroom && <Tab.Screen name="Showroom" component={ShowroomScreen} options={{ title: 'Showroom' }} />}
      {showShowroom && <Tab.Screen name="StockTransfers" component={StockTransfersStack} options={{ title: 'Transfers' }} />}
      <Tab.Screen name="MyRequests" component={MyRequestsStack}  options={{ title: 'My Requests' }} />
    </Tab.Navigator>
  );
}
