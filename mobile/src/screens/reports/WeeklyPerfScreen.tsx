import React from 'react';
import { StyleSheet, View, Text, FlatList, ScrollView } from 'react-native';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { StatusBar }     from 'expo-status-bar';
import { AppHeader }     from '../../components/AppHeader';
import { LoadingState }  from '../../components/LoadingState';
import { ErrorState }    from '../../components/ErrorState';
import { useWeeklyPerf } from '../../hooks/useReports';
import { WeeklyPerfDailyRow, WeeklyPerfCategoryStatus } from '../../types/api';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

const RAG: Record<string, string> = {
  green: Colors.success,
  amber: Colors.warning,
  red:   Colors.error,
};

function KpiTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={s.tile}>
      <Text style={s.tileLabel}>{label}</Text>
      <Text style={s.tileValue}>{value}</Text>
      {sub && <Text style={s.tileSub}>{sub}</Text>}
    </View>
  );
}

function DailyRow({ row }: { row: WeeklyPerfDailyRow }) {
  return (
    <View style={s.tableRow}>
      <Text style={[s.cell, { flex: 1.4 }]} numberOfLines={1}>{row.date}</Text>
      <Text style={[s.cell, { flex: 1 }]}   numberOfLines={1}>{row.machine ?? '—'}</Text>
      <Text style={[s.cell, s.numCell]}>{row.timber_units}</Text>
      <Text style={[s.cell, s.numCell]}>{row.poles_units}</Text>
      <Text style={[s.cell, s.numCell]}>{row.downtime_hours}h</Text>
    </View>
  );
}

function CategoryRow({ row }: { row: WeeklyPerfCategoryStatus }) {
  return (
    <View style={s.tableRow}>
      <Text style={[s.cell, { flex: 1.5 }]} numberOfLines={1}>{row.category}</Text>
      <Text style={[s.cell, s.numCell]}>{row.amount.toLocaleString()}</Text>
      <Text style={[s.cell, s.numCell]}>{row.budget.toLocaleString()}</Text>
      <Text style={[s.cell, s.numCell, { color: row.variance > 5 ? Colors.error : row.variance < 0 ? Colors.success : Colors.textPrimary }]}>
        {row.variance >= 0 ? '+' : ''}{row.variance}%
      </Text>
      <View style={[s.ragDot, { backgroundColor: RAG[row.status] }]} />
    </View>
  );
}

export function WeeklyPerfScreen() {
  const { data, isLoading, isError, refetch } = useWeeklyPerf();

  if (isLoading) return <LoadingState message="Loading weekly performance…" fullScreen />;
  if (isError || !data) return <ErrorState message="Could not load weekly performance report" onRetry={refetch} fullScreen />;

  const { weekNumber, month, range, production, dailyRows, categoryStatus } = data;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader title="Weekly Performance" dark />

      <ScrollView contentContainerStyle={s.scroll} refreshControl={undefined}>
        <Text style={s.period}>Week {weekNumber} · {month} · {range}</Text>

        {/* 6 KPI tiles */}
        <View style={s.grid}>
          <KpiTile label="Timber produced"   value={production.timber.toLocaleString()}                   sub="units" />
          <KpiTile label="Poles produced"    value={production.poles.toLocaleString()}                    sub="units" />
          <KpiTile label="Downtime"          value={`${production.downtime_hours}h`}                      sub="total" />
          <KpiTile label="Cost/timber unit"  value={`RWF ${production.cost_per_timber.toLocaleString()}`} sub="per unit" />
          <KpiTile label="Cost/pole unit"    value={`RWF ${production.cost_per_pole.toLocaleString()}`}   sub="per unit" />
          <KpiTile label="Budget flags"      value={String(production.comment_count)}                     sub="categories" />
        </View>

        {/* Daily production table */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Daily production breakdown</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              <View style={[s.tableRow, s.tableHead]}>
                <Text style={[s.headCell, { flex: 1.4 }]}>Date</Text>
                <Text style={[s.headCell, { flex: 1 }]}>Machine</Text>
                <Text style={[s.headCell, s.numCell]}>Timber</Text>
                <Text style={[s.headCell, s.numCell]}>Poles</Text>
                <Text style={[s.headCell, s.numCell]}>Downtime</Text>
              </View>
              {dailyRows.length > 0
                ? dailyRows.map((r, i) => <DailyRow key={i} row={r} />)
                : <Text style={s.emptyText}>No production logs this week</Text>}
            </View>
          </ScrollView>
        </View>

        {/* Category cost status */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Cost category status</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              <View style={[s.tableRow, s.tableHead]}>
                <Text style={[s.headCell, { flex: 1.5 }]}>Category</Text>
                <Text style={[s.headCell, s.numCell]}>Amount</Text>
                <Text style={[s.headCell, s.numCell]}>Budget</Text>
                <Text style={[s.headCell, s.numCell]}>Var%</Text>
                <View style={{ width: 16 }} />
              </View>
              {categoryStatus.length > 0
                ? categoryStatus.map((r, i) => <CategoryRow key={i} row={r} />)
                : <Text style={s.emptyText}>No expense data this week</Text>}
            </View>
          </ScrollView>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: Colors.bg },
  scroll:      { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },
  period:      { fontSize: Typography.xs, color: Colors.textMuted },

  grid:        { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  tile:        { flex: 1, minWidth: '45%', backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, alignItems: 'center', gap: 2, ...Shadow.sm },
  tileLabel:   { fontSize: 10, color: Colors.textMuted, textAlign: 'center' },
  tileValue:   { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.textPrimary, textAlign: 'center' },
  tileSub:     { fontSize: 9, color: Colors.textMuted },

  card:        { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.xs, ...Shadow.sm },
  sectionTitle:{ fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textMuted },
  emptyText:   { fontSize: Typography.sm, color: Colors.textMuted, textAlign: 'center', padding: Spacing.base },

  tableHead:   { borderBottomWidth: 1, borderBottomColor: Colors.border, paddingBottom: 4 },
  tableRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border + '55', minWidth: 340 },
  headCell:    { fontSize: 10, fontWeight: Typography.semibold, color: Colors.textMuted, flex: 1, paddingHorizontal: 4 },
  cell:        { fontSize: Typography.xs, color: Colors.textPrimary, flex: 1, paddingHorizontal: 4 },
  numCell:     { width: 72, textAlign: 'right' as const, flex: undefined as any },
  ragDot:      { width: 10, height: 10, borderRadius: 5, marginLeft: 4 },
});
