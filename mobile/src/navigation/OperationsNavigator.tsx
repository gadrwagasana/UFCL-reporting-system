import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme';
import { OperationsTabParamList } from './types';
import { DASHBOARD_TAB_OPTIONS, DASHBOARD_TAB_ICON } from './shared/dashboardTabConfig';
import { DashboardScreen } from '../screens/shared/DashboardScreen';
import { GovernanceScreen } from '../screens/governance/GovernanceScreen';
import { CasualLabourStack } from './CasualLabourStack';
import { MaterialRequestsStack } from './MaterialRequestsStack';
import { MyRequestsStack }  from './stacks/MyRequestsStack';
import { CustomersStack }   from './stacks/CustomersStack';
import { ProductsStack }    from './stacks/ProductsStack';
import { DispatchStack }    from './stacks/DispatchStack';
import { MachinesStack }           from './stacks/MachinesStack';
import { WorkshopOverviewStack }   from './stacks/WorkshopOverviewStack';
import { WorkshopManagementStack } from './stacks/WorkshopManagementStack';
import { CompartmentsStack }       from './stacks/CompartmentsStack';
import { StockCatalogStack }       from './stacks/StockCatalogStack';
import { StockInventoryStack }     from './stacks/StockInventoryStack';
import { StockMovementsStack }     from './stacks/StockMovementsStack';
import { TimberInventoryStack }    from './stacks/TimberInventoryStack';
import { StockTransfersStack }   from './stacks/StockTransfersStack';
import { SalesOrdersStack }      from './stacks/SalesOrdersStack';
import { ReportsStack }          from './stacks/ReportsStack';
import { AdminStack }           from './stacks/AdminStack';
import { FinanceCenterStack }   from './FinanceCenterStack';

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
            Dispatch:           ['send',      'send-outline'],
            Machines:           ['settings',  'settings-outline'],
            WorkshopOverview:   ['eye',       'eye-outline'],
            WorkshopManagement: ['business',  'business-outline'],
            Compartments:       ['map-pin',          'map-pin-outline'],
            StockCatalog:       ['layers',           'layers-outline'],
            StockInventory:     ['bar-chart',        'bar-chart-outline'],
            StockMovements:     ['swap-horizontal',  'swap-horizontal-outline'],
            TimberInventory:    ['leaf',             'leaf-outline'],
            StockTransfers:     ['swap-vertical',   'swap-vertical-outline'],
            SalesOrders:        ['cart',            'cart-outline'],
            Reports:            ['stats-chart',     'stats-chart-outline'],
            FinanceCenter:      ['cash',            'cash-outline'],
            Admin:              ['shield',    'shield-outline'],
            MyRequests:         ['list',      'list-outline'],
          };
          const [a, i] = icons[route.name as keyof OperationsTabParamList];
          return <Ionicons name={(focused ? a : i) as any} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard"      component={DashboardScreen}  options={DASHBOARD_TAB_OPTIONS} />
      {/* ERP Remaining Departments Completion Program — was a literal
          ComingSoonScreen placeholder (the only live, reachable one left in
          the app per a full grep sweep). operations already sees a
          Governance icon in AppHeader on every other screen (it's in
          GOVERNANCE_APPROVER_ROLES), so this reuses that exact existing
          screen rather than inventing new content — GovernanceScreen already
          defensively handles both root-of-stack and pushed-onto-a-stack
          contexts (`onBack={navigation.canGoBack() ? ... : undefined}`),
          confirmed safe to mount directly as a tab. */}
      <Tab.Screen name="PendingReviews" component={GovernanceScreen} options={{ title: 'Pending' }} />
      {/* ERP Enterprise Completion Gate — was a ComingSoonScreen placeholder;
          operations holds both 'material.review' and 'workshop.approve'
          (mobile/src/utils/permissions.ts), and MaterialRequestDetailScreen's
          own Approve/Reject buttons already gate on 'workshop.approve' — but
          this role had no navigational path to reach the screen at all,
          despite the same MaterialRequestsStack already being wired for 6
          other roles. Reused as-is, no new screen/logic. */}
      <Tab.Screen name="MaterialReview" component={MaterialRequestsStack} options={{ title: 'Materials' }} />
      {/* ERP Enterprise Completion Phase 3 (Workstream 11) — was a
          ComingSoonScreen placeholder; operations is one of only two roles
          (with ceo) that can review Casual Labour requests
          (casualLabourRequestsReview), but had no path to the screen at all.
          Reuses the exact same stack already registered in
          Harvest/Sawmill/Supervisor/VatNavigator. */}
      <Tab.Screen name="LabourReview"   component={CasualLabourStack} options={{ title: 'Labour' }} />
      <Tab.Screen name="Customers"  component={CustomersStack}   options={{ title: 'Customers' }} />
      <Tab.Screen name="Products"   component={ProductsStack}    options={{ title: 'Products' }} />
      {/* Stabilization Phase 4 — operations holds the backend 'dispatch'
          permission (db/migrate.js) and can already review/approve dispatch
          requests server-side, but had no tab to reach the screen at all. */}
      <Tab.Screen name="Dispatch"   component={DispatchStack}    options={{ title: 'Dispatch' }} />
      <Tab.Screen name="Machines"           component={MachinesStack}          options={{ title: 'Machines' }} />
      <Tab.Screen name="WorkshopOverview"   component={WorkshopOverviewStack}   options={{ title: 'Wk Overview' }} />
      <Tab.Screen name="WorkshopManagement" component={WorkshopManagementStack} options={{ title: 'Workshops' }} />
      <Tab.Screen name="Compartments"       component={CompartmentsStack}       options={{ title: 'Compartments' }} />
      <Tab.Screen name="StockCatalog"       component={StockCatalogStack}       options={{ title: 'Stock' }} />
      <Tab.Screen name="StockInventory"     component={StockInventoryStack}     options={{ title: 'Levels' }} />
      <Tab.Screen name="StockMovements"     component={StockMovementsStack}     options={{ title: 'Movements' }} />
      <Tab.Screen name="TimberInventory"    component={TimberInventoryStack}    options={{ title: 'Timber Inv.' }} />
      <Tab.Screen name="StockTransfers"    component={StockTransfersStack}    options={{ title: 'Transfers' }} />
      <Tab.Screen name="SalesOrders"       component={SalesOrdersStack}       options={{ title: 'Sales Orders' }} />
      <Tab.Screen name="Reports"           component={ReportsStack}            options={{ title: 'Reports' }} />
      {/* Finance Enterprise Phase 2 — operations holds 'finance-center' too */}
      <Tab.Screen name="FinanceCenter"     component={FinanceCenterStack}      options={{ title: 'Finance' }} />
      <Tab.Screen name="Admin"             component={AdminStack}              options={{ title: 'Admin' }} />
      <Tab.Screen name="MyRequests"        component={MyRequestsStack}         options={{ title: 'My Requests' }} />
    </Tab.Navigator>
  );
}
