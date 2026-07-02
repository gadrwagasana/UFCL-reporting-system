import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme';
import { OperationsTabParamList } from './types';
import { DASHBOARD_TAB_OPTIONS, DASHBOARD_TAB_ICON } from './shared/dashboardTabConfig';
import { DashboardScreen } from '../screens/shared/DashboardScreen';
import { ComingSoonScreen } from '../screens/shared/ComingSoonScreen';
import { MyRequestsScreen } from '../screens/shared/MyRequestsScreen';
import { CustomersStack }   from './stacks/CustomersStack';
import { ProductsStack }    from './stacks/ProductsStack';
import { MachinesStack }           from './stacks/MachinesStack';
import { WorkshopOverviewStack }   from './stacks/WorkshopOverviewStack';
import { WorkshopManagementStack } from './stacks/WorkshopManagementStack';
import { CompartmentsStack }       from './stacks/CompartmentsStack';
import { StockCatalogStack }       from './stacks/StockCatalogStack';
import { StockInventoryStack }     from './stacks/StockInventoryStack';
import { StockMovementsStack }     from './stacks/StockMovementsStack';
import { TimberInventoryStack }    from './stacks/TimberInventoryStack';

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
            Dashboard:      DASHBOARD_TAB_ICON,
            PendingReviews: ['notifications', 'notifications-outline'],
            MaterialReview: ['cube',          'cube-outline'],
            LabourReview:   ['people',        'people-outline'],
            Customers:      ['briefcase',     'briefcase-outline'],
            Products:       ['cube',          'cube-outline'],
            Machines:           ['settings',  'settings-outline'],
            WorkshopOverview:   ['eye',       'eye-outline'],
            WorkshopManagement: ['business',  'business-outline'],
            Compartments:       ['map-pin',          'map-pin-outline'],
            StockCatalog:       ['layers',           'layers-outline'],
            StockInventory:     ['bar-chart',        'bar-chart-outline'],
            StockMovements:     ['swap-horizontal',  'swap-horizontal-outline'],
            TimberInventory:    ['leaf',             'leaf-outline'],
            MyRequests:         ['list',      'list-outline'],
          };
          const [a, i] = icons[route.name as keyof OperationsTabParamList];
          return <Ionicons name={(focused ? a : i) as any} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard"      component={DashboardScreen}  options={DASHBOARD_TAB_OPTIONS} />
      <Tab.Screen name="PendingReviews" component={ComingSoonScreen} options={{ title: 'Pending' }} />
      <Tab.Screen name="MaterialReview" component={ComingSoonScreen} options={{ title: 'Materials' }} />
      <Tab.Screen name="LabourReview"   component={ComingSoonScreen} options={{ title: 'Labour' }} />
      <Tab.Screen name="Customers"  component={CustomersStack}   options={{ title: 'Customers' }} />
      <Tab.Screen name="Products"   component={ProductsStack}    options={{ title: 'Products' }} />
      <Tab.Screen name="Machines"           component={MachinesStack}          options={{ title: 'Machines' }} />
      <Tab.Screen name="WorkshopOverview"   component={WorkshopOverviewStack}   options={{ title: 'Wk Overview' }} />
      <Tab.Screen name="WorkshopManagement" component={WorkshopManagementStack} options={{ title: 'Workshops' }} />
      <Tab.Screen name="Compartments"       component={CompartmentsStack}       options={{ title: 'Compartments' }} />
      <Tab.Screen name="StockCatalog"       component={StockCatalogStack}       options={{ title: 'Stock' }} />
      <Tab.Screen name="StockInventory"     component={StockInventoryStack}     options={{ title: 'Levels' }} />
      <Tab.Screen name="StockMovements"     component={StockMovementsStack}     options={{ title: 'Movements' }} />
      <Tab.Screen name="TimberInventory"    component={TimberInventoryStack}    options={{ title: 'Timber Inv.' }} />
      <Tab.Screen name="MyRequests"         component={MyRequestsScreen}        options={{ title: 'My Requests' }} />
    </Tab.Navigator>
  );
}
