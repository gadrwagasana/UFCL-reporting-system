import React from 'react';
import { StyleSheet, View, Text, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { AppHeader } from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { KpiCard } from '../../components/KpiCard';
import { SparklineChart } from '../../components/SparklineChart';
import { useHarvestOperations, useHarvestPerformance, useHarvestDecisionSupport } from '../../hooks/useHarvest';
import { HarvestOperationCompartment } from '../../types/api';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

// Harvesting Phase 3 (Workstreams 1 & 2) — combined into one screen (Active
// Harvest Operations + Production Performance) rather than two, to avoid
// adding yet another header action / nav entry for two closely-related views.

const BUCKET_META: Record<HarvestOperationCompartment['bucket'], { label: string; color: string; bg: string }> = {
  waitingToStart: { label: 'Waiting to Start', color: Colors.warning,  bg: Colors.warningBg },
  inProgress:     { label: 'In Progress',      color: Colors.info,     bg: Colors.infoBg },
  completed:      { label: 'Completed',        color: Colors.success,  bg: Colors.successBg },
  delayed:        { label: 'Delayed',          color: Colors.error,    bg: Colors.errorBg },
};

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

// Harvesting Phase 4 (Workstream 2) — a small ranked-list card, reused across
// all six Decision Support rankings rather than six bespoke layouts.
function RankList({ title, rows, valueSuffix = '' }: { title: string; rows: { label: string; value: number | string }[]; valueSuffix?: string }) {
  return (
    <View style={styles.rankCard}>
      <Text style={styles.rankTitle}>{title}</Text>
      {rows.length === 0 ? (
        <Text style={styles.emptyText}>No data yet</Text>
      ) : rows.map((r, i) => (
        <View key={i} style={styles.rankRow}>
          <Text style={styles.rankIndex}>{i + 1}</Text>
          <Text style={styles.rankLabel} numberOfLines={1}>{r.label}</Text>
          <Text style={styles.rankValue}>{r.value}{valueSuffix}</Text>
        </View>
      ))}
    </View>
  );
}

function CompartmentRow({ c }: { c: HarvestOperationCompartment }) {
  const meta = BUCKET_META[c.bucket];
  return (
    <View style={styles.compRow}>
      <View style={styles.compInfo}>
        <Text style={styles.compName}>{c.comptName}{c.subName ? ` · ${c.subName}` : ''}</Text>
        <Text style={styles.compSub}>{c.species ?? '—'} · {c.treesHarvested} trees · {c.logsCrosscut} logs</Text>
      </View>
      <View style={[styles.bucketBadge, { backgroundColor: meta.bg }]}>
        <Text style={[styles.bucketText, { color: meta.color }]}>{meta.label}</Text>
      </View>
    </View>
  );
}

export function HarvestOperationsScreen() {
  const navigation = useNavigation();
  const { data: ops, isLoading: opsLoading, isError: opsError, refetch: refetchOps, isRefetching: opsRefetching } = useHarvestOperations();
  const { data: perf, isLoading: perfLoading } = useHarvestPerformance();
  const { data: ds } = useHarvestDecisionSupport();

  if (opsLoading || perfLoading) return <LoadingState message="Loading harvest operations…" fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Active Harvest Operations" dark onBack={() => navigation.goBack()} />

      {opsError || !ops ? (
        <ErrorState message="Could not load harvest operations" onRetry={refetchOps} fullScreen />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={opsRefetching} onRefresh={refetchOps} tintColor={Colors.navy} />}
        >
          <SectionTitle>Compartment Status</SectionTitle>
          <View style={styles.grid}>
            <KpiCard variant="tile" tileSize="md" title="Waiting to Start" value={ops.counts.waitingToStart} icon="hourglass-outline" />
            <KpiCard variant="tile" tileSize="md" title="In Progress" value={ops.counts.inProgress} icon="sync-outline" color={Colors.info} />
            <KpiCard variant="tile" tileSize="md" title="Completed" value={ops.counts.completed} icon="checkmark-done-outline" color={Colors.success} />
            <KpiCard variant="tile" tileSize="md" title="Delayed" value={ops.counts.delayed} icon="alert-circle-outline" warn={ops.counts.delayed > 0} />
          </View>

          <SectionTitle>Compartments</SectionTitle>
          <View style={styles.compList}>
            {ops.compartments.length === 0 ? (
              <Text style={styles.emptyText}>No compartments yet.</Text>
            ) : ops.compartments.map((c) => <CompartmentRow key={c.id} c={c} />)}
          </View>

          {perf && (
            <>
              <SectionTitle>Production Performance</SectionTitle>
              <View style={styles.grid}>
                <KpiCard
                  variant="tile" tileSize="md" title="Achievement" value={perf.achievementPct != null ? `${perf.achievementPct}%` : '—'}
                  icon="trophy-outline"
                />
                <KpiCard
                  variant="tile" tileSize="md" title="Variance (m³)" value={`${perf.varianceM3 > 0 ? '+' : ''}${perf.varianceM3}`}
                  icon="swap-vertical-outline" color={perf.varianceM3 < 0 ? Colors.error : Colors.success}
                />
              </View>

              <View style={styles.trendCard}>
                <View style={styles.trendHeader}>
                  <Text style={styles.trendTitle}>Volume Trend — last 14 days (m³)</Text>
                </View>
                <SparklineChart data={perf.dailyTrend.map((d) => d.volumeM3)} width={280} height={50} color={Colors.green} />
              </View>

              {perf.volumeByCompartment.length > 0 && (
                <>
                  <SectionTitle>Volume by Compartment</SectionTitle>
                  <View style={styles.compList}>
                    {perf.volumeByCompartment.map((r, i) => (
                      <View key={i} style={styles.volRow}>
                        <Text style={styles.compName}>{r.comptName}</Text>
                        <Text style={styles.volValue}>{r.volumeM3} m³ · {r.logs} logs</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </>
          )}

          {ds && (
            <>
              <SectionTitle>Decision Support</SectionTitle>
              <RankList
                title="Top Performing Compartments"
                rows={ds.topCompartments.map((r) => ({ label: r.comptName, value: r.volumeM3 }))}
                valueSuffix=" m³"
              />
              <RankList
                title="Lowest Performing Compartments"
                rows={ds.bottomCompartments.map((r) => ({ label: r.comptName, value: r.volumeM3 }))}
                valueSuffix=" m³"
              />
              <RankList
                title="Most Delayed Compartments"
                rows={ds.mostDelayedCompartments.map((r) => ({ label: r.comptName, value: r.totalHours }))}
                valueSuffix="h"
              />
              <RankList
                title="Highest Production Days"
                rows={ds.highestProductionDays.map((r) => ({ label: r.label, value: r.volumeM3 }))}
                valueSuffix=" m³"
              />
              <RankList
                title="Lowest Production Days"
                rows={ds.lowestProductionDays.map((r) => ({ label: r.label, value: r.volumeM3 }))}
                valueSuffix=" m³"
              />
              <RankList
                title="Species Performance Ranking"
                rows={ds.speciesRanking.map((r) => ({ label: r.species, value: r.volumeM3 }))}
                valueSuffix=" m³"
              />
            </>
          )}
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

  compList: { gap: Spacing.sm },
  compRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, ...Shadow.sm,
  },
  compInfo: { flex: 1, marginRight: Spacing.sm },
  compName: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  compSub:  { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },
  bucketBadge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  bucketText:  { fontSize: Typography.xs, fontWeight: Typography.semibold },

  emptyText: { fontSize: Typography.sm, color: Colors.textMuted, textAlign: 'center', padding: Spacing.base },

  trendCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base,
    alignItems: 'center', ...Shadow.sm,
  },
  trendHeader: { alignSelf: 'flex-start', marginBottom: Spacing.sm },
  trendTitle:  { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textSecondary },

  volRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, ...Shadow.sm,
  },
  volValue: { fontSize: Typography.sm, color: Colors.textMuted },

  rankCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base,
    marginBottom: Spacing.sm, ...Shadow.sm,
  },
  rankTitle: {
    fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  rankRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border,
  },
  rankIndex: { width: 20, fontSize: Typography.xs, color: Colors.textMuted, fontWeight: Typography.semibold },
  rankLabel: { flex: 1, fontSize: Typography.sm, color: Colors.textPrimary, marginRight: Spacing.sm },
  rankValue: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textSecondary },
});
