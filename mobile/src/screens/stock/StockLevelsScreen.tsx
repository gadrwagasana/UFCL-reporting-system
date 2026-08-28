import React from 'react';
import { StyleSheet, View, Text, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { StatusBar }     from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { LineChart }     from 'react-native-gifted-charts';
import { AppHeader }     from '../../components/AppHeader';
import { LoadingState }  from '../../components/LoadingState';
import { ErrorState }    from '../../components/ErrorState';
import { EmptyState }    from '../../components/EmptyState';
import { KpiCard }       from '../../components/KpiCard';
import { useStockInventory, useInventoryDashboard, useInventoryIntelligence } from '../../hooks/useStock';
import type { InventoryItem, InventoryDashboardWidgetItem, InventoryReorderWatchItem } from '../../types/api';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

// Phase 2 — "what needs attention" list widget, same pattern as the
// Workshop Dashboard's OpsWidget.
function OpsWidget({ title, items, emptyMsg }: { title: string; items: { label: string; sub?: string; badge?: string }[]; emptyMsg: string }) {
  const shown = items.slice(0, 5);
  return (
    <View style={styles.widgetCard}>
      <Text style={styles.widgetTitle}>{title} <Text style={styles.widgetCount}>({items.length})</Text></Text>
      {shown.length === 0 ? (
        <Text style={styles.emptyText}>{emptyMsg}</Text>
      ) : shown.map((it, i) => (
        <View key={i} style={styles.widgetRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.widgetLabel} numberOfLines={1}>{it.label}</Text>
            {it.sub ? <Text style={styles.widgetSub} numberOfLines={1}>{it.sub}</Text> : null}
          </View>
          {it.badge ? <Text style={styles.widgetBadge}>{it.badge}</Text> : null}
        </View>
      ))}
      {items.length > 5 ? <Text style={styles.widgetMore}>+{items.length - 5} more</Text> : null}
    </View>
  );
}

// Phase 3 — 6-month trend chart, same inline `LineChart`
// (react-native-gifted-charts, already a dependency) pattern already used
// by the Workshop Dashboard's own TrendChart — no new chart component.
function TrendChart({ title, points, color, suffix }: { title: string; points: { month: string; value: number }[]; color: string; suffix?: string }) {
  const vals = points.map(p => ({ value: p.value }));
  const latest = points.length ? points[points.length - 1] : null;
  return (
    <View style={styles.widgetCard}>
      <Text style={styles.widgetTitle}>{title}</Text>
      {latest ? <Text style={styles.miniKpiValue}>{latest.value.toLocaleString()}{suffix ?? ''}</Text> : null}
      {vals.some(v => v.value !== 0) ? (
        <View style={{ marginTop: Spacing.xs }}>
          <LineChart
            data={vals}
            width={260}
            height={60}
            hideDataPoints
            color={color}
            thickness={2}
            hideYAxisText
            hideAxesAndRules
            areaChart
            startFillColor={color + '22'}
            endFillColor={color + '00'}
            curved
            noOfSections={3}
            initialSpacing={0}
            endSpacing={0}
          />
        </View>
      ) : <Text style={styles.emptyText}>No data yet.</Text>}
      {points.length >= 2 ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
          <Text style={styles.widgetSub}>{points[0].month}</Text>
          <Text style={styles.widgetSub}>{points[points.length - 1].month}</Text>
        </View>
      ) : null}
    </View>
  );
}

// Phase 3 — Reorder Watch List, a compact risk-tagged list (the mobile
// equivalent of the desktop table); reuses the same widget card shell.
function ReorderWatchCard({ items }: { items: InventoryReorderWatchItem[] }) {
  return (
    <View style={styles.widgetCard}>
      <Text style={styles.widgetTitle}>Reorder Watch List <Text style={styles.widgetCount}>({items.length})</Text></Text>
      {items.length === 0 ? (
        <Text style={styles.emptyText}>No items projected to run out within 30 days.</Text>
      ) : items.slice(0, 5).map(it => (
        <View key={it.id} style={styles.widgetRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.widgetLabel} numberOfLines={1}>{it.name}</Text>
            <Text style={styles.widgetSub}>{it.total_stock} {it.uom} on hand</Text>
          </View>
          <Text style={[styles.widgetBadge, it.riskLevel === 'Critical' && { color: Colors.error, fontWeight: Typography.semibold }]}>
            {it.days_remaining}d · {it.riskLevel}
          </Text>
        </View>
      ))}
      {items.length > 5 ? <Text style={styles.widgetMore}>+{items.length - 5} more</Text> : null}
    </View>
  );
}

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

// Phase C5 — Executive KPI tiles become tappable deep links into the sibling
// stock tabs, mirroring the desktop Inventory Dashboard's own drill-down fix
// and the same cross-tab navigation pattern already established by the
// Mechanician Dashboard (untyped `as never` cast, no new composite-navigator
// typing). This screen is reused verbatim across 4 different tab navigators
// (CEO, Logistics, Operations, Storekeeper) whose sibling tabs differ — CEO
// and Logistics have no Material Requests tab at all — so each target is
// only wired live if the parent Tab.Navigator actually has that route;
// otherwise the tile is left non-interactive rather than a silent dead tap.
function goToTab(navigation: { navigate: (...args: never[]) => void }, tab: string) {
  navigation.navigate(tab as never);
}

export function StockLevelsScreen() {
  const { data, isLoading, isError, refetch, isRefetching } = useStockInventory();
  const { data: dash } = useInventoryDashboard();
  const { data: intel } = useInventoryIntelligence();
  const navigation = useNavigation();
  const siblingTabs: string[] = navigation.getParent()?.getState()?.routeNames ?? [];
  const hasStockTransfers = siblingTabs.includes('StockTransfers');
  const hasStockMovements = siblingTabs.includes('StockMovements');
  const hasMaterialRequests = siblingTabs.includes('MaterialReview') || siblingTabs.includes('MaterialRequest');

  if (isLoading) return <LoadingState message="Loading inventory…" fullScreen />;
  if (isError)   return <ErrorState  message="Could not load inventory" onRetry={refetch} fullScreen />;

  const rows    = data?.rows ?? [];
  const lowRows = rows.filter(r => Number(r.stock) <= Number(r.min_stock));
  const okRows  = rows.filter(r => Number(r.stock) > Number(r.min_stock));
  const total   = rows.reduce((s, r) => s + Number(r.stock) * Number(r.unit_cost), 0);

  const pendingTransfers: InventoryDashboardWidgetItem[] = dash?.pendingTransfers ?? [];
  const mrAwaiting: InventoryDashboardWidgetItem[] = dash?.materialRequestsAwaiting ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader title="Inventory Dashboard" subtitle="Live inventory across all workshops" searchModule="inventory" dark />

      <FlatList
        data={rows}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
        ListHeaderComponent={
          <>
            <MetricsBanner total={rows.length} alerts={lowRows.length} healthy={okRows.length} value={total} />
            {dash ? (
              <>
                <Text style={styles.sectionTitle}>Executive KPIs</Text>
                <View style={styles.kpiGrid}>
                  <KpiCard variant="tile" title="Available stock" value={dash.availableStock.toLocaleString()} />
                  <KpiCard variant="tile" title="In transit" value={dash.reservedStock.toLocaleString()} onPress={hasStockTransfers ? () => goToTab(navigation, 'StockTransfers') : undefined} />
                  <KpiCard variant="tile" title="Goods received" value={dash.goodsReceivedThisMonth} />
                  <KpiCard variant="tile" title="Transfers pending" value={dash.transfersPending} warn={dash.transfersPending > 0} onPress={hasStockTransfers ? () => goToTab(navigation, 'StockTransfers') : undefined} />
                  <KpiCard variant="tile" title="Material requests" value={dash.materialRequestsPending} warn={dash.materialRequestsPending > 0} onPress={hasMaterialRequests ? () => goToTab(navigation, siblingTabs.includes('MaterialReview') ? 'MaterialReview' : 'MaterialRequest') : undefined} />
                  <KpiCard variant="tile" title="Consumption (mo)" value={dash.consumptionThisMonth.toLocaleString()} onPress={hasStockMovements ? () => goToTab(navigation, 'StockMovements') : undefined} />
                </View>
                <Text style={styles.sectionTitle}>Operational Widgets</Text>
                <OpsWidget
                  title="Pending Transfers"
                  items={pendingTransfers.map(t => ({ label: t.item_name ?? '', sub: `${t.from_workshop ?? '—'} → ${t.to_workshop ?? '—'}`, badge: String(t.requested_qty ?? '') }))}
                  emptyMsg="No pending transfers."
                />
                <OpsWidget
                  title="Material Requests Awaiting"
                  items={mrAwaiting.map(r => ({ label: r.item_name ?? '', sub: r.workshop_name ?? '—', badge: r.priority }))}
                  emptyMsg="No requests waiting."
                />
              </>
            ) : null}
            {intel ? (
              <>
                <Text style={styles.sectionTitle}>Operational Intelligence</Text>
                <TrendChart title="Consumption Trend (6 mo)" points={intel.consumptionTrendMonths} color={Colors.error} />
                <TrendChart title="Inventory Trend (6 mo)" points={intel.inventoryTrendMonths} color={Colors.navy} />
                <View style={styles.kpiGrid}>
                  <KpiCard variant="tile" title="Healthy" value={intel.health.healthy} />
                  <KpiCard variant="tile" title="Low" value={intel.health.low} warn={intel.health.low > 0} />
                  <KpiCard variant="tile" title="Critical" value={intel.health.critical} warn={intel.health.critical > 0} />
                  <KpiCard variant="tile" title="Fast-moving" value={intel.health.fastMoving} />
                </View>
                <ReorderWatchCard items={intel.reorderWatchList} />
                <View style={styles.widgetCard}>
                  <Text style={styles.widgetTitle}>Forecast <Text style={styles.widgetCount}>next month</Text></Text>
                  <Text style={styles.widgetSub}>{intel.forecast.basis}</Text>
                  <View style={styles.widgetRow}>
                    <Text style={styles.widgetLabel}>Expected consumption</Text>
                    <Text style={styles.widgetBadge}>{intel.forecast.expectedConsumption.toLocaleString()}</Text>
                  </View>
                  <View style={styles.widgetRow}>
                    <Text style={styles.widgetLabel}>Expected receiving</Text>
                    <Text style={styles.widgetBadge}>{intel.forecast.expectedReceiving.toLocaleString()}</Text>
                  </View>
                  <View style={styles.widgetRow}>
                    <Text style={styles.widgetLabel}>Expected inventory level</Text>
                    <Text style={styles.widgetBadge}>{intel.forecast.expectedInventoryLevel.toLocaleString()}</Text>
                  </View>
                </View>
              </>
            ) : null}
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

  sectionTitle: {
    fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: Spacing.xs, marginTop: Spacing.xs,
  },
  kpiGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.sm,
  },
  miniKpiValue: { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.textPrimary },

  widgetCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base,
    marginBottom: Spacing.sm, ...Shadow.sm,
  },
  widgetTitle: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary, marginBottom: Spacing.xs },
  widgetCount: { color: Colors.textMuted, fontWeight: Typography.medium },
  widgetRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 4, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  widgetLabel: { fontSize: Typography.xs, fontWeight: Typography.medium, color: Colors.textPrimary },
  widgetSub:   { fontSize: 10, color: Colors.textMuted },
  widgetBadge: { fontSize: 10, color: Colors.textSecondary, marginLeft: Spacing.xs, flexShrink: 0 },
  widgetMore:  { fontSize: 10, color: Colors.textMuted, marginTop: 4 },
  emptyText:   { fontSize: Typography.sm, color: Colors.textMuted },
});
