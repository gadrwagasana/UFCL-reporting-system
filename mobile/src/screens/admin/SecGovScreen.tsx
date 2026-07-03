import React from 'react';
import { StyleSheet, View, Text, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { AppHeader }    from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState }   from '../../components/ErrorState';
import { useSecGov }    from '../../hooks/useAdmin';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

function KpiCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  return (
    <View style={[styles.kpiCard, { borderLeftColor: color }]}>
      <Ionicons name={icon as never} size={20} color={color} />
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

export function SecGovScreen() {
  const navigation = useNavigation();
  const { data, isLoading, isError, refetch, isRefetching } = useSecGov();

  if (isLoading) return <LoadingState message="Loading security dashboard…" fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Security & Governance" onBack={() => navigation.goBack()} />

      {isError ? (
        <ErrorState message="Could not load security data" onRetry={refetch} fullScreen />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
        >
          {/* KPI Row */}
          <View style={styles.kpiRow}>
            <KpiCard label="Failed Logins"  value={data?.kpi.failedLogins ?? 0}     icon="warning"          color={Colors.error} />
            <KpiCard label="Priv Overrides" value={data?.kpi.privOverrides ?? 0}    icon="shield"           color={Colors.warning} />
            <KpiCard label="Pending Appr."  value={data?.kpi.pendingApprovals ?? 0} icon="hourglass"        color={Colors.navy} />
            <KpiCard label="Wf Failures"    value={data?.kpi.workflowFailures ?? 0} icon="close-circle"     color={Colors.error} />
          </View>

          {/* Notification Counts */}
          <SectionHeader title="UNREAD NOTIFICATIONS" />
          <View style={styles.row3}>
            {[
              { label: 'Security', val: data?.notifCounts.security ?? 0, color: Colors.error },
              { label: 'Approval', val: data?.notifCounts.approval ?? 0, color: Colors.warning },
              { label: 'System',   val: data?.notifCounts.system   ?? 0, color: Colors.navy },
            ].map((n) => (
              <View key={n.label} style={[styles.notifCard, { borderTopColor: n.color }]}>
                <Text style={[styles.notifValue, { color: n.color }]}>{n.val}</Text>
                <Text style={styles.notifLabel}>{n.label}</Text>
              </View>
            ))}
          </View>

          {/* Approval Overview */}
          <SectionHeader title="APPROVAL OVERVIEW" />
          <View style={styles.card}>
            {[
              { label: 'Leader Pending',  val: String(data?.approvals.leaderPending  ?? 0) },
              { label: 'Manager Pending', val: String(data?.approvals.managerPending ?? 0) },
              { label: 'Escalated',       val: String(data?.approvals.escalated      ?? 0) },
              { label: 'Avg Response',    val: data?.approvals.avgHours != null ? `${data.approvals.avgHours}h` : '—' },
            ].map((r) => (
              <View key={r.label} style={styles.rowLine}>
                <Text style={styles.rowLabel}>{r.label}</Text>
                <Text style={styles.rowVal}>{r.val}</Text>
              </View>
            ))}
          </View>

          {/* Security Events */}
          <SectionHeader title="SECURITY EVENTS (LAST 25)" />
          <View style={styles.card}>
            {(data?.securityEvents ?? []).length === 0 ? (
              <Text style={styles.empty}>No recent security events</Text>
            ) : (
              data!.securityEvents.map((e) => (
                <View key={e.id} style={styles.eventRow}>
                  <View style={styles.eventLeft}>
                    <Text style={styles.eventAction} numberOfLines={1}>{e.action}</Text>
                    <Text style={styles.eventMeta}>{e.username} · {e.role} · {e.action_type}</Text>
                  </View>
                  <Text style={styles.eventTime}>{e.time}</Text>
                </View>
              ))
            )}
          </View>

          {/* Workflow Health */}
          <SectionHeader title="WORKFLOW HEALTH" />
          <View style={styles.card}>
            {(data?.workflowHealth ?? []).length === 0 ? (
              <Text style={styles.empty}>All workflow jobs healthy</Text>
            ) : (
              data!.workflowHealth.map((j) => (
                <View key={j.id} style={styles.eventRow}>
                  <View style={styles.eventLeft}>
                    <Text style={styles.eventAction} numberOfLines={1}>{j.type}</Text>
                    <Text style={styles.eventMeta}>
                      {j.status} · {j.attempts}/{j.max_attempts} attempts
                      {j.last_error ? ` · ${j.last_error}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.eventTime}>{j.created_fmt}</Text>
                </View>
              ))
            )}
          </View>

          {/* Audit Feed */}
          <SectionHeader title="RECENT ACTIVITY (LAST 50)" />
          <View style={[styles.card, { marginBottom: Spacing.xxxl }]}>
            {(data?.auditFeed ?? []).map((a) => (
              <View key={a.id} style={styles.eventRow}>
                <View style={styles.eventLeft}>
                  <Text style={styles.eventAction} numberOfLines={1}>{a.action}</Text>
                  <Text style={styles.eventMeta}>{a.username} · {a.module}</Text>
                </View>
                <Text style={styles.eventTime}>{a.time}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.base, gap: Spacing.md },

  kpiRow: { flexDirection: 'row', gap: Spacing.sm },
  kpiCard: {
    flex: 1, backgroundColor: Colors.card, borderRadius: Radius.md,
    padding: Spacing.sm, alignItems: 'center', gap: 4,
    borderLeftWidth: 3, ...Shadow.sm,
  },
  kpiValue: { fontSize: Typography.xl, fontWeight: Typography.bold },
  kpiLabel: { fontSize: Typography.xs, color: Colors.textMuted, textAlign: 'center' },

  row3: { flexDirection: 'row', gap: Spacing.sm },
  notifCard: {
    flex: 1, backgroundColor: Colors.card, borderRadius: Radius.md,
    padding: Spacing.sm, alignItems: 'center', gap: 4,
    borderTopWidth: 3, ...Shadow.sm,
  },
  notifValue: { fontSize: Typography.xl, fontWeight: Typography.bold },
  notifLabel: { fontSize: Typography.xs, color: Colors.textMuted },

  sectionHeader: {
    fontSize: Typography.xs, fontWeight: Typography.semibold,
    color: Colors.textMuted, letterSpacing: 1,
  },

  card: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, gap: Spacing.sm, ...Shadow.sm,
  },
  rowLine: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: Spacing.xs, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  rowLabel: { fontSize: Typography.sm, color: Colors.textSecondary },
  rowVal:   { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary },

  eventRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingVertical: Spacing.xs, borderBottomWidth: 1, borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  eventLeft:   { flex: 1 },
  eventAction: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },
  eventMeta:   { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },
  eventTime:   { fontSize: Typography.xs, color: Colors.textMuted, flexShrink: 0 },
  empty:       { fontSize: Typography.sm, color: Colors.textMuted, textAlign: 'center', paddingVertical: Spacing.md },
});
