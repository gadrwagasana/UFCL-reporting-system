import React from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader } from '../../components/AppHeader';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { StatusBadge } from '../../components/StatusBadge';
import { LogisticsHistoryCard } from '../../components/LogisticsHistoryCard';
import { useSalesOrderDetail } from '../../hooks/useSalesOrders';
import { SalesOrdersStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp    = NativeStackNavigationProp<SalesOrdersStackParamList, 'SalesOrderDetail'>;
type RoutePropT = RouteProp<SalesOrdersStackParamList, 'SalesOrderDetail'>;

function fmtCur(n: number, cur = 'RWF'): string {
  return `${cur} ${Math.round(n).toLocaleString()}`;
}

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{String(value)}</Text>
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={s.sectionTitle}>{title}</Text>;
}

// Master Professionalization Phase C1 — Sales Orders had no detail/drill-down
// screen anywhere (Gap Register — "the one entity type in the app whose
// captured audit history has zero UI to view it"). Follows
// CustomerDetailScreen's proven "ScrollView + section cards" shape; the
// History card reuses the existing generic LogisticsHistoryCard component
// rather than a second implementation, now that 'sales' is a permitted
// module for it (data.js's logisticsRecordHistory).
export function SalesOrderDetailScreen() {
  const navigation = useNavigation<NavProp>();
  const route      = useRoute<RoutePropT>();
  const { orderId, orderNumber } = route.params;

  const { data, isLoading, isError, refetch } = useSalesOrderDetail(orderId);

  if (isLoading) return <LoadingState message="Loading order…" fullScreen />;
  if (isError || !data?.ok) return <ErrorState message="Could not load order" onRetry={refetch} fullScreen />;

  const { order, deliveries, totalValue, inventoryNote } = data;
  const cur = order.currency || 'RWF';

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader title={orderNumber || order.order_number || 'Sales Order'} dark onBack={() => navigation.goBack()} />

      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        <View style={s.header}>
          <Text style={s.orderNum}>{order.order_number}</Text>
          <StatusBadge status={order.status} />
        </View>

        <View style={s.card}>
          <SectionHeader title="Overview" />
          <Row label="Customer" value={order.customer_registered_name || order.customer_name} />
          <Row label="Workshop" value={order.workshop_name || 'Company-wide'} />
          <Row label="Product" value={`${order.product_type}${order.product_sub_type ? ' — ' + order.product_sub_type : ''} ${order.product_size}`} />
          <Row label="Quantity" value={order.quantity.toLocaleString()} />
          <Row label="Unit price" value={`${Number(order.unit_price).toLocaleString()} ${cur}`} />
          <Row label="Total" value={fmtCur(totalValue, cur)} />
          {order.cogs != null ? <Row label="COGS" value={fmtCur(order.cogs, cur)} /> : null}
          {order.margin != null ? <Row label="Margin" value={fmtCur(order.margin, cur)} /> : null}
          <Row label="Payment" value={order.payment_status} />
          <Row label="Payment due" value={order.payment_due_date ? new Date(order.payment_due_date).toLocaleDateString('en-GB') : null} />
          <Row label="Created" value={new Date(order.created_at).toLocaleString('en-GB')} />
        </View>

        {order.notes ? (
          <View style={s.card}>
            <SectionHeader title="Notes" />
            <Text style={s.notes}>{order.notes}</Text>
          </View>
        ) : null}

        <View style={s.card}>
          <SectionHeader title={`Deliveries (${deliveries.length})`} />
          {deliveries.length === 0 ? (
            <Text style={s.emptyText}>No delivery orders created for this sale yet.</Text>
          ) : (
            deliveries.map((d) => (
              <View key={d.id} style={s.deliveryRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.orderNumber}>{d.order_number}</Text>
                  <Text style={s.orderMeta}>{d.driver_name || 'No driver'} · {d.delivery_date ? new Date(d.delivery_date).toLocaleDateString('en-GB') : '—'}</Text>
                  <Text style={s.orderMeta}>Dispatched {d.qty_dispatched ?? '—'} · Accepted {d.qty_accepted ?? '—'} · Rejected {d.qty_rejected ?? '—'}</Text>
                  {d.rejection_reason ? <Text style={s.orderMeta}>Reason: {d.rejection_reason}</Text> : null}
                </View>
                <StatusBadge status={d.status} size="sm" />
              </View>
            ))
          )}
        </View>

        <Text style={s.footnote}>{inventoryNote}</Text>

        <LogisticsHistoryCard module="sales" recordId={orderId} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  scroll:  { flex: 1 },
  content: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.xxxl },

  header: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center', ...Shadow.sm,
  },
  orderNum: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary, fontFamily: 'monospace' },

  card: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, gap: Spacing.xs, ...Shadow.sm,
  },
  sectionTitle: {
    fontSize: Typography.sm, fontWeight: Typography.semibold,
    color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: Spacing.xs,
  },

  row: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: Spacing.xs, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  rowLabel: { fontSize: Typography.sm, color: Colors.textMuted },
  rowValue: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },

  notes:     { fontSize: Typography.sm, color: Colors.textSecondary, lineHeight: 20 },
  emptyText: { fontSize: Typography.sm, color: Colors.textMuted },

  deliveryRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm,
    paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  orderNumber: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary, fontFamily: 'monospace' },
  orderMeta:   { fontSize: Typography.xs, color: Colors.textMuted },
  footnote:    { fontSize: Typography.xs, color: Colors.textMuted, fontStyle: 'italic' },
});
