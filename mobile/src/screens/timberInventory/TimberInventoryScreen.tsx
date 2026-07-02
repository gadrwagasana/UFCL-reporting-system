import React from 'react';
import { StyleSheet, View, Text, FlatList, RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar }    from 'expo-status-bar';
import { AppHeader }    from '../../components/AppHeader';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState }   from '../../components/ErrorState';
import { useTimberInventory } from '../../hooks/useTimberInventory';
import type { ProductionDay, HarvestSpecies } from '../../types/api';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

// ── KPI Banner ────────────────────────────────────────────────────────────────
function MetricsBanner({ timberStock, polesStock, timberProduced, wasteRate }: {
  timberStock: number; polesStock: number; timberProduced: number; wasteRate: string;
}) {
  const wasteNum   = Number(wasteRate);
  const wasteColor = wasteNum > 15 ? Colors.error : Colors.warning;
  return (
    <View style={s.banner}>
      <View style={s.stat}>
        <Text style={s.statValue}>{timberStock.toLocaleString()}</Text>
        <Text style={s.statLabel}>Timber stock</Text>
      </View>
      <View style={s.stat}>
        <Text style={s.statValue}>{polesStock.toLocaleString()}</Text>
        <Text style={s.statLabel}>Poles stock</Text>
      </View>
      <View style={s.stat}>
        <Text style={s.statValue}>{timberProduced.toLocaleString()}</Text>
        <Text style={s.statLabel}>Produced</Text>
      </View>
      <View style={s.stat}>
        <Text style={[s.statValue, { color: wasteColor }]}>{wasteRate}%</Text>
        <Text style={s.statLabel}>Waste rate</Text>
      </View>
    </View>
  );
}

// ── Timber Stock Breakdown ────────────────────────────────────────────────────
function StockBreakdownCard({ stock }: { stock: NonNullable<ReturnType<typeof useTimberInventory>['data']>['stock'] }) {
  const stockColor = (v: number) => v <= 0 ? Colors.error : Colors.textPrimary;
  const rows: Array<{ label: string; produced: number; sold: number; stock: number; bold?: boolean; topBorder?: boolean }> = [
    { label: 'Kiln-dried',    produced: stock.kilnDriedProduced,  sold: stock.kilnDriedSold,  stock: stock.kilnDriedStock  },
    { label: 'CCA-treated',   produced: stock.ccaTreatedProduced,  sold: stock.ccaTreatedSold,  stock: stock.ccaTreatedStock  },
    { label: 'Untreated',     produced: stock.untreatedProduced,   sold: stock.untreatedSold,   stock: stock.untreatedStock   },
    { label: 'Total timber',  produced: stock.timberProduced,      sold: stock.timberSold,      stock: stock.timberStock,     bold: true, topBorder: true },
    { label: 'Poles',         produced: stock.polesProduced,       sold: stock.polesSold,       stock: stock.polesStock       },
  ];

  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>Timber stock breakdown</Text>
      <View style={s.tableHeader}>
        <Text style={[s.th, { flex: 2 }]}>Type</Text>
        <Text style={[s.th, s.thR]}>Produced</Text>
        <Text style={[s.th, s.thR]}>Sold</Text>
        <Text style={[s.th, s.thR]}>Stock</Text>
      </View>
      {rows.map(r => (
        <View key={r.label} style={[s.tableRow, r.topBorder && s.topBorder]}>
          <Text style={[s.td, { flex: 2 }, r.bold && s.tdBold]}>{r.label}</Text>
          <Text style={[s.tdNum, r.bold && s.tdBold]}>{r.produced.toLocaleString()}</Text>
          <Text style={[s.tdNum, r.bold && s.tdBold]}>{r.sold.toLocaleString()}</Text>
          <Text style={[s.tdNum, r.bold && s.tdBold, { color: r.label === 'Total timber' ? (r.stock <= 0 ? Colors.error : Colors.success) : stockColor(r.stock) }]}>
            {r.stock.toLocaleString()}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ── Harvest by Species ────────────────────────────────────────────────────────
function HarvestSummaryCard({ rows }: { rows: HarvestSpecies[] }) {
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>Harvest by species</Text>
      {rows.length === 0 ? (
        <Text style={s.emptyText}>No harvest records yet. Add them in the Harvest Tracking page.</Text>
      ) : (
        <>
          <View style={s.tableHeader}>
            <Text style={[s.th, { flex: 2 }]}>Species</Text>
            <Text style={[s.th, s.thR]}>Total harvested</Text>
            <Text style={[s.th, s.thR]}>Harvest runs</Text>
          </View>
          {rows.map(r => (
            <View key={r.species} style={s.tableRow}>
              <Text style={[s.td, { flex: 2 }, s.tdBold]}>{r.species}</Text>
              <Text style={s.tdNum}>{Number(r.total).toLocaleString()}</Text>
              <Text style={s.tdNum}>{r.harvests}</Text>
            </View>
          ))}
        </>
      )}
    </View>
  );
}

// ── Last 7 Production Days ────────────────────────────────────────────────────
function ProductionDaysCard({ rows }: { rows: ProductionDay[] }) {
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>Last 7 production days</Text>
      {rows.length === 0 ? (
        <Text style={s.emptyText}>No production logs in the last 7 days.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <View style={s.tableHeader}>
              {['Date','Total','Kiln-d.','CCA','Untr.','T.Waste','Poles','P.Waste','Down(h)','Supervisor'].map(h => (
                <Text key={h} style={[s.th, { minWidth: h === 'Date' || h === 'Supervisor' ? 90 : 60 }]}>{h}</Text>
              ))}
            </View>
            {rows.map((r, i) => (
              <View key={i} style={s.tableRow}>
                <Text style={[s.td, { minWidth: 90 }, s.tdBold]}>{r.date}</Text>
                <Text style={[s.tdNum, { minWidth: 60 }]}>{r.timber_units}</Text>
                <Text style={[s.tdNum, { minWidth: 60 }]}>{r.timber_kiln_dried}</Text>
                <Text style={[s.tdNum, { minWidth: 60 }]}>{r.timber_cca_treated}</Text>
                <Text style={[s.tdNum, { minWidth: 60 }]}>{r.timber_untreated}</Text>
                <Text style={[s.tdNum, { minWidth: 60 }, Number(r.timber_waste) > 0 && { color: Colors.warning }]}>
                  {r.timber_waste}
                </Text>
                <Text style={[s.tdNum, { minWidth: 60 }]}>{r.poles_units}</Text>
                <Text style={[s.tdNum, { minWidth: 60 }, Number(r.poles_waste) > 0 && { color: Colors.warning }]}>
                  {r.poles_waste}
                </Text>
                <Text style={[s.tdNum, { minWidth: 60 }, Number(r.downtime_hours) > 0 && { color: Colors.error }]}>
                  {Number(r.downtime_hours).toFixed(1)}
                </Text>
                <Text style={[s.td, { minWidth: 90 }]}>{r.supervisor ?? '—'}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export function TimberInventoryScreen() {
  const { data, isLoading, isError, refetch, isRefetching } = useTimberInventory();

  if (isLoading) return <LoadingState message="Loading timber inventory…" fullScreen />;
  if (isError)   return <ErrorState  message="Could not load timber inventory" onRetry={refetch} fullScreen />;

  const stock          = data!.stock;
  const logs7          = data!.logs7;
  const harvestSummary = data!.harvestSummary;
  const wasteRate      = data!.wasteRate;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader
        title="Timber Inventory"
        subtitle="Real-time stock balances from daily production and sales"
        dark
      />
      <FlatList
        data={[]}
        keyExtractor={() => ''}
        renderItem={null}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
        ListHeaderComponent={
          <>
            <MetricsBanner
              timberStock={stock.timberStock}
              polesStock={stock.polesStock}
              timberProduced={stock.timberProduced}
              wasteRate={wasteRate}
            />
            <View style={s.twoCol}>
              <View style={s.halfCol}>
                <StockBreakdownCard stock={stock} />
              </View>
              <View style={s.halfCol}>
                <HarvestSummaryCard rows={harvestSummary} />
              </View>
            </View>
            <ProductionDaysCard rows={logs7} />
          </>
        }
        contentContainerStyle={s.list}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  list: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.xxxl },

  banner: {
    flexDirection: 'row', backgroundColor: Colors.navy,
    borderRadius: Radius.lg, padding: Spacing.base,
    justifyContent: 'space-around', ...Shadow.sm,
  },
  stat:      { alignItems: 'center', gap: 2 },
  statValue: { fontSize: Typography.sm, fontWeight: Typography.bold, color: Colors.white },
  statLabel: { fontSize: 9, color: Colors.tabInactive, textTransform: 'uppercase', letterSpacing: 0.4 },

  twoCol:  { flexDirection: 'row', gap: Spacing.sm },
  halfCol: { flex: 1 },

  card: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, ...Shadow.sm,
  },
  cardTitle: {
    fontSize: Typography.sm, fontWeight: Typography.semibold,
    color: Colors.textPrimary, marginBottom: Spacing.sm,
  },

  tableHeader: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border,
    paddingBottom: 4, marginBottom: 2,
  },
  th:    { fontSize: 10, color: Colors.textMuted, fontWeight: Typography.medium, flex: 1 },
  thR:   { textAlign: 'right' },
  tableRow: {
    flexDirection: 'row', paddingVertical: 4,
    borderBottomWidth: 1, borderBottomColor: Colors.border + '60',
  },
  topBorder: { borderTopWidth: 2, borderTopColor: Colors.border, marginTop: 2, paddingTop: 6 },
  td:    { fontSize: Typography.xs, color: Colors.textPrimary, flex: 1 },
  tdNum: { fontSize: Typography.xs, color: Colors.textPrimary, flex: 1, textAlign: 'right', fontFamily: 'monospace' },
  tdBold: { fontWeight: Typography.semibold },

  emptyText: { fontSize: Typography.xs, color: Colors.textMuted, fontStyle: 'italic', paddingTop: Spacing.xs },
});
