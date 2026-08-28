import React, { useMemo, useState } from 'react';
import {
  StyleSheet, View, Text, FlatList, RefreshControl,
  TouchableOpacity, ScrollView,
} from 'react-native';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { StatusBar }     from 'expo-status-bar';
import { Ionicons }      from '@expo/vector-icons';
import { LineChart }     from 'react-native-gifted-charts';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }    from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState }   from '../../components/ErrorState';
import { EmptyState }   from '../../components/EmptyState';
import { ListSearchBar } from '../../components/ListSearchBar';
import { useVehicleList, useFleetDashboard, useFleetIntelligence } from '../../hooks/useVehicles';
import { Vehicle, VehicleStatus, FleetTrendMonth, FleetIntelligenceListItem } from '../../types/api';
import { VehiclesStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<VehiclesStackParamList, 'VehiclesList'>;

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1_000;

// Fleet & Equipment Phase 2 parity fix — this screen previously routed
// search to the global search module only, same gap already fixed for
// Machines'/Logistics' list screens (ListSearchBar + status chips, copied
// verbatim from MachinesListScreen's own "Phase 2 Workshop parity fix").
type StatusFilter = '' | VehicleStatus;
const STATUS_CHIPS: { value: StatusFilter; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'Active', label: 'Active' },
  { value: 'In Maintenance', label: 'In Maintenance' },
  { value: 'Inactive', label: 'Inactive' },
];

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function dateColor(isoDate: string | null): string {
  if (!isoDate) return Colors.textMuted;
  const d = new Date(isoDate);
  const now = new Date();
  if (d < now)          return Colors.error;
  if (d.getTime() - now.getTime() < THIRTY_DAYS) return Colors.warning;
  return Colors.textSecondary;
}

function statusStyle(status: VehicleStatus) {
  switch (status) {
    case 'Active':         return { bg: Colors.successBg, text: Colors.success };
    case 'In Maintenance': return { bg: Colors.warningBg, text: Colors.warning };
    default:               return { bg: Colors.statusDraft, text: Colors.statusDraftText };
  }
}

function MetricsBanner({ metrics }: { metrics: { fleet: number; active: number; maintenance: number; fuelCost: number } }) {
  const items = [
    { label: 'Fleet',       value: metrics.fleet },
    { label: 'Active',      value: metrics.active },
    { label: 'Maintenance', value: metrics.maintenance },
    { label: 'Fuel (RWF)',  value: `${metrics.fuelCost.toLocaleString()}` },
  ];
  return (
    <View style={styles.metricsRow}>
      {items.map(({ label, value }) => (
        <View key={label} style={styles.metricCard}>
          <Text style={styles.metricValue}>{value}</Text>
          <Text style={styles.metricLabel}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

// Fleet & Equipment Phase 2 — condensed cross-entity slice of the executive
// dashboard (machines + open maintenance jobs), the "highest-signal subset"
// pattern already used for Inventory/Workshop's own mobile dashboards.
function FleetBanner({ kpi }: { kpi: { totalMachines: number; activeMachines: number; openMaintenanceJobs: number; utilizationPct: number } }) {
  const items = [
    { label: 'Machines',      value: kpi.totalMachines },
    { label: 'Active',        value: kpi.activeMachines },
    { label: 'Open Maint.',   value: kpi.openMaintenanceJobs, warn: kpi.openMaintenanceJobs > 0 },
    { label: 'Utilization',   value: `${kpi.utilizationPct}%` },
  ];
  return (
    <View style={styles.metricsRow}>
      {items.map(({ label, value, warn }) => (
        <View key={label} style={styles.metricCard}>
          <Text style={[styles.metricValue, warn && { color: Colors.warning }]}>{value}</Text>
          <Text style={styles.metricLabel}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

// Fleet & Equipment Phase 3 — compact KPI tile, same pattern as Inventory's MiniKpi.
function MiniKpi({ label, value, warn }: { label: string; value: string | number; warn?: boolean }) {
  return (
    <View style={styles.miniKpi}>
      <Text style={[styles.miniKpiValue, warn ? { color: Colors.warning } : null]}>{value}</Text>
      <Text style={styles.miniKpiLabel}>{label}</Text>
    </View>
  );
}

// Fleet & Equipment Phase 3 — 6-month trend chart, same inline `LineChart`
// (react-native-gifted-charts, already a dependency) pattern already used by
// the Inventory/Workshop dashboards' own TrendChart — no new chart component.
function TrendChart({ title, points, valueKey, color, suffix }: {
  title: string; points: FleetTrendMonth[]; valueKey: 'count' | 'liters' | 'cost'; color: string; suffix?: string;
}) {
  const vals = points.map(p => ({ value: Number(p[valueKey] ?? 0) }));
  const latest = points.length ? points[points.length - 1] : null;
  return (
    <View style={styles.widgetCard}>
      <Text style={styles.widgetTitle}>{title}</Text>
      {latest ? <Text style={styles.miniKpiValue}>{Math.round(Number(latest[valueKey] ?? 0)).toLocaleString()}{suffix ?? ''}</Text> : null}
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

// Fleet & Equipment Phase 3 — condensed "what needs attention" list widget,
// same pattern as Inventory's OpsWidget.
function OpsWidget({ title, items, labelKey, subText, badge, warn, emptyMsg }: {
  title: string;
  items: FleetIntelligenceListItem[];
  labelKey: string;
  subText?: (it: FleetIntelligenceListItem) => string;
  badge?: (it: FleetIntelligenceListItem) => string;
  warn?: boolean;
  emptyMsg: string;
}) {
  const shown = items.slice(0, 5);
  return (
    <View style={styles.widgetCard}>
      <Text style={styles.widgetTitle}>{title} <Text style={styles.widgetCount}>({items.length})</Text></Text>
      {shown.length === 0 ? (
        <Text style={styles.emptyText}>{emptyMsg}</Text>
      ) : shown.map((it, i) => (
        <View key={i} style={styles.widgetRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.widgetLabel} numberOfLines={1}>{String(it[labelKey] ?? '')}</Text>
            {subText ? <Text style={styles.widgetSub} numberOfLines={1}>{subText(it)}</Text> : null}
          </View>
          {badge ? (
            <Text style={[styles.widgetBadge, warn && { color: Colors.error, fontWeight: Typography.semibold }]}>
              {badge(it)}
            </Text>
          ) : null}
        </View>
      ))}
      {items.length > 5 ? <Text style={styles.widgetMore}>+{items.length - 5} more</Text> : null}
    </View>
  );
}

function VehicleCard({ vehicle, onPress }: { vehicle: Vehicle; onPress: () => void }) {
  const st = statusStyle(vehicle.status);
  const insColor = dateColor(vehicle.insurance_expiry);
  const makeModel = [vehicle.make, vehicle.model].filter(Boolean).join(' ') || null;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardTop}>
        <Text style={styles.cardReg}>{vehicle.registration}</Text>
        <View style={[styles.badge, { backgroundColor: st.bg }]}>
          <Text style={[styles.badgeText, { color: st.text }]}>{vehicle.status}</Text>
        </View>
      </View>

      <View style={styles.cardMeta}>
        {vehicle.vehicle_category ? (
          <View style={styles.metaItem}>
            <Ionicons name="car-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.metaText}>{vehicle.vehicle_category}</Text>
          </View>
        ) : null}
        {makeModel ? (
          <View style={styles.metaItem}>
            <Ionicons name="construct-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.metaText}>{makeModel}</Text>
          </View>
        ) : null}
        <View style={styles.metaItem}>
          <Ionicons name="shield-outline" size={12} color={insColor} />
          <Text style={[styles.metaText, { color: insColor }]}>
            {vehicle.insurance_expiry
              ? new Date(vehicle.insurance_expiry).toLocaleDateString('en-GB')
              : 'No insurance date'}
          </Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View style={[styles.ownerBadge, vehicle.ownership_type === 'Third-Party Car' ? styles.ownerBadgeThird : styles.ownerBadgeCompany]}>
          <Text style={styles.ownerBadgeText}>
            {vehicle.ownership_type === 'Third-Party Car' ? 'Third-Party' : 'Company'}
          </Text>
        </View>
        <Text style={styles.fuelCost}>
          <Ionicons name="flame-outline" size={11} color={Colors.textMuted} />
          {' '}RWF {Math.round(vehicle.total_fuel_cost).toLocaleString()}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export function VehiclesListScreen() {
  const navigation = useNavigation<NavProp>();
  const { data, isLoading, isError, refetch, isRefetching } = useVehicleList();
  const { data: dashData } = useFleetDashboard();
  const { data: intelData } = useFleetIntelligence();

  const allRows = data?.rows ?? [];
  const metrics = data?.metrics ?? { fleet: 0, active: 0, maintenance: 0, fuelCost: 0, expiredInsurance: 0 };
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const isFiltered = !!search.trim() || !!statusFilter;
  const rows = useMemo(() => {
    let out = allRows;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter((v) =>
        v.registration.toLowerCase().includes(q) ||
        (v.make ?? '').toLowerCase().includes(q) ||
        (v.model ?? '').toLowerCase().includes(q) ||
        (v.vehicle_category ?? '').toLowerCase().includes(q) ||
        (v.driver_assigned ?? '').toLowerCase().includes(q) ||
        (v.driver_name ?? '').toLowerCase().includes(q));
    }
    if (statusFilter) out = out.filter((v) => v.status === statusFilter);
    return out;
  }, [allRows, search, statusFilter]);

  if (isLoading) return <LoadingState message="Loading fleet…" fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader
        title="Vehicle Fleet"
        searchModule="vehicles"
        dark
        actions={[{
          icon: 'add',
          onPress: () => navigation.navigate('VehicleForm', { vehicle: undefined }),
        }]}
      />

      {isError ? (
        <ErrorState message="Could not load fleet" onRetry={refetch} fullScreen />
      ) : (
        <>
          <ListSearchBar value={search} onChangeText={setSearch} placeholder="Search plate, make, model, category, driver…" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {STATUS_CHIPS.map((c) => (
              <FilterChip key={c.value || 'all'} label={c.label} active={statusFilter === c.value} onPress={() => setStatusFilter(c.value)} />
            ))}
            {isFiltered ? <FilterChip label="Clear" active={false} onPress={() => { setSearch(''); setStatusFilter(''); }} /> : null}
          </ScrollView>
          <FlatList
            data={rows}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={rows.length === 0 ? styles.emptyContainer : styles.list}
            refreshControl={
              <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />
            }
            ListHeaderComponent={
              !isFiltered ? (
                <View>
                  <MetricsBanner metrics={metrics} />
                  {dashData?.ok ? <FleetBanner kpi={dashData.kpi} /> : null}
                  {metrics.expiredInsurance > 0 && (
                    <View style={styles.alertBanner}>
                      <Ionicons name="warning-outline" size={16} color={Colors.error} />
                      <Text style={styles.alertText}>
                        <Text style={styles.alertBold}>{metrics.expiredInsurance} vehicle{metrics.expiredInsurance > 1 ? 's' : ''}</Text>
                        {' '}with expired insurance — update before dispatching.
                      </Text>
                    </View>
                  )}
                  {intelData?.ok ? (
                    <>
                      <Text style={styles.sectionTitle}>Operational Intelligence</Text>
                      <TrendChart title="Maintenance Events (6 mo)" points={intelData.trends.maintenanceMonths} valueKey="count" color={Colors.warning} />
                      <TrendChart title="Fuel Usage (6 mo)" points={intelData.trends.fuelMonths} valueKey="liters" color={Colors.navy} suffix="L" />
                      <View style={styles.kpiGrid}>
                        <MiniKpi label="Completed" value={intelData.maintenance.completedThisMonth} />
                        <MiniKpi label="Upcoming" value={intelData.maintenance.upcoming.length} warn={intelData.maintenance.upcoming.length > 0} />
                        <MiniKpi label="Overdue" value={intelData.maintenance.overdue.length} warn={intelData.maintenance.overdue.length > 0} />
                        <MiniKpi label="Op. cost (RWF)" value={Math.round(intelData.costSummary.totalOperatingCostThisMonth).toLocaleString()} />
                      </View>
                      <OpsWidget
                        title="Highest Fuel Consumers"
                        items={intelData.fuel.topConsumers}
                        labelKey="registration"
                        subText={(it) => `RWF ${Math.round(Number(it.cost ?? 0)).toLocaleString()} · 90d`}
                        badge={(it) => `${Math.round(Number(it.liters ?? 0))}L`}
                        emptyMsg="No fuel activity in the last 90 days."
                      />
                      <OpsWidget
                        title="Assets Requiring Attention"
                        items={intelData.vehicleIntelligence.attentionRequired}
                        labelKey="registration"
                        subText={(it) => String(it.reason ?? '')}
                        warn
                        emptyMsg="Nothing requires management attention right now."
                      />
                      <OpsWidget
                        title="Top Dispatched Vehicles"
                        items={intelData.crossDepartment.topDispatchedVehicles}
                        labelKey="registration"
                        subText={(it) => `${it.deliveries} deliveries · 90d`}
                        badge={(it) => String(it.qty ?? 0)}
                        emptyMsg="No dispatch activity in the last 90 days."
                      />
                    </>
                  ) : null}
                </View>
              ) : null
            }
            ListEmptyComponent={
              <EmptyState
                icon="car-outline"
                title={isFiltered ? 'No matching vehicles' : 'No vehicles'}
                subtitle={isFiltered ? 'Try a different search or filter.' : 'Tap + to register the first vehicle in the fleet.'}
              />
            }
            renderItem={({ item }) => (
              <VehicleCard
                vehicle={item}
                onPress={() => navigation.navigate('VehicleDetail', { vehicleId: Number(item.id) })}
              />
            )}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: Colors.bg },
  list:           { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },
  emptyContainer: { flex: 1, justifyContent: 'center' },

  chipRow:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm },
  chip:         { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.full, paddingVertical: 6, paddingHorizontal: Spacing.md, backgroundColor: Colors.card },
  chipActive:   { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipText:     { fontSize: Typography.xs, color: Colors.textPrimary, fontWeight: Typography.medium },
  chipTextActive: { color: Colors.white },

  metricsRow: { flexDirection: 'row', gap: Spacing.xs, marginBottom: Spacing.sm },
  metricCard: {
    flex: 1, backgroundColor: Colors.card, borderRadius: Radius.md,
    padding: Spacing.sm, alignItems: 'center', ...Shadow.sm,
  },
  metricValue: { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.navy },
  metricLabel: { fontSize: 10, color: Colors.textMuted, textAlign: 'center', marginTop: 2 },

  alertBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs,
    padding: Spacing.sm, backgroundColor: Colors.errorBg,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.error,
    marginBottom: Spacing.sm,
  },
  alertText: { flex: 1, fontSize: Typography.sm, color: Colors.error, lineHeight: 18 },
  alertBold: { fontWeight: Typography.bold },

  card: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, gap: Spacing.xs, ...Shadow.sm,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardReg: {
    fontSize: Typography.lg, fontWeight: Typography.bold,
    color: Colors.textPrimary, fontFamily: 'monospace',
  },
  badge:     { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: Typography.semibold },

  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: Typography.xs, color: Colors.textMuted },

  cardFooter:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  ownerBadge:       { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  ownerBadgeCompany:{ backgroundColor: Colors.navyBg },
  ownerBadgeThird:  { backgroundColor: Colors.infoBg },
  ownerBadgeText:   { fontSize: 10, color: Colors.textSecondary, fontWeight: Typography.semibold },
  fuelCost:         { fontSize: Typography.xs, color: Colors.textMuted },

  // Fleet & Equipment Phase 3 — Operational Intelligence section styles,
  // copied verbatim from StockLevelsScreen's own Phase 3 widget styles.
  sectionTitle: {
    fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: Spacing.xs, marginTop: Spacing.sm,
  },
  kpiGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.sm,
  },
  miniKpi: {
    backgroundColor: Colors.card, borderRadius: Radius.md, padding: Spacing.sm,
    minWidth: '30%', flexGrow: 1, alignItems: 'center', ...Shadow.sm,
  },
  miniKpiValue: { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.textPrimary },
  miniKpiLabel: { fontSize: 10, color: Colors.textMuted, textAlign: 'center', marginTop: 2 },

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
