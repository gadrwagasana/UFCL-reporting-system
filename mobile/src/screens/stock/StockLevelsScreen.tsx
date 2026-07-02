import React from 'react';
import { StyleSheet, View, Text, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { StatusBar }     from 'expo-status-bar';
import { AppHeader }     from '../../components/AppHeader';
import { LoadingState }  from '../../components/LoadingState';
import { ErrorState }    from '../../components/ErrorState';
import { EmptyState }    from '../../components/EmptyState';
import { useStockInventory } from '../../hooks/useStock';
import type { InventoryItem } from '../../types/api';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

function MetricsBanner({ total, alerts, healthy, value }: {
  total: number; alerts: number; healthy: number; value: number;
}) {
  return (
    <View style={styles.banner}>
      {[
        { label: 'Total SKUs',   value: String(total),                     accent: false },
        { label: 'Reorder',      value: String(alerts),                    accent: alerts > 0 },
        { label: 'Healthy',      value: String(healthy),                   accent: false },
        { label: 'Value (RWF)',  value: Math.round(value).toLocaleString(), accent: false },
      ].map(item => (
        <View key={item.label} style={styles.stat}>
          <Text style={[styles.statValue, item.accent && { color: Colors.error }]}>{item.value}</Text>
          <Text style={styles.statLabel}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

function ReorderBanner({ rows }: { rows: InventoryItem[] }) {
  if (!rows.length) return null;
  return (
    <View style={styles.reorderCard}>
      <Text style={styles.reorderTitle}>
        {rows.length} item{rows.length > 1 ? 's' : ''} require reorder
      </Text>
      {rows.map(r => (
        <View key={r.id} style={styles.reorderRow}>
          <View style={styles.catBadge}><Text style={styles.catText}>{r.category}</Text></View>
          <Text style={styles.reorderName} numberOfLines={1}>{r.name}</Text>
          <Text style={styles.reorderQty}>{r.stock} / {r.min_stock} {r.uom}</Text>
        </View>
      ))}
    </View>
  );
}

function ItemRow({ item }: { item: InventoryItem }) {
  const out  = Number(item.stock) === 0;
  const low  = Number(item.stock) <= Number(item.min_stock);
  const val  = Math.round(Number(item.stock) * Number(item.unit_cost));
  const status = out ? 'Out' : low ? 'Reorder' : 'OK';
  const statusStyle = out ? styles.badgeRed : low ? styles.badgeAmber : styles.badgeGreen;

  return (
    <View style={styles.row}>
      <View style={styles.rowTop}>
        <View style={styles.catBadge}><Text style={styles.catText}>{item.category}</Text></View>
        <View style={[styles.statusBadge, statusStyle]}>
          <Text style={styles.statusText}>{status}</Text>
        </View>
      </View>
      <Text style={styles.itemName}>{item.name}</Text>
      {item.sku ? <Text style={styles.sku}>{item.sku}</Text> : null}
      <View style={styles.rowBottom}>
        <Text style={[styles.stockQty, out ? styles.stockRed : low ? styles.stockAmber : styles.stockOk]}>
          {item.stock} <Text style={styles.uomText}>{item.uom}</Text>
        </Text>
        <Text style={styles.metaText}>Min {item.min_stock}</Text>
        <Text style={styles.metaText}>RWF {Number(item.unit_cost).toLocaleString()}/u</Text>
        <Text style={styles.metaText}>Value {val.toLocaleString()}</Text>
      </View>
    </View>
  );
}

export function StockLevelsScreen() {
  const { data, isLoading, isError, refetch, isRefetching } = useStockInventory();

  if (isLoading) return <LoadingState message="Loading inventory…" fullScreen />;
  if (isError)   return <ErrorState  message="Could not load inventory" onRetry={refetch} fullScreen />;

  const rows    = data?.rows ?? [];
  const lowRows = rows.filter(r => Number(r.stock) <= Number(r.min_stock));
  const okRows  = rows.filter(r => Number(r.stock) > Number(r.min_stock));
  const total   = rows.reduce((s, r) => s + Number(r.stock) * Number(r.unit_cost), 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader title="Stock Levels" subtitle="Live inventory — read only" dark />

      <FlatList
        data={rows}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
        ListHeaderComponent={
          <>
            <MetricsBanner total={rows.length} alerts={lowRows.length} healthy={okRows.length} value={total} />
            <ReorderBanner rows={lowRows} />
          </>
        }
        ListEmptyComponent={
          <EmptyState icon="layers-outline" title="No stock data" subtitle="No inventory items have been registered." />
        }
        renderItem={({ item }) => <ItemRow item={item} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  list: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },

  banner: {
    flexDirection: 'row', backgroundColor: Colors.navy,
    borderRadius: Radius.lg, padding: Spacing.base,
    justifyContent: 'space-around', ...Shadow.sm, marginBottom: Spacing.sm,
  },
  stat:      { alignItems: 'center', gap: 2 },
  statValue: { fontSize: Typography.sm, fontWeight: Typography.bold, color: Colors.white },
  statLabel: { fontSize: 9, color: Colors.tabInactive, textTransform: 'uppercase', letterSpacing: 0.4 },

  reorderCard: {
    backgroundColor: Colors.error + '08', borderWidth: 1, borderColor: Colors.error + '30',
    borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.xs, marginBottom: Spacing.sm,
  },
  reorderTitle: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.error },
  reorderRow:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  reorderName:  { flex: 1, fontSize: Typography.xs, color: Colors.textPrimary },
  reorderQty:   { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.error },

  row: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, gap: Spacing.xs, ...Shadow.sm,
  },
  rowTop:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  itemName:  { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  sku:       { fontSize: Typography.xs, color: Colors.textMuted, fontFamily: 'monospace' },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },

  stockQty:   { fontSize: Typography.sm, fontWeight: Typography.bold },
  stockRed:   { color: Colors.error },
  stockAmber: { color: Colors.warning },
  stockOk:    { color: Colors.success },
  uomText:    { fontSize: Typography.xs, fontWeight: '400', color: Colors.textMuted },
  metaText:   { fontSize: Typography.xs, color: Colors.textSecondary },

  catBadge: { backgroundColor: Colors.navy + '15', borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  catText:  { fontSize: 10, color: Colors.navy, fontWeight: Typography.medium },

  statusBadge: { borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  badgeRed:    { backgroundColor: Colors.error + '20' },
  badgeAmber:  { backgroundColor: Colors.warning + '20' },
  badgeGreen:  { backgroundColor: Colors.success + '20' },
  statusText:  { fontSize: 10, fontWeight: Typography.semibold, color: Colors.textPrimary },
});
