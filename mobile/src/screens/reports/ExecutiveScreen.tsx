import React from 'react';
import {
  StyleSheet, View, Text, ScrollView, RefreshControl,
} from 'react-native';
import { SafeAreaView }        from 'react-native-safe-area-context';
import { StatusBar }           from 'expo-status-bar';
import { LineChart }           from 'react-native-gifted-charts';
import { AppHeader }           from '../../components/AppHeader';
import { LoadingState }        from '../../components/LoadingState';
import { ErrorState }          from '../../components/ErrorState';
import { useExecutiveDashboard } from '../../hooks/useReports';
import { ExecTrendDay, ExecTopMachine, ExecTopDriver, ExecTopCompartment, ExecActiveUser } from '../../types/api';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

const CHART_W = 300;

function KpiCard({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <View style={s.kpiCard}>
      <Text style={[s.kpiValue, alert && { color: Colors.error }]}>{value}</Text>
      <Text style={s.kpiLabel}>{label}</Text>
    </View>
  );
}

function TrendCard({ title, rows, valueKey }: { title: string; rows: ExecTrendDay[]; valueKey: keyof ExecTrendDay }) {
  const vals = rows.map(r => ({ value: Number(r[valueKey] ?? 0) }));
  if (vals.length < 2) return null;
  const last  = vals[vals.length - 1].value;
  const prev  = vals[vals.length - 2].value;
  const delta = prev > 0 ? (((last - prev) / prev) * 100).toFixed(1) : null;
  const up    = last >= prev;
  return (
    <View style={s.trendCard}>
      <View style={s.trendHeader}>
        <Text style={s.trendTitle}>{title}</Text>
        {delta !== null && (
          <Text style={[s.trendDelta, { color: up ? Colors.success : Colors.error }]}>
            {up ? '▲' : '▼'} {Math.abs(Number(delta))}%
          </Text>
        )}
      </View>
      <LineChart
        data={vals}
        width={CHART_W}
        height={60}
        hideDataPoints
        color={Colors.navy}
        thickness={2}
        hideYAxisText
        hideAxesAndRules
        areaChart
        startFillColor={Colors.navy + '22'}
        endFillColor={Colors.navy + '00'}
        curved
        noOfSections={3}
        initialSpacing={0}
        endSpacing={0}
      />
    </View>
  );
}

function MachineRow({ m, rank }: { m: ExecTopMachine; rank: number }) {
  return (
    <View style={s.tableRow}>
      <Text style={s.rankCell}>#{rank}</Text>
      <View style={{ flex: 1 }}>
        <Text style={s.nameCell} numberOfLines={1}>{m.machine_code} {m.name}</Text>
      </View>
      <Text style={s.numCell}>{m.hours_worked}h</Text>
      <Text style={s.numCell}>{m.production}</Text>
      <Text style={[s.numCell, { color: m.efficiency_pct >= 80 ? Colors.success : m.efficiency_pct >= 60 ? Colors.warning : Colors.error }]}>
        {m.efficiency_pct}%
      </Text>
    </View>
  );
}

function DriverRow({ d, rank }: { d: ExecTopDriver; rank: number }) {
  return (
    <View style={s.tableRow}>
      <Text style={s.rankCell}>#{rank}</Text>
      <Text style={[s.nameCell, { flex: 1 }]} numberOfLines={1}>{d.driver_name}</Text>
      <Text style={s.numCell}>{d.deliveries}</Text>
      <Text style={[s.numCell, { color: Colors.success }]}>{d.qty_accepted}</Text>
      <Text style={[s.numCell, { color: Colors.error }]}>{d.qty_rejected}</Text>
    </View>
  );
}

function CompartmentRow({ c, rank }: { c: ExecTopCompartment; rank: number }) {
  return (
    <View style={s.tableRow}>
      <Text style={s.rankCell}>#{rank}</Text>
      <Text style={[s.nameCell, { flex: 1 }]} numberOfLines={1}>{c.compt_name}</Text>
      <Text style={s.numCell}>{c.trees_felled}</Text>
      <Text style={s.numCell}>{c.logs_produced}</Text>
    </View>
  );
}

function UserRow({ u }: { u: ExecActiveUser }) {
  return (
    <View style={s.tableRow}>
      <View style={{ flex: 1 }}>
        <Text style={s.nameCell} numberOfLines={1}>{u.full_name}</Text>
        <Text style={s.subCell}>{u.role}</Text>
      </View>
      <Text style={s.numCell}>{u.actions} actions</Text>
      <Text style={[s.numCell, { fontSize: 10 }]}>{u.last_active}</Text>
    </View>
  );
}

export function ExecutiveScreen() {
  const { data, isLoading, isError, refetch, isRefetching } = useExecutiveDashboard();

  if (isLoading) return <LoadingState message="Loading executive dashboard…" fullScreen />;
  if (isError || !data) return <ErrorState message="Could not load executive dashboard" onRetry={refetch} fullScreen />;

  const { kpi, salesTrend, fuelTrend, harvestTrend, workshopTrend, approvalTrend,
          topMachines, topDrivers, topCompartments, activeUsers, stock, governance } = data;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader title="Executive Dashboard" dark />

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
      >
        {/* 8 KPI cards in 2×4 grid */}
        <View style={s.kpiGrid}>
          <KpiCard label="Revenue Today"    value={`RWF ${kpi.revenueToday.toLocaleString()}`} />
          <KpiCard label="Revenue Month"    value={`RWF ${kpi.revenueMonth.toLocaleString()}`} />
          <KpiCard label="Revenue Year"     value={`RWF ${kpi.revenueYear.toLocaleString()}`} />
          <KpiCard label="Pending Approvals" value={String(kpi.pendingApprovals)} alert={kpi.pendingApprovals > 0} />
          <KpiCard label="Failed Jobs"      value={String(kpi.failedJobs)}        alert={kpi.failedJobs > 0} />
          <KpiCard label="Active Users"     value={String(kpi.activeUsersToday)} />
          <KpiCard label="Deliveries Pending" value={String(kpi.deliveriesPending)} alert={kpi.deliveriesPending > 0} />
          <KpiCard label="Dispatch Pending"   value={String(kpi.dispatchPending)}   alert={kpi.dispatchPending > 0} />
        </View>

        {/* Trend charts */}
        <Text style={s.sectionHeader}>Trends (last 30 days)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ gap: Spacing.sm }}>
            <TrendCard title="Sales revenue"   rows={salesTrend}    valueKey="amount" />
            <TrendCard title="Fuel consumed"   rows={fuelTrend}     valueKey="liters" />
            <TrendCard title="Harvest (trees)" rows={harvestTrend}  valueKey="trees" />
            <TrendCard title="Workshop output" rows={workshopTrend} valueKey="timber" />
            <TrendCard title="Approval time"   rows={approvalTrend} valueKey="avg_hours" />
          </View>
        </ScrollView>

        {/* Top Machines */}
        {topMachines.length > 0 && (
          <View style={s.tableCard}>
            <Text style={s.sectionTitle}>Top machines (30 days)</Text>
            <View style={[s.tableRow, s.tableHead]}>
              <Text style={s.rankCell}>#</Text>
              <Text style={[s.headCell, { flex: 1 }]}>Machine</Text>
              <Text style={[s.headCell, s.numCell]}>Hrs</Text>
              <Text style={[s.headCell, s.numCell]}>Prod</Text>
              <Text style={[s.headCell, s.numCell]}>Eff%</Text>
            </View>
            {topMachines.map((m, i) => <MachineRow key={i} m={m} rank={i + 1} />)}
          </View>
        )}

        {/* Top Drivers */}
        {topDrivers.length > 0 && (
          <View style={s.tableCard}>
            <Text style={s.sectionTitle}>Top drivers (30 days)</Text>
            <View style={[s.tableRow, s.tableHead]}>
              <Text style={s.rankCell}>#</Text>
              <Text style={[s.headCell, { flex: 1 }]}>Driver</Text>
              <Text style={[s.headCell, s.numCell]}>Trips</Text>
              <Text style={[s.headCell, s.numCell, { color: Colors.success }]}>Acc</Text>
              <Text style={[s.headCell, s.numCell, { color: Colors.error }]}>Rej</Text>
            </View>
            {topDrivers.map((d, i) => <DriverRow key={i} d={d} rank={i + 1} />)}
          </View>
        )}

        {/* Top Compartments */}
        {topCompartments.length > 0 && (
          <View style={s.tableCard}>
            <Text style={s.sectionTitle}>Top compartments by harvest</Text>
            <View style={[s.tableRow, s.tableHead]}>
              <Text style={s.rankCell}>#</Text>
              <Text style={[s.headCell, { flex: 1 }]}>Compartment</Text>
              <Text style={[s.headCell, s.numCell]}>Trees</Text>
              <Text style={[s.headCell, s.numCell]}>Logs</Text>
            </View>
            {topCompartments.map((c, i) => <CompartmentRow key={i} c={c} rank={i + 1} />)}
          </View>
        )}

        {/* Active Users */}
        {activeUsers.length > 0 && (
          <View style={s.tableCard}>
            <Text style={s.sectionTitle}>Most active users (7 days)</Text>
            {activeUsers.map((u, i) => <UserRow key={i} u={u} />)}
          </View>
        )}

        {/* Governance */}
        <View style={s.tableCard}>
          <Text style={s.sectionTitle}>Governance & security</Text>
          <View style={s.govGrid}>
            <View style={s.govCell}>
              <Text style={[s.govVal, { color: Colors.success }]}>{governance.slaCompliancePct}%</Text>
              <Text style={s.govLabel}>SLA compliance</Text>
            </View>
            <View style={s.govCell}>
              <Text style={[s.govVal, governance.escalationRatePct > 20 ? { color: Colors.warning } : {}]}>{governance.escalationRatePct}%</Text>
              <Text style={s.govLabel}>Escalation rate</Text>
            </View>
            <View style={s.govCell}>
              <Text style={[s.govVal, governance.privOverrides24h > 0 ? { color: Colors.error } : {}]}>{governance.privOverrides24h}</Text>
              <Text style={s.govLabel}>Priv overrides 24h</Text>
            </View>
            <View style={s.govCell}>
              <Text style={[s.govVal, governance.failedLogins24h >= 3 ? { color: Colors.error } : {}]}>{governance.failedLogins24h}</Text>
              <Text style={s.govLabel}>Failed logins 24h</Text>
            </View>
          </View>
        </View>

        {/* Stock summary */}
        <View style={s.tableCard}>
          <Text style={s.sectionTitle}>Stock summary</Text>
          <View style={s.govGrid}>
            <View style={s.govCell}>
              <Text style={s.govVal}>{stock.movements30d}</Text>
              <Text style={s.govLabel}>Movements 30d</Text>
            </View>
            <View style={s.govCell}>
              <Text style={[s.govVal, stock.lowStockItems > 0 ? { color: Colors.error } : {}]}>{stock.lowStockItems}</Text>
              <Text style={s.govLabel}>Low stock items</Text>
            </View>
            <View style={s.govCell}>
              <Text style={[s.govVal, stock.pendingTransfers > 0 ? { color: Colors.warning } : {}]}>{stock.pendingTransfers}</Text>
              <Text style={s.govLabel}>Pending transfers</Text>
            </View>
            <View style={s.govCell}>
              <Text style={[s.govVal, stock.pendingMaterialReq > 0 ? { color: Colors.warning } : {}]}>{stock.pendingMaterialReq}</Text>
              <Text style={s.govLabel}>Material requests</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: Colors.bg },
  scroll:       { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },

  kpiGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  kpiCard:      { flex: 1, minWidth: '45%', backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.sm, alignItems: 'center', gap: 2, ...Shadow.sm },
  kpiValue:     { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.textPrimary, textAlign: 'center' },
  kpiLabel:     { fontSize: 10, color: Colors.textMuted, textAlign: 'center' },

  sectionHeader:{ fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textMuted, marginTop: Spacing.xs },

  trendCard:    { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.sm, ...Shadow.sm, width: CHART_W + 2 * Spacing.sm },
  trendHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  trendTitle:   { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary },
  trendDelta:   { fontSize: Typography.xs, fontWeight: Typography.medium },

  tableCard:    { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: 0, ...Shadow.sm },
  sectionTitle: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textMuted, marginBottom: Spacing.xs },
  tableHead:    { borderBottomWidth: 1, borderBottomColor: Colors.border, paddingBottom: 4 },
  tableRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border + '44' },
  rankCell:     { width: 24, fontSize: Typography.xs, color: Colors.textMuted, fontWeight: Typography.medium },
  headCell:     { fontSize: 10, fontWeight: Typography.semibold, color: Colors.textMuted, flex: 1 },
  nameCell:     { fontSize: Typography.xs, fontWeight: Typography.medium, color: Colors.textPrimary },
  subCell:      { fontSize: 10, color: Colors.textMuted },
  numCell:      { width: 56, textAlign: 'right' as const, fontSize: Typography.xs, color: Colors.textPrimary },

  govGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.xs },
  govCell:      { flex: 1, minWidth: '45%', alignItems: 'center', gap: 2 },
  govVal:       { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary },
  govLabel:     { fontSize: 10, color: Colors.textMuted, textAlign: 'center' },
});
