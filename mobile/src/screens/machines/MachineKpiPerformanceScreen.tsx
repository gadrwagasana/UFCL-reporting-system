import React, { useState } from 'react';
import {
  StyleSheet, View, Text, FlatList, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar }    from 'expo-status-bar';
import { AppHeader }    from '../../components/AppHeader';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState }   from '../../components/ErrorState';
import { EmptyState }   from '../../components/EmptyState';
import { useMachineKpiPerformance } from '../../hooks/useMachines';
import { MachineKpiPerformanceRow } from '../../types/api';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

// Phase 1 Workshop parity fix — desktop's "KPI Performance" NAV page had no
// mobile equivalent at all. Mirrors machineKpiPerformance's own data shape
// (utilization %, efficiency %, downtime, KPI achievement vs. targets).

function pctColor(pct: number): string {
  if (pct >= 90) return Colors.success;
  if (pct >= 70) return Colors.warning;
  return Colors.error;
}

function KpiRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.statRow}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>{value}</Text>
    </View>
  );
}

function MachineKpiCard({ item }: { item: MachineKpiPerformanceRow }) {
  return (
    <View style={s.card}>
      <View style={s.cardTop}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.code}>{item.machine_code}</Text>
          <Text style={s.machineName} numberOfLines={1}>{item.machine_name}</Text>
        </View>
        {item.avgAchievement != null ? (
          <View style={[s.achBadge, { borderColor: pctColor(item.avgAchievement) }]}>
            <Text style={[s.achText, { color: pctColor(item.avgAchievement) }]}>{item.avgAchievement}%</Text>
          </View>
        ) : null}
      </View>
      <Text style={s.category}>{item.category_name}</Text>

      <View style={s.pctRow}>
        <View style={s.pctCell}>
          <Text style={[s.pctValue, { color: pctColor(item.utilization_pct) }]}>{item.utilization_pct}%</Text>
          <Text style={s.pctLabel}>Utilization</Text>
        </View>
        <View style={s.pctDivider} />
        <View style={s.pctCell}>
          <Text style={[s.pctValue, { color: pctColor(item.efficiency_pct) }]}>{item.efficiency_pct}%</Text>
          <Text style={s.pctLabel}>Efficiency</Text>
        </View>
      </View>

      <KpiRow label="Days logged"    value={String(item.days_logged)} />
      <KpiRow label="Hours worked"   value={item.total_hours_worked.toLocaleString()} />
      <KpiRow label="Downtime (hrs)" value={item.total_downtime.toLocaleString()} />
      <KpiRow label="Fuel consumed"  value={item.total_fuel.toLocaleString()} />
      <KpiRow label="Production"     value={`${item.total_production.toLocaleString()} ${item.capacity_unit}`} />

      {item.kpiResults.length > 0 ? (
        <View style={s.targetsBlock}>
          <Text style={s.targetsTitle}>KPI Targets</Text>
          {item.kpiResults.map((k) => (
            <View key={k.kpi_id} style={s.statRow}>
              <Text style={s.statLabel}>{k.kpi_name}</Text>
              <Text style={[s.statValue, k.achievement != null && { color: pctColor(k.achievement) }]}>
                {k.actual != null ? k.actual.toLocaleString() : '—'} / {k.target_value.toLocaleString()} {k.unit}
                {k.achievement != null ? ` (${k.achievement}%)` : ''}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function MachineKpiPerformanceScreen() {
  const [month] = useState<string | undefined>(undefined); // current month by default
  const { data, isLoading, isError, refetch, isRefetching } = useMachineKpiPerformance(month);
  const rows = data?.rows ?? [];

  if (isLoading) return <LoadingState message="Loading KPI performance…" fullScreen />;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader title="KPI Performance" subtitle={data?.month} dark />
      {isError ? (
        <ErrorState message="Could not load KPI performance" onRetry={refetch} fullScreen />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item.machine_id)}
          contentContainerStyle={rows.length === 0 ? s.emptyContainer : s.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
          ListEmptyComponent={
            <EmptyState icon="speedometer-outline" title="No KPI data" subtitle="No machine activity logged for this month yet." />
          }
          renderItem={({ item }) => <MachineKpiCard item={item} />}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: Colors.bg },
  list:           { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },
  emptyContainer: { flex: 1, justifyContent: 'center', padding: Spacing.base },

  card:    { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: 4, ...Shadow.sm },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  code:    { fontFamily: 'monospace', fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.textPrimary },
  machineName: { fontSize: Typography.sm, color: Colors.textSecondary },
  category: { fontSize: Typography.xs, color: Colors.textMuted, marginBottom: 4 },

  achBadge: { borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  achText:  { fontSize: Typography.sm, fontWeight: Typography.bold },

  pctRow: {
    flexDirection: 'row', backgroundColor: Colors.bg, borderRadius: Radius.md,
    paddingVertical: Spacing.sm, marginVertical: Spacing.xs,
  },
  pctCell:  { flex: 1, alignItems: 'center' },
  pctDivider: { width: 1, backgroundColor: Colors.border },
  pctValue: { fontSize: Typography.lg, fontWeight: Typography.bold },
  pctLabel: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },

  statRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  statLabel: { fontSize: Typography.xs, color: Colors.textMuted, flex: 1 },
  statValue: { fontSize: Typography.xs, fontWeight: Typography.medium, color: Colors.textPrimary, textAlign: 'right' },

  targetsBlock: { marginTop: Spacing.xs, paddingTop: Spacing.xs, borderTopWidth: 1, borderTopColor: Colors.divider },
  targetsTitle: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.textMuted, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.4 },
});
