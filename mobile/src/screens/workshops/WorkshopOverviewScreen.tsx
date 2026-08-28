import React, { useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, RefreshControl, Alert, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar }    from 'expo-status-bar';
import { Ionicons }     from '@expo/vector-icons';
import { LineChart }    from 'react-native-gifted-charts';
import { useOfflineStore } from '../../stores/offlineStore';
import { useAuthStore }    from '../../stores/authStore';
import { AppHeader }       from '../../components/AppHeader';
import { LoadingState }    from '../../components/LoadingState';
import { ErrorState }      from '../../components/ErrorState';
import { EmptyState }      from '../../components/EmptyState';
import { FormSelect }      from '../../components/FormSelect';
import { ReasonModal }     from '../../components/ReasonModal';
import { MRApproveModal }  from '../../components/MRApproveModal';
import {
  useWorkshopOverview,
  useMaterialRequestApproveFromOverview,
} from '../../hooks/useWorkshops';
// Phase 1 (Inventory consolidation) — pending transfers now come from
// stock_transfers (the dedicated request→approve→dispatch→receive
// lifecycle), not the retired stock_movements shortcut, so approval here
// uses the same mutation the Stock Transfers screens already use.
import { useStockTransferApprove } from '../../hooks/useStockTransfers';
import { hasPermission } from '../../utils/permissions';
import type { OverviewWorkshopCard, PendingTransfer, PendingMaterialRequest, LowStockItem, WorkshopCostTrendMonth, WorkshopMaintenanceTrendMonth } from '../../types/api';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

// Phase 2 — compact 2/3-column KPI tile, same pattern as the Logistics
// Dashboard's MiniKpi (mirrors the desktop Executive KPI strip's `.mc` card).
function MiniKpi({ label, value, warn }: { label: string; value: string | number; warn?: boolean }) {
  return (
    <View style={styles.miniKpi}>
      <Text style={[styles.miniKpiValue, warn ? { color: Colors.warning } : null]}>{value}</Text>
      <Text style={styles.miniKpiLabel}>{label}</Text>
    </View>
  );
}

// Phase 2 — "what needs attention" list widget, same pattern as the
// Logistics Dashboard's Widget component.
function OpsWidget({ title, items, emptyMsg }: { title: string; items: { label: string; sub?: string; badge?: string; warn?: boolean }[]; emptyMsg: string }) {
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

// Phase 3 — 6-month trend chart, following the same inline `LineChart`
// (react-native-gifted-charts, already a dependency) pattern already used
// by EpmTrendsScreen — no new chart component/library introduced.
function TrendChart({ title, points, color, suffix }: { title: string; points: { month: string; value: number }[]; color: string; suffix?: string }) {
  const vals = points.map(p => ({ value: p.value }));
  const latest = points.length ? points[points.length - 1] : null;
  return (
    <View style={styles.widgetCard}>
      <Text style={styles.widgetTitle}>{title}</Text>
      {latest ? <Text style={styles.miniKpiValue}>{latest.value.toLocaleString()}{suffix ?? ''}</Text> : null}
      {vals.some(v => v.value > 0) ? (
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

function MetricsBanner({ total, active, transfers, requests, lowStockCount }: {
  total: number; active: number; transfers: number; requests: number; lowStockCount: number;
}) {
  return (
    <View style={styles.banner}>
      {[
        { label: 'Workshops',  value: total },
        { label: 'Active',     value: active },
        { label: 'Transfers',  value: transfers },
        { label: 'Mat. Req.',  value: requests },
        { label: 'Low Stock',  value: lowStockCount },
      ].map(({ label, value }) => (
        <View key={label} style={styles.stat}>
          <Text style={styles.statValue}>{value}</Text>
          <Text style={styles.statLabel}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

function WorkshopCard({ item }: { item: OverviewWorkshopCard }) {
  return (
    <View style={[styles.card, !item.active && styles.cardInactive]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardName}>{item.name}</Text>
          {!item.active && <View style={styles.inactiveBadge}><Text style={styles.inactiveBadgeText}>Inactive</Text></View>}
        </View>
        {item.workshop_type ? <Text style={styles.cardType}>{item.workshop_type}</Text> : null}
        {item.location ? <Text style={styles.cardLocation}>{item.location}</Text> : null}
      </View>
      <View style={styles.cardStats}>
        <View style={styles.cardStat}>
          <Text style={styles.cardStatValue}>{item.item_count}</Text>
          <Text style={styles.cardStatLabel}>Items</Text>
        </View>
        <View style={styles.cardStat}>
          <Text style={styles.cardStatValue}>
            {Number(item.stock_value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </Text>
          <Text style={styles.cardStatLabel}>Stock Value</Text>
        </View>
        <View style={styles.cardStat}>
          <Text style={styles.cardStatValue}>{item.machine_count}</Text>
          <Text style={styles.cardStatLabel}>Machines</Text>
        </View>
        <View style={styles.cardStat}>
          <Text style={[styles.cardStatValue, { color: Colors.success }]}>{item.machines_available}</Text>
          <Text style={styles.cardStatLabel}>Available</Text>
        </View>
      </View>
    </View>
  );
}

function TransferRow({
  item,
  canApprove,
  onApprove,
  onReject,
}: {
  item: PendingTransfer;
  canApprove: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <View style={styles.pendingCard}>
      <View style={styles.pendingInfo}>
        <Text style={styles.pendingTitle}>{item.item_name}</Text>
        <Text style={styles.pendingMeta}>{item.quantity} {item.uom} · {item.from_workshop} → {item.to_workshop}</Text>
        <Text style={styles.pendingMeta}>{item.requested_by} · {item.created_at}</Text>
      </View>
      {canApprove && (
        <View style={styles.pendingActions}>
          <TouchableOpacity style={styles.approveBtn} onPress={onApprove} activeOpacity={0.8}>
            <Ionicons name="checkmark-outline" size={16} color={Colors.white} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.rejectBtn} onPress={onReject} activeOpacity={0.8}>
            <Ionicons name="close-outline" size={16} color={Colors.white} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function MRRow({
  item,
  canApprove,
  onApprove,
  onReject,
}: {
  item: PendingMaterialRequest;
  canApprove: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const priorityColor = item.priority === 'urgent' ? Colors.error : item.priority === 'high' ? Colors.warning : Colors.textSecondary;
  return (
    <View style={styles.pendingCard}>
      <View style={styles.pendingInfo}>
        <Text style={styles.pendingTitle}>{item.item_name}</Text>
        <Text style={styles.pendingMeta}>{item.requested_qty} {item.uom} · {item.workshop_name}</Text>
        <View style={styles.pendingMetaRow}>
          <Text style={[styles.priorityBadge, { color: priorityColor }]}>{item.priority.toUpperCase()}</Text>
          <Text style={styles.pendingMeta}> · {item.requested_by} · {item.requested_at}</Text>
        </View>
        {item.reason ? <Text style={styles.pendingReason}>{item.reason}</Text> : null}
      </View>
      {canApprove && (
        <View style={styles.pendingActions}>
          <TouchableOpacity style={styles.approveBtn} onPress={onApprove} activeOpacity={0.8}>
            <Ionicons name="checkmark-outline" size={16} color={Colors.white} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.rejectBtn} onPress={onReject} activeOpacity={0.8}>
            <Ionicons name="close-outline" size={16} color={Colors.white} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function LowStockRow({ item }: { item: LowStockItem }) {
  return (
    <View style={styles.lowStockCard}>
      <View style={{ flex: 1 }}>
        <Text style={styles.pendingTitle}>{item.name}</Text>
        <Text style={styles.pendingMeta}>{item.category} · {item.warehouse_name}</Text>
      </View>
      <View style={styles.stockBadge}>
        <Text style={styles.stockBadgeText}>{item.total_stock}/{item.min_stock} {item.uom}</Text>
      </View>
    </View>
  );
}

export function WorkshopOverviewScreen() {
  const { isOnline } = useOfflineStore();
  const role = useAuthStore(s => s.user?.role ?? 'storekeeper');
  const canApprove = hasPermission(role as any, 'workshop.approve');

  const { data, isLoading, isError, refetch, isRefetching } = useWorkshopOverview();
  const approveTransferMutation     = useStockTransferApprove();
  const { approveMaterialRequest } = useMaterialRequestApproveFromOverview();
  const [mrApproveTarget, setMrApproveTarget] = useState<PendingMaterialRequest | null>(null);
  const [mrApproveLoading, setMrApproveLoading] = useState(false);
  // Enterprise UI/UX Standardization Phase 3 — reject now goes through
  // ReasonModal (typed reason required, matching desktop's openRejectOverlay
  // and the reviewNotes field the reject mutation already accepts) instead
  // of a plain Alert.alert with no reason collection at all — previously the
  // same verb family (approve/reject) used two unrelated mechanisms on this
  // one screen, and reject silently dropped the reason desktop requires.
  const [mrRejectTarget, setMrRejectTarget] = useState<PendingMaterialRequest | null>(null);
  const [mrRejectLoading, setMrRejectLoading] = useState(false);

  function confirmTransfer(item: PendingTransfer, action: 'approve' | 'reject') {
    if (!isOnline) { Alert.alert('Online Required', 'Approvals require an active connection.'); return; }
    const verb = action === 'approve' ? 'Approve' : 'Reject';
    Alert.alert(
      `${verb} Transfer`,
      `${verb} transfer of ${item.quantity} ${item.uom} "${item.item_name}" from ${item.from_workshop} to ${item.to_workshop}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: verb, style: action === 'reject' ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await approveTransferMutation.mutateAsync({ id: item.id, action });
            } catch (err: any) {
              Alert.alert('Error', err?.message ?? 'Could not process transfer.');
            }
          },
        },
      ],
    );
  }

  function confirmMR(item: PendingMaterialRequest, action: 'approve' | 'reject') {
    if (!isOnline) { Alert.alert('Online Required', 'Approvals require an active connection.'); return; }
    if (action === 'approve') { setMrApproveTarget(item); return; }
    setMrRejectTarget(item);
  }

  async function handleMrReject(reason: string) {
    if (!mrRejectTarget) return;
    setMrRejectLoading(true);
    try {
      const res = await approveMaterialRequest({ requestId: mrRejectTarget.id, action: 'reject', reviewNotes: reason });
      if (!(res as any)?.ok) {
        Alert.alert('Error', (res as any)?.error ?? 'Could not process request.');
      } else {
        setMrRejectTarget(null);
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not process request.');
    } finally {
      setMrRejectLoading(false);
    }
  }

  async function handleMrApprove(qty: number, sourceWarehouseId: number, destinationWorkshopId: number | null, notes: string) {
    if (!mrApproveTarget) return;
    const requestId = mrApproveTarget.id;
    setMrApproveLoading(true);
    try {
      const res = await approveMaterialRequest({
        requestId, action: 'approve', approvedQty: qty, reviewNotes: notes || undefined,
        sourceWarehouseId, destinationWorkshopId: destinationWorkshopId ?? undefined,
      });
      if (!(res as any)?.ok) {
        Alert.alert('Error', (res as any)?.error ?? 'Could not approve request.');
      } else {
        setMrApproveTarget(null);
        Alert.alert('Approved', 'Request approved — a stock transfer was created and is ready for dispatch.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not process request.');
    } finally {
      setMrApproveLoading(false);
    }
  }

  if (isLoading) return <LoadingState message="Loading overview…" fullScreen />;
  if (isError)   return <ErrorState  message="Could not load workshop overview" onRetry={refetch} fullScreen />;

  const workshops  = data?.workshops         ?? [];
  const transfers  = data?.pendingTransfers  ?? [];
  const requests   = data?.pendingRequests   ?? [];
  const lowStock   = data?.lowStock          ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader title="Workshop Overview" dark />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
      >
        {/* Phase 2 — Executive KPIs */}
        <Text style={styles.sectionTitle}>Executive KPIs</Text>
        <View style={styles.kpiGrid}>
          <MiniKpi label="Machines" value={data?.totalMachines ?? 0} />
          <MiniKpi label="Machines available" value={data?.availableMachines ?? 0} />
          <MiniKpi label="Active maintenance" value={data?.activeMaintenanceCount ?? 0} warn={(data?.activeMaintenanceCount ?? 0) > 0} />
          <MiniKpi label="Scheduled (7d)" value={data?.scheduledMaintenanceCount ?? 0} />
          <MiniKpi label="Overdue maintenance" value={data?.overdueMaintenanceCount ?? 0} warn={(data?.overdueMaintenanceCount ?? 0) > 0} />
          <MiniKpi label="Maintenance this month" value={data?.maintenanceThisMonthCount ?? 0} />
          <MiniKpi label="Workshop utilization" value={`${data?.workshopUtilizationPct ?? 0}%`} />
          <MiniKpi label="Fuel this month (L)" value={(data?.fuelConsumedThisMonth ?? 0).toLocaleString()} />
          <MiniKpi label="Availability" value={`${data?.machineAvailabilityPct ?? 0}%`} />
          <MiniKpi label="Downtime (hrs)" value={(data?.downtimeHoursThisMonth ?? 0).toLocaleString()} warn={(data?.downtimeHoursThisMonth ?? 0) > 0} />
          <MiniKpi label="Material requests" value={requests.length} warn={requests.length > 0} />
          {data?.financeVisibility ? (
            <>
              <MiniKpi label="Workshop costs" value={(data.workshopCostsThisMonth ?? 0).toLocaleString()} />
              <MiniKpi label="Maintenance costs" value={data.financeVisibility.maintenanceCostThisMonth.toLocaleString()} />
            </>
          ) : null}
        </View>

        {/* Phase 2 — Operational Widgets */}
        <Text style={styles.sectionTitle}>Operational Widgets</Text>
        <OpsWidget
          title="Today's Maintenance"
          items={(data?.todaysMaintenance ?? []).map(s => ({ label: `${s.machine_code} — ${s.machine_name}`, sub: s.maintenance_type, badge: 'Today', warn: true }))}
          emptyMsg="Nothing scheduled for today."
        />
        <OpsWidget
          title="Upcoming Maintenance"
          items={(data?.upcomingMaintenance ?? []).map(s => ({ label: `${s.machine_code} — ${s.machine_name}`, sub: s.maintenance_type, badge: new Date(s.next_due).toLocaleDateString() }))}
          emptyMsg="Nothing due in the next 7 days."
        />
        <OpsWidget
          title="Overdue Jobs"
          items={(data?.overdueMaintenanceList ?? []).map(s => ({ label: `${s.machine_code} — ${s.machine_name}`, sub: s.maintenance_type, badge: new Date(s.next_due).toLocaleDateString(), warn: true }))}
          emptyMsg="Nothing overdue."
        />
        <OpsWidget
          title="Equipment Alerts"
          items={(data?.equipmentAlerts ?? []).map(m => ({ label: `${m.machine_code} — ${m.name}`, sub: m.status, badge: m.status, warn: true }))}
          emptyMsg="No equipment issues."
        />
        {data?.financeVisibility ? (
          <OpsWidget
            title="Fleet Alerts"
            items={(data?.fleetAlerts ?? []).map(v => ({ label: v.vehicle_registration, sub: v.maintenance_type, badge: v.next_due_date, warn: true }))}
            emptyMsg="No vehicle maintenance due soon."
          />
        ) : null}

        {/* Phase 3 — Operational Intelligence trends */}
        <Text style={styles.sectionTitle}>Trends</Text>
        <TrendChart
          title="Maintenance Trend (6 mo)"
          points={(data?.maintenanceTrendMonths ?? []).map((m: WorkshopMaintenanceTrendMonth) => ({ month: m.month, value: m.cnt }))}
          color={Colors.navy}
        />
        {data?.financeVisibility ? (
          <TrendChart
            title="Cost Trend (6 mo)"
            points={(data?.costTrendMonths ?? []).map((m: WorkshopCostTrendMonth) => ({ month: m.month, value: m.total }))}
            color={Colors.warning}
            suffix=" RWF"
          />
        ) : null}

        <MetricsBanner
          total={workshops.length}
          active={workshops.filter(w => w.active).length}
          transfers={transfers.length}
          requests={requests.length}
          lowStockCount={lowStock.length}
        />

        {/* Workshop Cards */}
        <Text style={styles.sectionTitle}>Workshops</Text>
        {workshops.length === 0
          ? <EmptyState icon="business-outline" title="No workshops" subtitle="No workshop data available." />
          : workshops.map(w => <WorkshopCard key={w.id} item={w} />)
        }

        {/* Pending Transfers */}
        {transfers.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Pending Transfers ({transfers.length})</Text>
            {transfers.map(t => (
              <TransferRow
                key={t.id}
                item={t}
                canApprove={canApprove}
                onApprove={() => confirmTransfer(t, 'approve')}
                onReject={()  => confirmTransfer(t, 'reject')}
              />
            ))}
          </>
        )}

        {/* Pending Material Requests */}
        {requests.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Pending Material Requests ({requests.length})</Text>
            {requests.map(r => (
              <MRRow
                key={r.id}
                item={r}
                canApprove={canApprove}
                onApprove={() => confirmMR(r, 'approve')}
                onReject={()  => confirmMR(r, 'reject')}
              />
            ))}
          </>
        )}

        {/* Low Stock */}
        {lowStock.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Low Stock Alerts ({lowStock.length})</Text>
            {lowStock.map((item, idx) => <LowStockRow key={idx} item={item} />)}
          </>
        )}

        {workshops.length === 0 && transfers.length === 0 && requests.length === 0 && lowStock.length === 0 && (
          <EmptyState icon="business-outline" title="No data" subtitle="Workshop data will appear here." />
        )}
      </ScrollView>

      <MRApproveModal
        item={mrApproveTarget}
        workshops={workshops}
        onClose={() => setMrApproveTarget(null)}
        onConfirm={handleMrApprove}
        loading={mrApproveLoading}
      />

      <ReasonModal
        visible={!!mrRejectTarget}
        title="Reject Request"
        message={mrRejectTarget ? `Reject request for ${mrRejectTarget.requested_qty} ${mrRejectTarget.uom} "${mrRejectTarget.item_name}" from ${mrRejectTarget.workshop_name}?` : ''}
        confirmLabel="Reject"
        loading={mrRejectLoading}
        onCancel={() => setMrRejectTarget(null)}
        onConfirm={handleMrReject}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  scroll:  { flex: 1 },
  content: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },

  // MR approve modal

  banner: {
    flexDirection: 'row', backgroundColor: Colors.navy,
    borderRadius: Radius.lg, padding: Spacing.base,
    justifyContent: 'space-around', ...Shadow.sm,
  },
  stat:      { alignItems: 'center', gap: 2 },
  statValue: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.white },
  statLabel: { fontSize: 9, color: Colors.tabInactive, textTransform: 'uppercase', letterSpacing: 0.5 },

  sectionTitle: {
    fontSize: Typography.xs, fontWeight: Typography.semibold,
    color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6,
    marginTop: Spacing.sm,
  },

  card: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, gap: Spacing.sm, ...Shadow.sm,
  },
  cardInactive: { opacity: 0.6 },
  cardHeader:   { gap: 2 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  cardName:     { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary, flex: 1 },
  cardType:     { fontSize: Typography.xs, color: Colors.textMuted },
  cardLocation: { fontSize: Typography.xs, color: Colors.textSecondary },
  inactiveBadge:     { backgroundColor: Colors.border, borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  inactiveBadgeText: { fontSize: 10, color: Colors.textMuted },

  cardStats:     { flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm },
  cardStat:      { alignItems: 'center', gap: 2 },
  cardStatValue: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary },
  cardStatLabel: { fontSize: 10, color: Colors.textMuted },

  pendingCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, flexDirection: 'row', alignItems: 'flex-start',
    gap: Spacing.sm, ...Shadow.sm,
  },
  pendingInfo:    { flex: 1, gap: 2 },
  pendingTitle:   { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },
  pendingMeta:    { fontSize: Typography.xs, color: Colors.textMuted },
  pendingMetaRow: { flexDirection: 'row', alignItems: 'center' },
  pendingReason:  { fontSize: Typography.xs, color: Colors.textSecondary, fontStyle: 'italic', marginTop: 2 },
  priorityBadge:  { fontSize: Typography.xs, fontWeight: Typography.semibold },
  pendingActions: { gap: Spacing.xs, flexDirection: 'column' },
  approveBtn: {
    backgroundColor: Colors.success, borderRadius: Radius.md,
    padding: 6, alignItems: 'center', justifyContent: 'center',
  },
  rejectBtn: {
    backgroundColor: Colors.error, borderRadius: Radius.md,
    padding: 6, alignItems: 'center', justifyContent: 'center',
  },

  lowStockCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, flexDirection: 'row', alignItems: 'center',
    gap: Spacing.sm, ...Shadow.sm,
  },
  stockBadge:     { backgroundColor: Colors.error + '20', borderRadius: Radius.md, paddingHorizontal: 8, paddingVertical: 4 },
  stockBadgeText: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.error },

  emptyText: { fontSize: Typography.sm, color: Colors.textMuted },

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
    fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2,
  },

  widgetCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.md, ...Shadow.sm, marginBottom: Spacing.sm,
  },
  widgetTitle: {
    fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary, marginBottom: Spacing.xs,
  },
  widgetCount: {
    color: Colors.textMuted, fontWeight: Typography.regular,
  },
  widgetRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: Colors.divider, gap: Spacing.sm,
  },
  widgetLabel: {
    fontSize: Typography.xs, fontWeight: Typography.medium, color: Colors.textPrimary,
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
});
