import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader } from '../../components/AppHeader';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { StatusBadge } from '../../components/StatusBadge';
import { useSalesDashboard } from '../../hooks/useSalesOrders';
import { SalesDashboardStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<SalesDashboardStackParamList, 'SalesDashboard'>;

function fmtCur(n: number): string {
  return 'RWF ' + Math.round(n).toLocaleString();
}

function KpiCard({ icon, label, value, sub, color }: { icon: string; label: string; value: string; sub?: string; color?: string }) {
  return (
    <View style={[styles.kpiCard, color ? { borderTopColor: color, borderTopWidth: 3 } : null]}>
      <View style={styles.kpiHeader}>
        <Ionicons name={icon as any} size={14} color={Colors.textMuted} />
        <Text style={styles.kpiLabel}>{label}</Text>
      </View>
      <Text style={styles.kpiValue}>{value}</Text>
      {sub ? <Text style={styles.kpiSub}>{sub}</Text> : null}
    </View>
  );
}

// ERP Final Enterprise Completion Gate — confirmed no Sales Dashboard existed
// anywhere for the sales role on either platform (executiveDashboard/
// getCeoOverview compute real revenue KPIs but hard-exclude 'sales'). This
// screen replaces the generic shared DashboardScreen on the Sales tab
// navigator specifically (SalesNavigator.tsx) with real, sales-scoped data.
export function SalesDashboardScreen() {
  const navigation = useNavigation<NavProp>();
  const { data, isLoading, isError, refetch, isRefetching } = useSalesDashboard();

  if (isLoading) return <LoadingState message="Loading dashboard…" fullScreen />;
  if (isError || !data?.ok) return <ErrorState message="Could not load Sales Dashboard" onRetry={refetch} fullScreen />;

  const statusOrder = ['Pending', 'Confirmed', 'Dispatched', 'In Progress', 'Partially Delivered', 'Fully Delivered', 'Closed (Short)', 'Cancelled'];
  const statuses = statusOrder.filter(s => data.statusCounts[s]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader
        title="Sales Dashboard"
        dark
        actions={[{ icon: 'time-outline', label: 'Sales History', onPress: () => navigation.navigate('SalesHistory') }]}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={undefined}
      >
        <View style={styles.kpiGrid}>
          <KpiCard icon="cash-outline" label="Revenue Today" value={fmtCur(data.kpi.revenueToday)} color={Colors.success} />
          <KpiCard icon="calendar-outline" label="This Month" value={fmtCur(data.kpi.revenueMonth)} />
          <KpiCard icon="stats-chart-outline" label="This Year" value={fmtCur(data.kpi.revenueYear)} />
          <KpiCard icon="car-outline" label="Deliveries Pending" value={String(data.kpi.deliveriesPending)} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Orders by Status ({data.totalOrders} total)</Text>
          <View style={styles.statusGrid}>
            {statuses.length === 0 ? (
              <Text style={styles.emptyText}>No orders yet.</Text>
            ) : statuses.map(s => (
              <View key={s} style={styles.statusRow}>
                <StatusBadge status={s} size="sm" />
                <Text style={styles.statusCount}>{data.statusCounts[s].count}</Text>
                <Text style={styles.statusValue}>{fmtCur(data.statusCounts[s].value)}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Products This Month</Text>
          {data.topProducts.length === 0 ? (
            <Text style={styles.emptyText}>No sales recorded this month.</Text>
          ) : data.topProducts.map((p, i) => (
            <View key={i} style={styles.productRow}>
              <Text style={styles.productName} numberOfLines={1}>
                {p.product_type}{p.product_sub_type ? ` — ${p.product_sub_type}` : ''} {p.product_size ?? ''}
              </Text>
              <Text style={styles.productUnits}>{p.units_sold.toLocaleString()} units</Text>
              <Text style={styles.productValue}>{fmtCur(p.value)}</Text>
            </View>
          ))}
        </View>

        {/* Sales Enterprise Phase 2 (Priority 2) — "Sales by Customer" / "Sales by Workshop" */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Customers This Month</Text>
          {data.topCustomers.length === 0 ? (
            <Text style={styles.emptyText}>No sales recorded this month.</Text>
          ) : data.topCustomers.map((c, i) => (
            <View key={i} style={styles.productRow}>
              <Text style={styles.productName} numberOfLines={1}>{c.customer_name}</Text>
              <Text style={styles.productUnits}>{c.order_count} order{c.order_count === 1 ? '' : 's'}</Text>
              <Text style={styles.productValue}>{fmtCur(c.value)}</Text>
            </View>
          ))}
        </View>

        {data.byWorkshop.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sales by Workshop This Month</Text>
            {data.byWorkshop.map((w) => (
              <View key={w.workshop_id} style={styles.productRow}>
                <Text style={styles.productName} numberOfLines={1}>{w.workshop_name}</Text>
                <Text style={styles.productUnits}>{w.order_count} order{w.order_count === 1 ? '' : 's'}</Text>
                <Text style={styles.productValue}>{fmtCur(w.value)}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Recent Orders</Text>
            <TouchableOpacity onPress={() => navigation.navigate('SalesHistory')}>
              <Text style={styles.viewAllLink}>View full history</Text>
            </TouchableOpacity>
          </View>
          {data.recentOrders.length === 0 ? (
            <Text style={styles.emptyText}>No orders yet.</Text>
          ) : data.recentOrders.map(o => (
            <View key={o.id} style={styles.orderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.orderNumber}>{o.order_number}</Text>
                <Text style={styles.orderCustomer} numberOfLines={1}>{o.customer_name}</Text>
              </View>
              <StatusBadge status={o.status} size="sm" />
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  scroll:  { flex: 1 },
  content: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.xxxl },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  kpiCard: {
    flexBasis: '47%', flexGrow: 1, backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, gap: 4, ...Shadow.sm,
  },
  kpiHeader: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  kpiLabel:  { fontSize: Typography.xs, color: Colors.textMuted },
  kpiValue:  { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary },
  kpiSub:    { fontSize: Typography.xs, color: Colors.textMuted },

  section: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, gap: Spacing.xs, ...Shadow.sm,
  },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: {
    fontSize: Typography.sm, fontWeight: Typography.semibold,
    color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: Spacing.xs,
  },
  viewAllLink: { fontSize: Typography.xs, color: Colors.navy, fontWeight: Typography.medium },
  emptyText: { fontSize: Typography.sm, color: Colors.textMuted },

  statusGrid: { gap: Spacing.xs },
  statusRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.xs, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  statusCount: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary },
  statusValue: { flex: 1, fontSize: Typography.xs, color: Colors.textMuted, textAlign: 'right' },

  productRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.xs, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  productName:  { flex: 1, fontSize: Typography.sm, color: Colors.textPrimary },
  productUnits: { fontSize: Typography.xs, color: Colors.textMuted },
  productValue: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.textPrimary, minWidth: 80, textAlign: 'right' },

  orderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.xs, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  orderNumber:   { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary, fontFamily: 'monospace' },
  orderCustomer: { fontSize: Typography.xs, color: Colors.textMuted },
});
