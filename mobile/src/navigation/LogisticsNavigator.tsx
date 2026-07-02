import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme';
import { LogisticsTabParamList } from './types';
import { DASHBOARD_TAB_OPTIONS, DASHBOARD_TAB_ICON } from './shared/dashboardTabConfig';
import { DashboardScreen } from '../screens/shared/DashboardScreen';
import { LogisticsDashboardScreen } from '../screens/logistics/LogisticsDashboardScreen';
import { MyRequestsScreen } from '../screens/shared/MyRequestsScreen';
import { DeliveryStack }    from './stacks/DeliveryStack';
import { VehiclesStack }    from './stacks/VehiclesStack';
import { MachinesStack }           from './stacks/MachinesStack';
import { WorkshopOverviewStack }   from './stacks/WorkshopOverviewStack';
import { WorkshopManagementStack } from './stacks/WorkshopManagementStack';
import { VehicleFuelStack }        from './stacks/VehicleFuelStack';
import { StockCatalogStack }       from './stacks/StockCatalogStack';
import { StockInventoryStack }     from './stacks/StockInventoryStack';
import { StockMovementsStack }     from './stacks/StockMovementsStack';
import { TimberInventoryStack }    from './stacks/TimberInventoryStack';

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
            Dashboard:          DASHBOARD_TAB_ICON,
            LogisticsDashboard: ['pie-chart', 'pie-chart-outline'],
            DeliveryList:       ['truck',     'truck-outline'],
            Vehicles:           ['car',       'car-outline'],
            Machines:           ['settings',  'settings-outline'],
            WorkshopOverview:   ['eye',       'eye-outline'],
            WorkshopManagement: ['business',         'business-outline'],
            StockCatalog:       ['layers',           'layers-outline'],
            StockInventory:     ['bar-chart',        'bar-chart-outline'],
            StockMovements:     ['swap-horizontal',  'swap-horizontal-outline'],
            TimberInventory:    ['leaf',             'leaf-outline'],
            VehicleFuel:        ['flame',     'flame-outline'],
            MyRequests:         ['list',      'list-outline'],
          };
          const [a, i] = icons[route.name as keyof LogisticsTabParamList];
          return <Ionicons name={(focused ? a : i) as any} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard"          component={DashboardScreen}          options={DASHBOARD_TAB_OPTIONS} />
      <Tab.Screen name="LogisticsDashboard" component={LogisticsDashboardScreen} options={{ title: 'Warehouse' }} />
      <Tab.Screen name="DeliveryList" component={DeliveryStack}      options={{ title: 'Deliveries' }} />
      <Tab.Screen name="Vehicles"     component={VehiclesStack}      options={{ title: 'Vehicles' }} />
      <Tab.Screen name="Machines"           component={MachinesStack}          options={{ title: 'Machines' }} />
      <Tab.Screen name="WorkshopOverview"   component={WorkshopOverviewStack}   options={{ title: 'Wk Overview' }} />
      <Tab.Screen name="WorkshopManagement" component={WorkshopManagementStack} options={{ title: 'Workshops' }} />
      <Tab.Screen name="StockCatalog"       component={StockCatalogStack}       options={{ title: 'Stock' }} />
      <Tab.Screen name="StockInventory"     component={StockInventoryStack}     options={{ title: 'Levels' }} />
      <Tab.Screen name="StockMovements"     component={StockMovementsStack}     options={{ title: 'Movements' }} />
      <Tab.Screen name="TimberInventory"    component={TimberInventoryStack}    options={{ title: 'Timber Inv.' }} />
      <Tab.Screen name="VehicleFuel"        component={VehicleFuelStack}        options={{ title: 'Fuel Logs' }} />
      <Tab.Screen name="MyRequests"   component={MyRequestsScreen}   options={{ title: 'My Requests' }} />
    </Tab.Navigator>
  );
}
