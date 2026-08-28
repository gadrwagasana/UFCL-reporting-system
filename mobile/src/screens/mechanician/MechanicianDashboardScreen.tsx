import React from 'react';
import { StyleSheet, View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { AppHeader } from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { StatusBadge } from '../../components/StatusBadge';
import { KpiCard } from '../../components/KpiCard';
import { useMechanicianDashboard } from '../../hooks/useMaterialRequests';
import { MAINT_JOB_STATUS_LABEL } from '../../hooks/useMaintenanceJobs';
import { MechanicianDashboardWidgetItem } from '../../types/api';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

// Mechanician Phase 4 (Priority 1) — KPI tiles become tappable deep links
// into the Maintenance Jobs tab, pre-filtered to that status, mirroring the
// desktop dashboard redesign. Cross-tab navigation params aren't typed
// end-to-end anywhere else in this app yet, so this one call site uses a
// narrow `as never` cast rather than introducing new composite-navigator
// typing plumbing across four different tab param lists for one deep link.
function goToJobs(navigation: { navigate: (...args: never[]) => void }, status: string) {
  navigation.navigate('MaintenanceJobs' as never, { screen: 'MaintenanceJobsList', params: { initialStatus: status } } as never);
}
function goToJobDetail(navigation: { navigate: (...args: never[]) => void }, jobId: number) {
  navigation.navigate('MaintenanceJobs' as never, { screen: 'MaintenanceJobDetail', params: { jobId } } as never);
}

// Mechanician Phase 1 (Priority 5) — tailored dashboard replacing the
// generic company-wide dashboard this role never had mobile access to and
// was leaked unrelated data from on desktop. Entirely read-only, composed
// from existing data via mechanicianDashboard() (db/services/data.js).

function OpsWidget({ title, items, labelKey, subText, badge, warn, emptyMsg }: {
  title: string;
  items: MechanicianDashboardWidgetItem[];
  labelKey: string;
  subText?: (it: MechanicianDashboardWidgetItem) => string;
  badge?: (it: MechanicianDashboardWidgetItem) => React.ReactNode;
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
          {badge ? badge(it) : null}
        </View>
      ))}
      {items.length > 5 ? <Text style={styles.widgetMore}>+{items.length - 5} more</Text> : null}
    </View>
  );
}

export function MechanicianDashboardScreen() {
  const navigation = useNavigation();
  const { data, isLoading, isError, refetch, isRefetching } = useMechanicianDashboard();

  if (isLoading) return <LoadingState message="Loading dashboard…" fullScreen />;

  // "What should I work on now?" — same ordering rule as desktop: blocked
  // jobs (waiting_parts/external_repair) surface first since they need
  // action/escalation, not hands-on work.
  const priorityJobs = data?.ok
    ? [...(data.widgets.myJobs ?? [])].sort((a, b) => {
        const aw = ['waiting_parts', 'external_repair'].includes(String(a.status)) ? 0 : 1;
        const bw = ['waiting_parts', 'external_repair'].includes(String(b.status)) ? 0 : 1;
        return aw - bw;
      })
    : [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Dashboard" subtitle="Your material requests and workshop maintenance status" dark />

      {isError || !data?.ok ? (
        <ErrorState message="Could not load dashboard" onRetry={refetch} fullScreen />
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
        >
          <Text style={styles.sectionTitle}>My Maintenance Jobs</Text>
          <View style={styles.kpiGrid}>
            <KpiCard variant="tile" title="Open" value={data.kpi.openJobs} onPress={() => goToJobs(navigation, '')} />
            <KpiCard variant="tile" title="Assigned" value={data.kpi.assignedJobs} onPress={() => goToJobs(navigation, 'assigned')} />
            <KpiCard variant="tile" title="In Progress" value={data.kpi.inProgressCount} onPress={() => goToJobs(navigation, 'in_progress')} />
            <KpiCard variant="tile" title="Waiting for Parts" value={data.kpi.waitingForParts} warn={data.kpi.waitingForParts > 0} onPress={() => goToJobs(navigation, 'waiting_parts')} />
            <KpiCard variant="tile" title="Testing" value={data.kpi.testingCount} onPress={() => goToJobs(navigation, 'testing')} />
            <KpiCard variant="tile" title="External Repair" value={data.kpi.externalRepairCount} warn={data.kpi.externalRepairCount > 0} onPress={() => goToJobs(navigation, 'external_repair')} />
            <KpiCard variant="tile" title="Completed Today" value={data.kpi.completedJobsToday} />
          </View>

          <View style={styles.widgetCard}>
            <Text style={styles.widgetTitle}>What should I work on now?</Text>
            {priorityJobs.length === 0 ? (
              <Text style={styles.emptyText}>Nothing assigned to you right now.</Text>
            ) : priorityJobs.slice(0, 5).map((it, i) => (
              <TouchableOpacity key={i} style={styles.widgetRow} onPress={() => goToJobDetail(navigation, Number(it.id))} activeOpacity={0.7}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.widgetLabel} numberOfLines={1}>{String(it.title ?? '')}</Text>
                  <Text style={styles.widgetSub} numberOfLines={1}>{String(it.machine_code ?? '')} — {String(it.machine_name ?? '')}</Text>
                </View>
                <Text style={styles.widgetBadge}>{MAINT_JOB_STATUS_LABEL[String(it.status) as keyof typeof MAINT_JOB_STATUS_LABEL] ?? String(it.status ?? '')}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionTitle}>My Material Requests</Text>
          <View style={styles.kpiGrid}>
            <KpiCard variant="tile" title="Total" value={data.kpi.myTotalRequests} />
            <KpiCard variant="tile" title="Pending" value={data.kpi.myPending} warn={data.kpi.myPending > 0} />
            <KpiCard variant="tile" title="Approved" value={data.kpi.myApproved} />
            <KpiCard variant="tile" title="Rejected" value={data.kpi.myRejected} warn={data.kpi.myRejected > 0} />
          </View>

          <OpsWidget
            title="Recent Requests"
            items={data.widgets.myRecentRequests}
            labelKey="item_name"
            subText={(it) => `Qty ${it.requested_qty}${it.approved_qty != null ? ` · Approved ${it.approved_qty}` : ''} · ${it.requested_at}`}
            badge={(it) => (
              <View>
                <StatusBadge status={String(it.status ?? '')} size="sm" />
                {it.transfer_id ? (
                  <Text style={styles.transferNote}>Transfer: {String(it.transfer_status ?? '')}</Text>
                ) : null}
              </View>
            )}
            emptyMsg="You haven't submitted any material requests yet."
          />

          <Text style={styles.sectionTitle}>Workshop Maintenance</Text>
          <OpsWidget
            title="Machines Requiring Attention"
            items={data.widgets.machinesRequiringAttention}
            labelKey="name"
            subText={(it) => String(it.machine_code ?? '')}
            badge={(it) => <StatusBadge status={String(it.status ?? '')} size="sm" />}
            warn
            emptyMsg="No machines under maintenance or breakdown."
          />
          <OpsWidget
            title="Overdue Maintenance"
            items={data.widgets.overdueMaintenance ?? []}
            labelKey="name"
            subText={(it) => String(it.machine_code ?? '')}
            badge={(it) => <Text style={[styles.widgetBadge, { color: Colors.error }]}>{String(it.next_due ?? '')}</Text>}
            warn
            emptyMsg="Nothing overdue right now."
          />
          <OpsWidget
            title="Upcoming Maintenance"
            items={data.widgets.upcomingMaintenance}
            labelKey="name"
            subText={(it) => String(it.machine_code ?? '')}
            badge={(it) => <Text style={styles.widgetBadge}>{String(it.next_due ?? '')}</Text>}
            emptyMsg="No maintenance due soon."
          />

          <Text style={styles.sectionTitle}>My Activity</Text>
          <OpsWidget
            title="Recent Maintenance Activity"
            items={data.widgets.myMaintenanceActivity}
            labelKey="machine_name"
            subText={(it) => String(it.remarks ?? (Number(it.downtime_hours ?? 0) > 0 ? `${it.downtime_hours}h downtime` : 'Logged'))}
            badge={(it) => <Text style={styles.widgetBadge}>{String(it.log_date ?? '')}</Text>}
            emptyMsg="No machine logs recorded yet."
          />
          <OpsWidget
            title="Recent Fuel Activity"
            items={data.widgets.myFuelActivity}
            labelKey="machine_name"
            subText={(it) => `${it.fuel_type} · ${it.quantity}${it.unit === 'liters' ? 'L' : ' ' + it.unit}`}
            badge={(it) => <Text style={styles.widgetBadge}>{String(it.log_date ?? '')}</Text>}
            emptyMsg="No fuel activity recorded yet."
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  list: { padding: Spacing.base, paddingBottom: Spacing.xxxl },

  sectionTitle: {
    fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: Spacing.xs, marginTop: Spacing.sm,
  },
  kpiGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.sm,
  },
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
  transferNote: { fontSize: 9, color: Colors.textMuted, marginTop: 2, textAlign: 'right' },
});
