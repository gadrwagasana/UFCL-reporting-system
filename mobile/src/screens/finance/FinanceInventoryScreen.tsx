import React from 'react';
import { StyleSheet, View, Text, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }     from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { LoadingState }  from '../../components/LoadingState';
import { ErrorState }    from '../../components/ErrorState';
import { useFinanceInventoryOverview, useFinanceStockVariance } from '../../hooks/useFinance';
import { FinanceCenterStackParamList } from '../../navigation/types';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<FinanceCenterStackParamList, 'FinanceInventory'>;

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

// Finance Enterprise — mobile Inventory Financial Control + Stock Variance
// summary. Same financeInventoryOverview/financeStockVarianceReport
// aggregations the desktop tabs read — no separate mobile calculation.
export function FinanceInventoryScreen() {
  const navigation = useNavigation<NavProp>();
  const inv = useFinanceInventoryOverview();
  const variance = useFinanceStockVariance();

  if (inv.isLoading) return <LoadingState message="Loading inventory overview…" fullScreen />;
  if (inv.isError || !inv.data) return <ErrorState message="Could not load inventory overview" onRetry={inv.refetch} fullScreen />;

  const d = inv.data;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Inventory" dark onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={inv.isRefetching} onRefresh={inv.refetch} tintColor={Colors.navy} />}
      >
        <View style={styles.grid}>
          <Tile label="Total Items" value={formatNumber(d.totals.item_count)} />
          <Tile label="Total Quantity" value={formatNumber(d.totals.total_qty)} />
          <Tile label="Total Value (est.)" value={formatCurrency(d.totals.total_value)} />
          <Tile label="Missing Cost" value={formatNumber(d.missingCostItems)} />
          <Tile label="Pending Rejected Qty" value={formatNumber(d.pendingRejectedQty)} />
          <Tile label="Waste Resolved (Month)" value={formatNumber(d.resolvedWasteThisMonth)} />
        </View>
        <Text style={styles.note}>{d.valuationNote}</Text>

        <Text style={styles.sectionTitle}>By Workshop</Text>
        {d.byWorkshop.map((w) => (
          <View key={w.workshop_id} style={styles.row}>
            <Text style={styles.rowLabel}>{w.workshop_name}</Text>
            <Text style={styles.rowValue}>{formatCurrency(w.total_value)}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>By Category</Text>
        {d.byCategory.map((c) => (
          <View key={c.category} style={styles.row}>
            <Text style={styles.rowLabel}>{c.category}</Text>
            <Text style={styles.rowValue}>{formatCurrency(c.total_value)}</Text>
          </View>
        ))}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Stock Variance</Text>
          {variance.data ? <Text style={styles.badgeText}>{variance.data.rows.length} variance line(s)</Text> : null}
        </View>
        {variance.isLoading ? (
          <Text style={styles.note}>Loading variance…</Text>
        ) : variance.data && variance.data.negativeStock.length > 0 ? (
          <View style={styles.warnBox}>
            <Text style={styles.warnText}>{variance.data.negativeStock.length} item(s) show negative stock.</Text>
          </View>
        ) : null}
        {variance.data?.rows.slice(0, 10).map((r) => (
          <View key={r.line_id} style={styles.row}>
            <Text style={styles.rowLabel} numberOfLines={1}>{r.item_name}</Text>
            <Text style={[styles.rowValue, r.variance < 0 ? styles.negative : styles.positive]}>{r.variance > 0 ? '+' : ''}{r.variance}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  tile: {
    flexBasis: '47%', flexGrow: 1,
    backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.sm,
  },
  tileLabel: { fontSize: Typography.xs, color: Colors.textMuted },
  tileValue: { fontSize: Typography.md, fontWeight: Typography.bold, color: Colors.textPrimary, marginTop: 2 },
  note: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: Spacing.xs },
  sectionTitle: {
    fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.6, marginTop: Spacing.md,
  },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badgeText: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: Spacing.md },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.card, borderRadius: Radius.md, padding: Spacing.sm, marginTop: Spacing.xs,
  },
  rowLabel: { fontSize: Typography.sm, color: Colors.textPrimary, flex: 1, marginRight: Spacing.sm },
  rowValue: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary },
  negative: { color: Colors.error },
  positive: { color: Colors.warning },
  warnBox: { backgroundColor: Colors.errorBg, borderRadius: Radius.md, padding: Spacing.md, marginTop: Spacing.xs },
  warnText: { fontSize: Typography.sm, color: Colors.error },
});
