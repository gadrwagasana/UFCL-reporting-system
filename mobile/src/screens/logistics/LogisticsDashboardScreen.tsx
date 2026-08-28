import React from 'react';
import {
  StyleSheet, View, Text, ScrollView, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { AppHeader }    from '../../components/AppHeader';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState }   from '../../components/ErrorState';
import { OfflineBanner } from '../../components/OfflineBanner';
import { KpiCard }      from '../../components/KpiCard';
import { RecentRow }    from '../../components/RecentRow';
import { EmptyState }   from '../../components/EmptyState';
import { get }          from '../../api/client';
import { EP }           from '../../api/endpoints';
import { useAuthStore } from '../../stores/authStore';
import { LogisticsDashboard } from '../../types/dashboard';
import { Colors, Spacing, TextStyles, Typography, Radius, Shadow } from '../../theme';
import { formatNumber } from '../../utils/formatters';

// Phase 3 — compact 2-column KPI tile, mirrors the desktop Executive KPI
// strip's `.mc` card but sized for a mobile grid rather than one full-width
// KpiCard per metric (which would make a 14-tile strip an unreasonably long
// scroll on a phone).
function MiniKpi({ label, value, warn }: { label: string; value: string | number; warn?: boolean }) {
  return (
    <View style={styles.miniKpi}>
      <Text style={[styles.miniKpiValue, warn ? { color: Colors.warning } : null]}>{value}</Text>
      <Text style={styles.miniKpiLabel}>{label}</Text>
    </View>
  );
}

// Phase 3 — small "what needs attention" list widget, mirrors the desktop
// dashboard's _lgdWidget helper.
function Widget({ title, items, emptyMsg }: { title: string; items: { label: string; sub?: string; badge?: string; warn?: boolean }[]; emptyMsg: string }) {
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
          {it.badge ? <Text style={[styles.widgetBadge, it.warn ? styles.widgetBadgeWarn : null]}>{it.badge}</Text> : null}
        </View>
      ))}
      {items.length > 5 ? <Text style={styles.widgetMore}>+{items.length - 5} more</Text> : null}
    </View>
  );
}

export function LogisticsDashboardScreen() {
  const user = useAuthStore((s) => s.user);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery<LogisticsDashboard>({
    queryKey: ['logistics-dashboard'],
    queryFn:  () => get<LogisticsDashboard>(EP.LOGISTICS_DASHBOARD),
    staleTime: 30_000,
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Warehouse Overview" subtitle={user?.name ?? ''} />

      {isLoading ? (
        <LoadingState message="Loading warehouse data…" fullScreen />
      ) : isError || !data ? (
        <ErrorState message="Could not load warehouse data" onRetry={refetch} fullScreen />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Phase 3 — Executive KPIs */}
          <Text style={styles.sectionTitle}>Executive KPIs</Text>
          <View style={styles.kpiGrid}>
            <MiniKpi label="Deliveries today" value={data.deliveriesToday} />
            <MiniKpi label="Deliveries this week" value={data.deliveriesThisWeek} />
            <MiniKpi label="Pending dispatches" value={data.dispatchStatusCounts.find((r) => r.status === 'Pending')?.cnt ?? 0} warn={(data.dispatchStatusCounts.find((r) => r.status === 'Pending')?.cnt ?? 0) > 0} />
            <MiniKpi label="Completed dispatches" value={data.dispatchStatusCounts.find((r) => r.status === 'Dispatched')?.cnt ?? 0} />
            <MiniKpi label="Delayed deliveries" value={data.delayedDeliveriesCount} warn={data.delayedDeliveriesCount > 0} />
            <MiniKpi label="Transport jobs" value={data.transportJobStatusCounts.reduce((s, r) => s + Number(r.cnt || 0), 0)} />
            <MiniKpi label="Fleet utilization" value={`${data.fleetUtilizationPct}%`} />
            <MiniKpi label="Vehicle availability" value={data.vehicleAvailability} />
            <MiniKpi label="Under maintenance" value={data.fleetStatusCounts.find((r) => r.status === 'In Maintenance')?.cnt ?? 0} warn={(data.fleetStatusCounts.find((r) => r.status === 'In Maintenance')?.cnt ?? 0) > 0} />
            <MiniKpi label="Active drivers" value={data.activeDriversCount} />
            <MiniKpi label="Inventory alerts" value={data.lowStock.length} warn={data.lowStock.length > 0} />
            <MiniKpi label="Workshop alerts" value={data.workshopAlertsCount} warn={data.workshopAlertsCount > 0} />
            <MiniKpi label="Pending approvals" value={data.pendingActions.dispatchApprovals + data.pendingActions.editRequests} warn={(data.pendingActions.dispatchApprovals + data.pendingActions.editRequests) > 0} />
          </View>

          {/* Phase 3 — Operational Widgets */}
          <Text style={styles.sectionTitle}>Operational Widgets</Text>
          <Widget
            title="Today's Schedule"
            items={[
              ...data.todaysDeliveries.map((d) => ({ label: d.order_number, sub: d.driver_name ?? '—', badge: d.status })),
              ...data.todaysTransportJobs.map((j) => ({ label: j.job_number, sub: j.carrier_type, badge: j.status })),
            ]}
            emptyMsg="Nothing scheduled for today."
          />
          <Widget
            title="Active Deliveries"
            items={data.activeDeliveries.map((d) => ({ label: d.order_number, sub: d.driver_name ?? '—', badge: d.status }))}
            emptyMsg="No deliveries in progress."
          />
          <Widget
            title="Vehicles on Route"
            items={data.vehiclesOnRoute.map((v) => ({ label: v.registration, sub: v.driver_name ?? '—', badge: v.order_number }))}
            emptyMsg="No vehicles currently on route."
          />
          <Widget
            title="Vehicles Waiting"
            items={data.vehiclesWaiting.map((v) => ({ label: v.registration, sub: v.driver_name ?? 'Unassigned', badge: 'Available' }))}
            emptyMsg="No vehicles currently available."
          />
          <Widget
            title="Delayed Jobs"
            items={[
              ...data.delayedDeliveries.map((d) => ({ label: d.order_number, sub: `Due ${d.delivery_date ?? '—'}`, badge: d.status, warn: true })),
              ...data.delayedTransportJobs.map((j) => ({ label: j.job_number, sub: `Due ${j.job_date ?? '—'}`, badge: j.status, warn: true })),
            ]}
            emptyMsg="Nothing overdue."
          />
          <Widget
            title="Priority Deliveries"
            items={data.priorityDeliveries.map((d) => ({ label: d.order_number, sub: d.driver_name ?? '—', badge: d.is_delayed ? 'Overdue' : 'Due today', warn: d.is_delayed }))}
            emptyMsg="No urgent deliveries."
          />
          <Widget
            title="Workshop Notifications"
            items={data.workshopAlerts.map((m) => ({ label: m.vehicle_registration, sub: m.maintenance_type, badge: m.next_due_date, warn: true }))}
            emptyMsg="No maintenance due soon."
          />

          {/* Phase 2 — Pending Actions banner */}
          {(data.pendingActions.dispatchApprovals + data.pendingActions.editRequests) > 0 && (
            <View style={styles.pendingBanner}>
              <Ionicons name="time-outline" size={18} color={Colors.warning} />
              <Text style={styles.pendingBannerText}>
                {data.pendingActions.dispatchApprovals + data.pendingActions.editRequests} pending action
                {(data.pendingActions.dispatchApprovals + data.pendingActions.editRequests) > 1 ? 's' : ''}
                {data.pendingActions.dispatchApprovals ? ` · ${data.pendingActions.dispatchApprovals} dispatch approval${data.pendingActions.dispatchApprovals > 1 ? 's' : ''}` : ''}
                {data.pendingActions.editRequests ? ` · ${data.pendingActions.editRequests} edit/delete request${data.pendingActions.editRequests > 1 ? 's' : ''}` : ''}
              </Text>
            </View>
          )}

          {/* Phase 2 — Operational overview: Delivery / Dispatch / Transport Jobs / Fleet / Fuel */}
          <Text style={styles.sectionTitle}>Delivery Status</Text>
          <View style={styles.listCard}>
            {['Pending', 'Assigned', 'In Transit', 'POD Recorded', 'Failed'].map((s) => (
              <View key={s} style={styles.statRow}>
                <Text style={styles.statLabel}>{s}</Text>
                <Text style={styles.statValue}>{data.deliveryStatusCounts.find((r) => r.status === s)?.cnt ?? 0}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Dispatch Summary</Text>
          <View style={styles.listCard}>
            {['Pending', 'Approved', 'Dispatched', 'Rejected'].map((s) => (
              <View key={s} style={styles.statRow}>
                <Text style={styles.statLabel}>{s}</Text>
                <Text style={[styles.statValue, s === 'Pending' && (data.dispatchStatusCounts.find((r) => r.status === s)?.cnt ?? 0) > 0 ? { color: Colors.warning } : null]}>
                  {data.dispatchStatusCounts.find((r) => r.status === s)?.cnt ?? 0}
                </Text>
              </View>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Transport Jobs</Text>
          <View style={styles.listCard}>
            {['Scheduled', 'In Transit', 'Completed', 'Cancelled'].map((s) => (
              <View key={s} style={styles.statRow}>
                <Text style={styles.statLabel}>{s}</Text>
                <Text style={styles.statValue}>{data.transportJobStatusCounts.find((r) => r.status === s)?.cnt ?? 0}</Text>
              </View>
            ))}
            <View style={[styles.statRow, styles.statRowTotal]}>
              <Text style={styles.statLabel}>Total spend (RWF)</Text>
              <Text style={styles.statValue}>{formatNumber(data.transportJobStatusCounts.reduce((s, r) => s + Number(r.total_cost || 0), 0))}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Fleet Status</Text>
          <View style={styles.listCard}>
            {['Active', 'In Maintenance', 'Inactive'].map((s) => (
              <View key={s} style={styles.statRow}>
                <Text style={styles.statLabel}>{s}</Text>
                <Text style={styles.statValue}>{data.fleetStatusCounts.find((r) => r.status === s)?.cnt ?? 0}</Text>
              </View>
            ))}
            <View style={[styles.statRow, styles.statRowTotal]}>
              <Text style={styles.statLabel}>Currently on a delivery</Text>
              <Text style={styles.statValue}>{data.vehiclesInUse}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Fuel Overview (this month)</Text>
          <View style={styles.listCard}>
            <View style={styles.statRow}><Text style={styles.statLabel}>Logs recorded</Text><Text style={styles.statValue}>{data.fuelThisMonth.log_count}</Text></View>
            <View style={styles.statRow}><Text style={styles.statLabel}>Total liters</Text><Text style={styles.statValue}>{formatNumber(data.fuelThisMonth.total_liters)}</Text></View>
            <View style={styles.statRow}><Text style={styles.statLabel}>Total cost (RWF)</Text><Text style={styles.statValue}>{formatNumber(data.fuelThisMonth.total_cost)}</Text></View>
          </View>

          {/* Workshops */}
          <Text style={styles.sectionTitle}>Workshops</Text>
          {data.workshops.length === 0 ? (
            <EmptyState icon="business-outline" title="No workshops found" subtitle="Workshops will appear here once registered." />
          ) : (
            data.workshops.map((w) => (
              <KpiCard
                key={w.id}
                title={w.name}
                value={formatNumber(w.item_count)}
                icon="business-outline"
                color={Colors.navy}
                subtitle={`${w.location} · ${formatNumber(w.total_qty)} units`}
              />
            ))
          )}

          {/* Low stock alerts */}
          {data.lowStock.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Low Stock</Text>
              <View style={styles.listCard}>
                {data.lowStock.map((s, i) => (
                  <View key={`${s.name}-${i}`} style={styles.lowStockRow}>
                    <Ionicons name="alert-circle-outline" size={18} color={Colors.warning} />
                    <View style={styles.lowStockContent}>
                      <Text style={styles.lowStockName}>{s.name}</Text>
                      <Text style={styles.lowStockSub}>
                        {s.warehouse_name} · {formatNumber(s.total_stock)} / {formatNumber(s.min_stock)} {s.uom}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Month totals */}
          {data.monthTotals.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>This Month</Text>
              {data.monthTotals.map((t) => (
                <KpiCard
                  key={t.movement_type}
                  title={t.movement_type === 'in' ? 'Stock In' : 'Stock Out'}
                  value={formatNumber(t.count)}
                  icon={t.movement_type === 'in' ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'}
                  color={t.movement_type === 'in' ? Colors.green : Colors.orange}
                  subtitle={`${formatNumber(t.total_qty)} units`}
                />
              ))}
            </>
          )}

          {/* Recent movements */}
          {data.activity.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Recent Movements</Text>
              <View style={styles.listCard}>
                {data.activity.map((row) => (
                  <RecentRow
                    key={row.id}
                    id={row.id}
                    left={row.item_name}
                    sub={`${row.workshop_name} · ${row.user_name}`}
                    right={`${row.type === 'stock_movement_in' ? '+' : '-'}${formatNumber(row.quantity)}`}
                    iconType={row.type}
                  />
                ))}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.base, paddingBottom: Spacing.xxxl },

  sectionTitle: {
    ...TextStyles.label,
    color: Colors.textMuted,
    marginTop: Spacing.base,
    marginBottom: Spacing.sm,
  },

  emptyText: {
    ...TextStyles.body,
    color: Colors.textMuted,
  },

  listCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.md, ...Shadow.sm, marginBottom: Spacing.sm,
  },

  kpiGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.sm,
  },
  miniKpi: {
    flexBasis: '31%', flexGrow: 1,
    backgroundColor: Colors.card, borderRadius: Radius.md,
    padding: Spacing.sm, ...Shadow.sm,
  },
  miniKpiValue: {
    fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary,
  },
  miniKpiLabel: {
    ...TextStyles.caption, color: Colors.textMuted, marginTop: 2,
  },

  widgetCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.md, ...Shadow.sm, marginBottom: Spacing.sm,
  },
  widgetTitle: {
    ...TextStyles.body, fontWeight: Typography.semibold, color: Colors.textPrimary, marginBottom: Spacing.xs,
  },
  widgetCount: {
    color: Colors.textMuted, fontWeight: Typography.regular,
  },
  widgetRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: Colors.divider, gap: Spacing.sm,
  },
  widgetLabel: {
    ...TextStyles.caption, fontWeight: Typography.medium, color: Colors.textPrimary,
  },
  widgetSub: {
    fontSize: 11, color: Colors.textMuted,
  },
  widgetBadge: {
    fontSize: 11, color: Colors.textMuted, backgroundColor: Colors.bg,
    borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 2, flexShrink: 0,
  },
  widgetBadgeWarn: {
    color: Colors.error, backgroundColor: Colors.errorBg,
  },
  widgetMore: {
    fontSize: 11, color: Colors.textMuted, marginTop: 4,
  },

  lowStockRow: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  lowStockContent: {
    flex: 1,
  },
  lowStockName: {
    ...TextStyles.body,
    color: Colors.textPrimary,
  },
  lowStockSub: {
    ...TextStyles.caption,
    color:     Colors.textMuted,
    marginTop: 1,
  },

  pendingBanner: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             Spacing.sm,
    backgroundColor: Colors.warningBg,
    borderRadius:    Radius.lg,
    padding:         Spacing.md,
    marginBottom:    Spacing.sm,
  },
  pendingBannerText: {
    ...TextStyles.caption,
    color: Colors.warning,
    flex:  1,
  },

  statRow: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    paddingVertical: 4,
  },
  statRowTotal: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop:      4,
    paddingTop:     8,
  },
  statLabel: {
    ...TextStyles.caption,
    color: Colors.textMuted,
  },
  statValue: {
    ...TextStyles.body,
    fontWeight: '600',
    color:      Colors.textPrimary,
  },
});
