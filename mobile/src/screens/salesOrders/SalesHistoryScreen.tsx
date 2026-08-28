import React, { useState } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { AppHeader } from '../../components/AppHeader';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { StatusBadge } from '../../components/StatusBadge';
import { DatePickerField } from '../../components/DatePickerField';
import { useSalesReport } from '../../hooks/useSalesOrders';
import { SalesReportRow } from '../../types/api';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

function fmtCur(n: number): string {
  return 'RWF ' + Math.round(n).toLocaleString();
}

function ReportRow({ item }: { item: SalesReportRow }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowTop}>
        <Text style={styles.orderNumber}>{item.order_number}</Text>
        <StatusBadge status={item.status} size="sm" />
      </View>
      <Text style={styles.customer} numberOfLines={1}>{item.customer_registered_name ?? item.customer_name}</Text>
      <Text style={styles.product} numberOfLines={1}>
        {item.product_type}{item.product_sub_type ? ` — ${item.product_sub_type}` : ''} {item.product_size ?? ''}
      </Text>
      <View style={styles.rowBottom}>
        <Text style={styles.meta}>{item.order_date}</Text>
        <Text style={styles.meta}>Qty {item.quantity}</Text>
        <Text style={styles.value}>{fmtCur(item.total_value)}</Text>
      </View>
      {/* Sales Enterprise Phase 2 — payment due date + margin (known-cost orders only) */}
      <View style={styles.rowBottom}>
        <Text style={styles.meta}>
          {item.payment_status ?? 'Unpaid'}{item.payment_due_date ? ` · Due ${new Date(item.payment_due_date).toLocaleDateString('en-GB')}` : ''}
        </Text>
        {item.margin != null && <Text style={styles.meta}>Margin {fmtCur(item.margin)}</Text>}
      </View>
    </View>
  );
}

// ERP Final Enterprise Completion Gate — real-time, non-capped Sales History
// report with date-range filtering (companion to SalesDashboardScreen's
// summary view, and desktop's combined Sales Dashboard page). CSV export
// stays desktop-only for this phase (Electron's native save-dialog flow has
// no direct mobile equivalent without a new share-sheet integration) — the
// on-screen filtered list itself is the real mobile deliverable.
export function SalesHistoryScreen() {
  useNavigation();
  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);
  const [applied, setApplied] = useState<{ dateFrom?: string; dateTo?: string }>({});

  const { data, isLoading, isError, refetch, isRefetching } = useSalesReport(applied);

  const rows = data?.ok ? data.rows : [];
  const summary = data?.ok ? data.summary : { totalOrders: 0, totalUnits: 0, totalValue: 0, totalCogs: 0, totalMargin: 0, marginKnownOrders: 0 };

  function apply() {
    setApplied({ dateFrom: dateFrom ?? undefined, dateTo: dateTo ?? undefined });
  }
  function clear() {
    setDateFrom(null); setDateTo(null); setApplied({});
  }

  if (isLoading) return <LoadingState message="Loading sales history…" fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader title="Sales History" dark />

      <View style={styles.filterBar}>
        <View style={{ flex: 1 }}><DatePickerField label="From" value={dateFrom} onChange={setDateFrom} /></View>
        <View style={{ flex: 1 }}><DatePickerField label="To" value={dateTo} onChange={setDateTo} /></View>
      </View>
      <View style={styles.filterActions}>
        <TouchableOpacity style={styles.applyBtn} onPress={apply}><Text style={styles.applyBtnText}>Apply</Text></TouchableOpacity>
        <TouchableOpacity style={styles.clearBtn} onPress={clear}><Text style={styles.clearBtnText}>Clear</Text></TouchableOpacity>
      </View>

      {isError ? (
        <ErrorState message="Could not load sales history" onRetry={refetch} fullScreen />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={rows.length === 0 ? styles.emptyContainer : styles.list}
          refreshing={isRefetching}
          onRefresh={refetch}
          ListHeaderComponent={rows.length > 0 ? (
            <View style={styles.summaryBar}>
              <Text style={styles.summaryText}>
                {summary.totalOrders} order(s) · {summary.totalUnits.toLocaleString()} unit(s) · {fmtCur(summary.totalValue)} revenue
                {summary.marginKnownOrders ? ` · ${fmtCur(summary.totalMargin)} margin (${summary.marginKnownOrders} known-cost order(s))` : ''}
              </Text>
            </View>
          ) : null}
          ListEmptyComponent={
            <EmptyState icon="receipt-outline" title="No orders in this range" subtitle="Try a different date range." />
          }
          renderItem={({ item }) => <ReportRow item={item} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  list: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },
  emptyContainer: { flex: 1, justifyContent: 'center' },

  filterBar: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.base, paddingTop: Spacing.sm },
  filterActions: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm },
  applyBtn: { flex: 1, backgroundColor: Colors.navy, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  applyBtnText: { color: Colors.white, fontSize: Typography.sm, fontWeight: Typography.semibold },
  clearBtn: { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  clearBtnText: { color: Colors.textSecondary, fontSize: Typography.sm },

  summaryBar: { paddingBottom: Spacing.sm },
  summaryText: { fontSize: Typography.xs, color: Colors.textMuted },

  row: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: 4, ...Shadow.sm },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderNumber: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary, fontFamily: 'monospace' },
  customer: { fontSize: Typography.sm, color: Colors.textSecondary },
  product: { fontSize: Typography.xs, color: Colors.textMuted },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  meta: { fontSize: Typography.xs, color: Colors.textMuted },
  value: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary },
});
