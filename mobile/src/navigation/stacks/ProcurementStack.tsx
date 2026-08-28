import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProcurementStackParamList } from '../types';
import { ProcurementDashboardScreen } from '../../screens/procurement/ProcurementDashboardScreen';
import { SuppliersListScreen }       from '../../screens/procurement/SuppliersListScreen';
import { SupplierDetailScreen }      from '../../screens/procurement/SupplierDetailScreen';
import { SupplierFormScreen }        from '../../screens/procurement/SupplierFormScreen';
import { SupplierComparisonScreen }  from '../../screens/procurement/SupplierComparisonScreen';
import { RequisitionsListScreen }    from '../../screens/procurement/RequisitionsListScreen';
import { RequisitionDetailScreen }   from '../../screens/procurement/RequisitionDetailScreen';
import { RequisitionFormScreen }     from '../../screens/procurement/RequisitionFormScreen';
import { RfqListScreen }             from '../../screens/procurement/RfqListScreen';
import { RfqDetailScreen }           from '../../screens/procurement/RfqDetailScreen';
import { RfqCreateScreen }           from '../../screens/procurement/RfqCreateScreen';
import { PurchaseOrdersListScreen }  from '../../screens/procurement/PurchaseOrdersListScreen';
import { PurchaseOrderDetailScreen } from '../../screens/procurement/PurchaseOrderDetailScreen';
import { GoodsReceiptListScreen }    from '../../screens/procurement/GoodsReceiptListScreen';
import { GoodsReceiptCreateScreen }  from '../../screens/procurement/GoodsReceiptCreateScreen';
import { GoodsReceiptDetailScreen }  from '../../screens/procurement/GoodsReceiptDetailScreen';
import { InvoicesListScreen }        from '../../screens/procurement/InvoicesListScreen';
import { InvoiceDetailScreen }       from '../../screens/procurement/InvoiceDetailScreen';
import { ProcurementReportsScreen }  from '../../screens/procurement/ProcurementReportsScreen';
import { ProcurementSettingsScreen } from '../../screens/procurement/ProcurementSettingsScreen';
import { SrmDashboardScreen }        from '../../screens/procurement/SrmDashboardScreen';
import { ContractRegisterScreen }    from '../../screens/procurement/ContractRegisterScreen';
import { ComplianceCenterScreen }    from '../../screens/procurement/ComplianceCenterScreen';

const Stack = createNativeStackNavigator<ProcurementStackParamList>();

export function ProcurementStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProcurementDashboard" component={ProcurementDashboardScreen} />
      <Stack.Screen name="SuppliersList"        component={SuppliersListScreen} />
      <Stack.Screen name="SupplierDetail"       component={SupplierDetailScreen} />
      <Stack.Screen name="SupplierForm"         component={SupplierFormScreen} />
      <Stack.Screen name="SupplierComparison"   component={SupplierComparisonScreen} />
      <Stack.Screen name="RequisitionsList"     component={RequisitionsListScreen} />
      <Stack.Screen name="RequisitionDetail"    component={RequisitionDetailScreen} />
      <Stack.Screen name="RequisitionForm"      component={RequisitionFormScreen} />
      <Stack.Screen name="RfqList"               component={RfqListScreen} />
      <Stack.Screen name="RfqDetail"             component={RfqDetailScreen} />
      <Stack.Screen name="RfqCreate"             component={RfqCreateScreen} />
      <Stack.Screen name="PurchaseOrdersList"    component={PurchaseOrdersListScreen} />
      <Stack.Screen name="PurchaseOrderDetail"   component={PurchaseOrderDetailScreen} />
      <Stack.Screen name="GoodsReceiptList"       component={GoodsReceiptListScreen} />
      <Stack.Screen name="GoodsReceiptCreate"     component={GoodsReceiptCreateScreen} />
      <Stack.Screen name="GoodsReceiptDetail"     component={GoodsReceiptDetailScreen} />
      <Stack.Screen name="InvoicesList"           component={InvoicesListScreen} />
      <Stack.Screen name="InvoiceDetail"          component={InvoiceDetailScreen} />
      <Stack.Screen name="ProcurementReports"     component={ProcurementReportsScreen} />
      <Stack.Screen name="ProcurementSettings"    component={ProcurementSettingsScreen} />
      <Stack.Screen name="SrmDashboard"           component={SrmDashboardScreen} />
      <Stack.Screen name="ContractRegister"       component={ContractRegisterScreen} />
      <Stack.Screen name="ComplianceCenter"       component={ComplianceCenterScreen} />
    </Stack.Navigator>
  );
}
