import React from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { AppHeader }    from '../../components/AppHeader';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState }   from '../../components/ErrorState';
import { OfflineBanner } from '../../components/OfflineBanner';
import { KpiCard }      from '../../components/KpiCard';
import { useAuthStore } from '../../stores/authStore';
import { useCeoOverview } from '../../hooks/useCeoOverview';
import { useHarvestDashboard, useHarvestExecutiveExtras } from '../../hooks/useHarvest';
import { CeoTabParamList } from '../../navigation/types';
import { DowntimeStatus } from '../../constants/dashboardEnums';
import { Colors, Spacing, TextStyles, Radius } from '../../theme';
import { formatNumber, formatCurrency } from '../../utils/formatters';

type CeoTabNav = BottomTabNavigationProp<CeoTabParamList>;

export function CeoOverviewScreen() {
  const user       = useAuthStore((s) => s.user);
  const navigation = useNavigation<CeoTabNav>();

  // Master Professionalization Phase C2 — now the shared hook (previously
  // this screen duplicated the same query inline while the real hook sat
  // unused with a stale, wrong type — see useCeoOverview.ts).
  const { data, isLoading, isError, refetch, isRefetching } = useCeoOverview();
  // Harvesting Phase 3 (Workstream 4) — a separate, additive query rather
  // than folding into ceo-overview's own backend endpoint, so this stays
  // fully additive and doesn't touch that (more sensitive) executive query.
  const { data: harvestOps } = useHarvestDashboard();
  const totalCompt = harvestOps ? harvestOps.activeCompartments + harvestOps.completedCompartments : 0;
  const compCompletionPct = totalCompt > 0 ? Math.round((harvestOps!.completedCompartments / totalCompt) * 100) : 0;
  // Harvesting Phase 4 (Workstream 3) — Executive Reporting extras.
  const { data: harvestExtras } = useHarvestExecutiveExtras();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader
        title="Overview"
        subtitle={user?.workshopName ?? user?.name ?? ''}
      />

      {isLoading ? (
        <LoadingState message="Loading overview…" fullScreen />
      ) : isError || !data ? (
        <ErrorState message="Could not load overview" onRetry={refetch} fullScreen />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.greeting}>Good morning, {user?.name?.split(' ')[0] ?? 'CEO'}</Text>
          <Text style={styles.month}>{data.month}</Text>

          {/* Alert banner — pending poles requests */}
          {data.governance.pendingPolesRequests > 0 ? (
            <TouchableOpacity
              style={styles.alertBanner}
              onPress={() => navigation.navigate('CeoApprovals')}
              activeOpacity={0.8}
            >
              <Ionicons name="alert-circle" size={18} color={Colors.warning} />
              <Text style={styles.alertText}>
                {data.governance.pendingPolesRequests} poles purchase request{data.governance.pendingPolesRequests !== 1 ? 's' : ''} awaiting your approval
              </Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.warning} />
            </TouchableOpacity>
          ) : null}

          {/* Alert banner — pending monthly approval */}
          {data.governance.pendingMonthlyApproval ? (
            <TouchableOpacity
              style={styles.alertBanner}
              onPress={() => navigation.navigate('CeoApprovals')}
              activeOpacity={0.8}
            >
              <Ionicons name="calendar" size={18} color={Colors.warning} />
              <Text style={styles.alertText}>Monthly report awaiting your approval</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.warning} />
            </TouchableOpacity>
          ) : null}

          {/* Alert banner — pending change requests */}
          {data.governance.pendingChanges > 0 ? (
            <TouchableOpacity
              style={styles.alertBanner}
              onPress={() => navigation.navigate('CeoApprovals')}
              activeOpacity={0.8}
            >
              <Ionicons name="git-pull-request" size={18} color={Colors.warning} />
              <Text style={styles.alertText}>
                {data.governance.pendingChanges} change request{data.governance.pendingChanges !== 1 ? 's' : ''} awaiting your approval
              </Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.warning} />
            </TouchableOpacity>
          ) : null}

          {/* Production */}
          <Text style={styles.sectionTitle}>Production</Text>
          <KpiCard
            title="Timber Units"
            value={formatNumber(data.production.timber_units)}
            icon="construct"
            color={Colors.navy}
            subtitle={`${data.production.entries} production entries`}
          />
          <KpiCard
            title="Poles Units"
            value={formatNumber(data.production.poles_units)}
            icon="podium"
            color={Colors.orange}
          />
          <KpiCard
            title="Downtime Hours"
            value={formatNumber(data.production.downtime_hours, 1)}
            icon="time-outline"
            color={data.production.downtime_status === DowntimeStatus.REVIEW_REQUIRED ? Colors.error : Colors.green}
            subtitle={data.production.downtime_status === DowntimeStatus.REVIEW_REQUIRED ? 'Review required' : 'Within target'}
          />

          {/* Harvest */}
          <Text style={styles.sectionTitle}>Harvest</Text>
          <KpiCard
            title="Trees Felled"
            value={formatNumber(data.harvest.trees)}
            icon="leaf-outline"
            color={Colors.green}
            onPress={() => navigation.navigate('Compartments')}
          />
          <KpiCard
            title="Logs Crosscut"
            value={formatNumber(data.harvest.logs)}
            icon="leaf"
            color={Colors.green}
          />

          {/* Harvesting Phase 3 (Workstreams 4 & 5) — Harvest Operations */}
          {harvestOps && (
            <>
              <Text style={styles.sectionTitle}>Harvest Operations</Text>
              <KpiCard
                title="Compartment Completion"
                value={`${compCompletionPct}%`}
                icon="checkmark-done-outline"
                color={Colors.green}
              />
              <KpiCard
                title="Delayed Operations"
                value={formatNumber(harvestOps.planningSummary.delayed)}
                icon="alert-circle-outline"
                color={harvestOps.planningSummary.delayed > 0 ? Colors.error : Colors.green}
                subtitle={harvestOps.planningSummary.delayed > 0 ? 'Needs attention' : 'On schedule'}
              />
              <KpiCard
                title="Operational Efficiency"
                value={harvestOps.actualVolumeM3 > 0 && harvestOps.plannedVolumeM3 > 0
                  ? `${Math.round((harvestOps.actualVolumeM3 / harvestOps.plannedVolumeM3) * 100)}%`
                  : '—'}
                icon="speedometer-outline"
                color={Colors.navy}
                subtitle="Achievement vs. plan, this month"
              />
              <KpiCard
                title="Waiting for Sawmill"
                value={formatNumber(harvestOps.rawLogInventory)}
                icon="layers-outline"
                color={Colors.navy}
                subtitle="Raw log inventory (logs)"
              />
            </>
          )}

          {/* Harvesting Phase 4 (Workstream 3) — Planning Accuracy & Delay Analysis */}
          {harvestExtras && (
            <>
              <KpiCard
                title="Planning Completion Rate"
                value={harvestExtras.planningAccuracy.completionRatePct != null ? `${harvestExtras.planningAccuracy.completionRatePct}%` : '—'}
                icon="checkmark-circle-outline"
                color={Colors.green}
                subtitle={`${harvestExtras.planningAccuracy.totalPlans} plan(s) total`}
              />
              <KpiCard
                title="Total Delay Time"
                value={`${harvestExtras.delayAnalysis.totalDelayHours}h`}
                icon="time-outline"
                color={harvestExtras.delayAnalysis.totalDelayHours > 0 ? Colors.error : Colors.green}
                subtitle={harvestExtras.delayAnalysis.mostCommonCategory ? `Most common: ${harvestExtras.delayAnalysis.mostCommonCategory}` : 'No delays logged'}
              />
            </>
          )}

          {/* Sales */}
          <Text style={styles.sectionTitle}>Sales</Text>
          <KpiCard
            title="Orders"
            value={formatNumber(data.sales.total_orders)}
            icon="receipt"
            color={Colors.navy}
            onPress={() => navigation.navigate('SalesOrders')}
          />
          <KpiCard
            title="Revenue"
            value={formatCurrency(data.sales.revenue, data.sales.currency)}
            icon="cash"
            color={Colors.green}
            onPress={() => navigation.navigate('SalesOrders')}
          />

          {/* Machines */}
          <Text style={styles.sectionTitle}>Machines</Text>
          <KpiCard
            title="Total Machines"
            value={formatNumber(data.machines.total)}
            icon="settings-outline"
            color={Colors.navy}
            subtitle={`${data.machines.available} available · ${data.machines.in_use} in use · ${data.machines.maintenance} maintenance`}
            onPress={() => navigation.navigate('Machines')}
          />

          {/* Operations */}
          <Text style={styles.sectionTitle}>Operations</Text>
          <KpiCard
            title="Active Vehicles"
            value={formatNumber(data.operations.vehicles)}
            icon="car-outline"
            color={Colors.navy}
            onPress={() => navigation.navigate('Vehicles')}
          />
          <KpiCard
            title="Casual Labourers"
            value={formatNumber(data.operations.casuals)}
            icon="people-outline"
            color={Colors.navy}
            badge={data.operations.pendingLabour}
            onPress={() => navigation.navigate('CasualLabour')}
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.base, paddingBottom: Spacing.xxxl },
  greeting: {
    ...TextStyles.heading,
    color: Colors.textPrimary,
  },
  month: {
    ...TextStyles.caption,
    color: Colors.textMuted,
    marginBottom: Spacing.base,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warningBg,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  alertText: {
    flex: 1,
    ...TextStyles.captionMedium,
    color: Colors.warning,
  },
  sectionTitle: {
    ...TextStyles.label,
    color: Colors.textMuted,
    marginTop: Spacing.base,
    marginBottom: Spacing.sm,
  },
});
