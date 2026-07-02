import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme';
import { CeoTabParamList } from './types';
import { DASHBOARD_TAB_OPTIONS, DASHBOARD_TAB_ICON } from './shared/dashboardTabConfig';

// Screens / stacks
import { DashboardScreen }      from '../screens/shared/DashboardScreen';
import { CeoOverviewScreen }    from '../screens/ceo/CeoOverviewScreen';
import { CeoApprovalsStack }    from './CeoApprovalsStack';
import { NotificationsScreen }  from '../screens/notifications/NotificationsScreen';
import { ProfileScreen }        from '../screens/profile/ProfileScreen';
import { CustomersStack }       from './stacks/CustomersStack';
import { ProductsStack }        from './stacks/ProductsStack';
import { VehiclesStack }        from './stacks/VehiclesStack';
import { MachinesStack }            from './stacks/MachinesStack';
import { WorkshopOverviewStack }    from './stacks/WorkshopOverviewStack';
import { WorkshopManagementStack }  from './stacks/WorkshopManagementStack';
import { CompartmentsStack }        from './stacks/CompartmentsStack';
import { StockCatalogStack }        from './stacks/StockCatalogStack';
import { StockInventoryStack }      from './stacks/StockInventoryStack';
import { StockMovementsStack }      from './stacks/StockMovementsStack';
import { TimberInventoryStack }     from './stacks/TimberInventoryStack';
import { StockTransfersStack }     from './stacks/StockTransfersStack';
import { DispatchStack }            from './stacks/DispatchStack';

const Tab = createBottomTabNavigator<CeoTabParamList>();

export function CeoNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.navy,
          borderTopWidth: 0,
          height: 62,
          paddingBottom: 8,
        },
        tabBarActiveTintColor:   Colors.tabActive,
        tabBarInactiveTintColor: Colors.tabInactive,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        tabBarIcon: ({ focused, color, size }) => {
          const icons: Record<keyof CeoTabParamList, { active: string; inactive: string }> = {
            Dashboard:     { active: DASHBOARD_TAB_ICON[0], inactive: DASHBOARD_TAB_ICON[1] },
            CeoOverview:   { active: 'home',           inactive: 'home-outline' },
            CeoApprovals:  { active: 'checkmark-done', inactive: 'checkmark-done-outline' },
            Customers:     { active: 'people',         inactive: 'people-outline' },
            Products:      { active: 'cube',           inactive: 'cube-outline' },
            Vehicles:      { active: 'car',            inactive: 'car-outline' },
            Machines:           { active: 'settings',   inactive: 'settings-outline' },
            WorkshopOverview:   { active: 'eye',       inactive: 'eye-outline' },
            WorkshopManagement: { active: 'business',  inactive: 'business-outline' },
            Compartments:       { active: 'map-pin',          inactive: 'map-pin-outline' },
            StockCatalog:       { active: 'layers',           inactive: 'layers-outline' },
            StockInventory:     { active: 'bar-chart',        inactive: 'bar-chart-outline' },
            StockMovements:     { active: 'swap-horizontal',  inactive: 'swap-horizontal-outline' },
            TimberInventory:    { active: 'leaf',             inactive: 'leaf-outline' },
            StockTransfers:     { active: 'swap-vertical',   inactive: 'swap-vertical-outline' },
            Dispatch:           { active: 'send',             inactive: 'send-outline' },
            Notifications: { active: 'notifications',  inactive: 'notifications-outline' },
            Profile:       { active: 'person',         inactive: 'person-outline' },
          };
          const set  = icons[route.name as keyof CeoTabParamList];
          const name = focused ? set.active : set.inactive;
          return <Ionicons name={name as never} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={DASHBOARD_TAB_OPTIONS}
      />
      <Tab.Screen
        name="CeoOverview"
        component={CeoOverviewScreen}
        options={{ title: 'Overview' }}
      />
      <Tab.Screen
        name="CeoApprovals"
        component={CeoApprovalsStack}
        options={{ title: 'Approvals' }}
      />
      <Tab.Screen
        name="Customers"
        component={CustomersStack}
        options={{ title: 'Customers' }}
      />
      <Tab.Screen
        name="Products"
        component={ProductsStack}
        options={{ title: 'Products' }}
      />
      <Tab.Screen
        name="Vehicles"
        component={VehiclesStack}
        options={{ title: 'Vehicles' }}
      />
      <Tab.Screen
        name="Machines"
        component={MachinesStack}
        options={{ title: 'Machines' }}
      />
      <Tab.Screen
        name="WorkshopOverview"
        component={WorkshopOverviewStack}
        options={{ title: 'Wk Overview' }}
      />
      <Tab.Screen
        name="WorkshopManagement"
        component={WorkshopManagementStack}
        options={{ title: 'Workshops' }}
      />
      <Tab.Screen
        name="Compartments"
        component={CompartmentsStack}
        options={{ title: 'Compartments' }}
      />
      <Tab.Screen name="StockCatalog"   component={StockCatalogStack}   options={{ title: 'Stock' }} />
      <Tab.Screen name="StockInventory" component={StockInventoryStack} options={{ title: 'Levels' }} />
      <Tab.Screen name="StockMovements"  component={StockMovementsStack}  options={{ title: 'Movements' }} />
      <Tab.Screen name="TimberInventory" component={TimberInventoryStack} options={{ title: 'Timber Inv.' }} />
      <Tab.Screen name="StockTransfers"  component={StockTransfersStack}  options={{ title: 'Transfers' }} />
      <Tab.Screen name="Dispatch"        component={DispatchStack}        options={{ title: 'Dispatch' }} />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: 'Notifications' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
    </Tab.Navigator>
  );
}
