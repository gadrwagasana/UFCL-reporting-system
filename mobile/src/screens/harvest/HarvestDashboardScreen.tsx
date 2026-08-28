import React from 'react';
import { StyleSheet, View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader } from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { KpiCard } from '../../components/KpiCard';
import { StatusBadge } from '../../components/StatusBadge';
import { useHarvestDashboard } from '../../hooks/useHarvest';
import { HarvestStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<HarvestStackParamList, 'HarvestDashboard'>;

// Harvesting Phase 1 (Workstream 2) — dedicated operational dashboard,
// mirroring desktop's new "Harvest Dashboard" section (renderer/app.js) and
// reusing the shared KpiCard tile component per the Enterprise Design
// System, same as every other mobile dashboard in this app.
//
// "Active Harvest Teams" is intentionally not shown here — harvest_logs has
// no team/crew/assignment concept anywhere in the backend (confirmed in
// HARVESTING_ENTERPRISE_AUDIT.md); inventing one would be a new feature, not
// exposing existing functionality.

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function HarvestDashboardScreen() {
  const navigation = useNavigation<NavProp>();
  const { data, isLoading, isError, refetch, isRefetching } = useHarvestDashboard();

  if (isLoading) return <LoadingState message="Loading harvest dashboard…" fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Harvest Dashboard" dark onBack={() => navigation.goBack()} />

      {isError || !data ? (
        <ErrorState message="Could not load the harvest dashboard" onRetry={refetch} fullScreen />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
        >
          <SectionTitle>Production</SectionTitle>
          <View style={styles.grid}>
            <KpiCard variant="tile" tileSize="md" title="Today's Harvest" value={data.todayHarvest} icon="today-outline" />
            <KpiCard variant="tile" tileSize="md" title="This Week" value={data.weeklyHarvest} icon="calendar-outline" />
            <KpiCard variant="tile" tileSize="md" title="This Month" value={data.monthlyHarvest} icon="calendar-clear-outline" />
          </View>

          <SectionTitle>Compartments</SectionTitle>
          <View style={styles.grid}>
            <KpiCard variant="tile" tileSize="md" title="Active Compartments" value={data.activeCompartments} icon="leaf-outline" color={Colors.success} />
            <KpiCard variant="tile" tileSize="md" title="Completed" value={data.completedCompartments} icon="checkmark-done-outline" />
          </View>

          <SectionTitle>Logs &amp; Volume</SectionTitle>
          <View style={styles.grid}>
            <KpiCard variant="tile" tileSize="md" title="Logs Produced" value={data.logsProduced} icon="albums-outline" />
            <KpiCard variant="tile" tileSize="md" title="Volume (m³)" value={data.volumeProducedM3.toFixed(1)} icon="cube-outline" />
          </View>

          {/* Harvesting Phase 2 (Workstream 2 & 4) — Planning Summary. */}
          <SectionTitle>Planning</SectionTitle>
          <View style={styles.grid}>
            <KpiCard variant="tile" tileSize="md" title="Planned" value={data.planningSummary.planned} icon="document-text-outline" />
            <KpiCard variant="tile" tileSize="md" title="In Progress" value={data.planningSummary.inProgress} icon="sync-outline" color={Colors.info} />
            <KpiCard variant="tile" tileSize="md" title="Completed" value={data.planningSummary.completed} icon="checkmark-done-outline" color={Colors.success} />
            <KpiCard variant="tile" tileSize="md" title="Delayed" value={data.planningSummary.delayed} icon="alert-circle-outline" warn={data.planningSummary.delayed > 0} />
          </View>

          {/* Workstream 3 — Planned vs Actual + Productivity. */}
          <SectionTitle>Planned vs Actual (this month)</SectionTitle>
          <View style={styles.grid}>
            <KpiCard variant="tile" tileSize="md" title="Volume (m³)" value={`${data.actualVolumeM3} / ${data.plannedVolumeM3}`} icon="cube-outline" />
            <KpiCard variant="tile" tileSize="md" title="Logs" value={`${data.actualLogs} / ${data.plannedLogs}`} icon="albums-outline" />
          </View>
          <SectionTitle>Productivity</SectionTitle>
          <View style={styles.grid}>
            <KpiCard variant="tile" tileSize="md" title="Daily (m³)" value={data.dailyProductivityM3.toFixed(1)} icon="today-outline" />
            <KpiCard variant="tile" tileSize="md" title="Weekly (m³)" value={data.weeklyProductivityM3.toFixed(1)} icon="calendar-outline" />
            <KpiCard variant="tile" tileSize="md" title="Monthly (m³)" value={data.monthlyProductivityM3.toFixed(1)} icon="calendar-clear-outline" />
          </View>

          {/* Harvesting Phase 4 (Workstream 4) — End-to-End Visibility: a
              clearer stepper/funnel replacement for flat KPI tiles, so the
              Harvest -> Transport -> Sawmill flow reads left-to-right as one
              picture rather than five separate numbers. Visibility only —
              same underlying figures Phase 2/3 already computed. */}
          <SectionTitle>Pipeline</SectionTitle>
          <View style={styles.pipelineFlow}>
            <View style={styles.pipelineStage}>
              <Text style={styles.pipelineVal}>{data.pipeline.logsHarvested}</Text>
              <Text style={styles.pipelineLbl}>Harvested</Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color={Colors.textMuted} />
            <View style={[styles.pipelineStage, data.transportWaiting > 0 && styles.pipelineStageWarn]}>
              <Text style={styles.pipelineVal}>{data.transportWaiting}</Text>
              <Text style={styles.pipelineLbl}>Waiting for Transport</Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color={Colors.textMuted} />
            <View style={[styles.pipelineStage, data.rawLogInventory > 0 && styles.pipelineStageWarn]}>
              <Text style={styles.pipelineVal}>{data.rawLogInventory}</Text>
              <Text style={styles.pipelineLbl}>Waiting for Sawmill</Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color={Colors.textMuted} />
            <View style={[styles.pipelineStage, styles.pipelineStageDone]}>
              <Text style={styles.pipelineVal}>{data.pipeline.logsConsumedBySawmill}</Text>
              <Text style={styles.pipelineLbl}>Completed Flow</Text>
            </View>
          </View>

          {/* Workstream 4 — Today's Schedule. */}
          {data.todaysSchedule.length > 0 && (
            <>
              <SectionTitle>Today's Schedule</SectionTitle>
              <View style={styles.scheduleList}>
                {data.todaysSchedule.map((s) => (
                  <View key={s.id} style={styles.scheduleRow}>
                    <View style={styles.scheduleInfo}>
                      <Text style={styles.scheduleSpecies}>{s.species}</Text>
                      <Text style={styles.scheduleSub}>
                        {s.comptName ?? 'No compartment'}
                        {s.targetVolumeM3 != null ? ` · ${s.targetVolumeM3} m³` : ''}
                        {s.targetLogs != null ? ` · ${s.targetLogs} logs` : ''}
                      </Text>
                    </View>
                    <StatusBadge status={s.status} size="sm" />
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Harvesting Phase 3 (Workstreams 1-3) — reached from here rather
              than adding two more header-icon actions to HarvestListScreen,
              which was already at 5 icons (back + search + 3 actions);
              consolidating related-screen entry points under the dashboard
              instead keeps that header usable on smaller phones. */}
          <SectionTitle>Quick Links</SectionTitle>
          <View style={styles.quickLinks}>
            <TouchableOpacity style={styles.quickLink} onPress={() => navigation.navigate('HarvestOperations')} activeOpacity={0.75}>
              <Ionicons name="pulse-outline" size={20} color={Colors.navy} />
              <Text style={styles.quickLinkText}>Active Harvest Operations</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickLink} onPress={() => navigation.navigate('HarvestDelays')} activeOpacity={0.75}>
              <Ionicons name="alert-circle-outline" size={20} color={Colors.navy} />
              <Text style={styles.quickLinkText}>Operational Delays</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.base, paddingBottom: Spacing.xxxl },
  sectionTitle: {
    fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.6, marginTop: Spacing.base, marginBottom: Spacing.xs,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },

  scheduleList: { gap: Spacing.sm },
  scheduleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, ...Shadow.sm,
  },
  scheduleInfo:    { flex: 1, marginRight: Spacing.sm },
  scheduleSpecies: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  scheduleSub:     { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },

  quickLinks: { gap: Spacing.sm },
  quickLink: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, ...Shadow.sm,
  },
  quickLinkText: { flex: 1, fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.textPrimary },

  pipelineFlow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.xs },
  pipelineStage: {
    flexGrow: 1, minWidth: 80, alignItems: 'center', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xs,
    backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, ...Shadow.sm,
  },
  pipelineStageWarn: { backgroundColor: Colors.warningBg, borderColor: Colors.warning },
  pipelineStageDone: { backgroundColor: Colors.successBg, borderColor: Colors.success },
  pipelineVal: { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.textPrimary },
  pipelineLbl: { fontSize: 10, color: Colors.textMuted, marginTop: 2, textAlign: 'center' },
});
