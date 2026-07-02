import React from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }     from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { useAuthStore }  from '../../stores/authStore';
import { hasPermission } from '../../utils/permissions';
import type { UserRole } from '../../types/auth';
import { useAutomationDashboard, useAutomationRun } from '../../hooks/useAutomation';
import { AdminStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type Nav = NativeStackNavigationProp<AdminStackParamList>;

function fmtAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1)    return 'just now';
  if (mins < 60)   return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

function ActivityChart({ data }: { data: { day: string; count: number }[] }) {
  const days: { label: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d   = new Date(Date.now() - i * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    const hit = data.find(x => x.day === key);
    days.push({
      label: d.toLocaleDateString('en-GB', { weekday: 'short' }),
      count: Number(hit?.count) || 0,
    });
  }
  const maxC = Math.max(...days.map(d => d.count), 1);
  return (
    <View style={chart.row}>
      {days.map((d, i) => (
        <View key={i} style={chart.col}>
          {d.count > 0 && <Text style={chart.count}>{d.count}</Text>}
          <View style={[chart.bar, {
            height: Math.max(4, Math.round((d.count / maxC) * 56)),
            backgroundColor: d.count > 0 ? '#3B82F6' : '#E5E7EB',
          }]} />
          <Text style={chart.label}>{d.label}</Text>
        </View>
      ))}
    </View>
  );
}
const chart = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 72, paddingTop: 16 },
  col:   { flex: 1, alignItems: 'center', gap: 2 },
  bar:   { width: '100%', borderRadius: 2 },
  label: { fontSize: 9, color: Colors.textMuted, marginTop: 3 },
  count: { fontSize: 9, color: '#1D4ED8', fontWeight: '600' },
});

export function AutomationHomeScreen() {
  const navigation = useNavigation<Nav>();
  const role       = useAuthStore(s => s.user?.role as UserRole | undefined);
  const { data: res, isLoading, isRefetching, refetch } = useAutomationDashboard();
  const runMutation = useAutomationRun();

  const canRun      = role && hasPermission(role, 'automation.run');
  const canEditRules = role && hasPermission(role, 'automation.edit_rules');

  function handleRunNow() {
    Alert.alert('Run Automation Now', 'Trigger an immediate automation pass?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Run Now',
        onPress: () => {
          runMutation.mutate(undefined, {
            onSuccess: (r: any) => {
              if (r?.ok) Alert.alert('Triggered', r.message || 'Automation check triggered.');
              else Alert.alert('Error', r?.error || 'Failed to trigger.');
            },
            onError: () => Alert.alert('Error', 'Network error.'),
          });
        },
      },
    ]);
  }

  if (isLoading) {
    return (
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <AppHeader title="Automation Center" onBack={() => navigation.goBack()} />
        <View style={s.center}>
          <ActivityIndicator color={Colors.navy} />
          <Text style={s.loadingText}>Loading automation data…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!res?.ok) {
    return (
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <AppHeader title="Automation Center" onBack={() => navigation.goBack()} />
        <View style={s.center}>
          <Ionicons name="alert-circle" size={32} color={Colors.error} />
          <Text style={s.errorText}>{(res as any)?.error || 'Load failed'}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => refetch()}>
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const { summary: sm, scheduler: sch, activity_by_day, escalations } = res;
  const levelCounts = escalations?.level_counts || {} as Record<string, number>;
  const recentRuns  = sch.recent_runs?.slice(0, 5) || [];
  const errRuns     = recentRuns.filter(r => r.errors > 0).length;
  const healthColor = recentRuns.length === 0 ? Colors.textMuted
    : errRuns === 0 ? Colors.success
    : errRuns < recentRuns.length / 2 ? Colors.warning
    : Colors.error;
  const healthText = recentRuns.length === 0 ? 'No data'
    : errRuns === 0 ? 'Healthy'
    : `${errRuns}/${recentRuns.length} ticks had errors`;

  const kpis = [
    { label: 'Rules Active',    value: `${sm.rules_enabled}/${sm.rules_total}`, sub: `${sm.rules_disabled} disabled`, color: sm.rules_disabled > 0 ? Colors.warning : Colors.success },
    { label: 'Escalations',     value: String(sm.active_escalations),          sub: `CEO:${levelCounts.ceo||0} Dir:${levelCounts.director||0}`, color: sm.active_escalations > 0 ? Colors.error : Colors.success },
    { label: 'Failed Jobs',     value: String(sm.failed_jobs),                 sub: `${sm.pending_jobs} pending`, color: sm.failed_jobs > 0 ? Colors.error : Colors.success },
    { label: 'Automations 24h', value: String(sm.automations_24h),             sub: `${sm.ticks_24h} ticks`, color: Colors.textPrimary },
  ];

  const navCards = [
    { title: 'Rules',       subtitle: `${sm.rules_enabled} active · ${sm.rules_disabled} disabled`, icon: 'hardware-chip' as const, color: '#2563EB',     screen: 'AutomationRules'       as keyof AdminStackParamList },
    { title: 'Escalations', subtitle: `${sm.active_escalations} active`,                            icon: 'arrow-up-circle' as const, color: sm.active_escalations > 0 ? Colors.error : Colors.textMuted, screen: 'AutomationEscalations' as keyof AdminStackParamList },
    { title: 'History',     subtitle: `${sm.automations_24h} events in 24h`,                       icon: 'time' as const,          color: Colors.success, screen: 'AutomationHistory'     as keyof AdminStackParamList },
    { title: 'Jobs',        subtitle: `${sm.pending_jobs} pending · ${sm.failed_jobs} failed`,     icon: 'play-circle' as const,   color: sm.failed_jobs > 0 ? Colors.error : Colors.navy, screen: 'AutomationJobs' as keyof AdminStackParamList },
  ];

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Automation Center" onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
      >
        {/* KPI row */}
        <View style={s.kpiRow}>
          {kpis.map((k, i) => (
            <View key={i} style={s.kpiCard}>
              <Text style={[s.kpiValue, { color: k.color }]}>{k.value}</Text>
              <Text style={s.kpiLabel}>{k.label}</Text>
              <Text style={s.kpiSub}>{k.sub}</Text>
            </View>
          ))}
        </View>

        {/* System status */}
        <View style={s.card}>
          <Text style={s.cardTitle}>System Status</Text>
          <View style={s.healthRow}>
            <View style={[s.healthDot, { backgroundColor: healthColor }]} />
            <Text style={[s.healthText, { color: healthColor }]}>{healthText}</Text>
          </View>
          <View style={s.metaGrid}>
            {[
              ['Interval',      '15 min'],
              ['Last Run',      fmtAgo(sch.last_automation)],
              ['Last Security', fmtAgo(sch.last_security)],
              ['Avg Tick',      sm.avg_tick_ms != null ? `${sm.avg_tick_ms}ms` : '—'],
            ].map(([label, value]) => (
              <View key={label} style={s.metaItem}>
                <Text style={s.metaLabel}>{label}</Text>
                <Text style={s.metaValue}>{value}</Text>
              </View>
            ))}
          </View>
          {recentRuns.length > 0 && (
            <>
              <Text style={s.sectionMini}>Recent Runs</Text>
              {recentRuns.map((r, i) => (
                <View key={i} style={s.runRow}>
                  <View style={[s.runDot, { backgroundColor: r.errors > 0 ? Colors.warning : Colors.success }]} />
                  <Text style={s.runTime}>{fmtAgo(r.started_at)}</Text>
                  <Text style={s.runDur}>{r.duration_ms != null ? `${r.duration_ms}ms` : '—'}</Text>
                  <Text style={[s.runErr, { color: r.errors > 0 ? Colors.error : Colors.textMuted }]}>
                    {r.errors > 0 ? `${r.errors} err` : '✓'}
                  </Text>
                </View>
              ))}
            </>
          )}
        </View>

        {/* Activity chart */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Automation Activity — Last 7 Days</Text>
          <ActivityChart data={activity_by_day || []} />
          <View style={s.levelRow}>
            {(['leader', 'manager', 'director', 'ceo'] as const).map(lvl => (
              <View key={lvl} style={s.levelItem}>
                <Text style={s.levelName}>{lvl.toUpperCase()}</Text>
                <Text style={[s.levelCount, { color: (levelCounts[lvl] || 0) > 0 ? Colors.error : Colors.textMuted }]}>
                  {levelCounts[lvl] || 0}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Run Now */}
        {canRun && (
          <TouchableOpacity
            style={[s.runBtn, runMutation.isPending && s.runBtnDisabled]}
            onPress={handleRunNow}
            disabled={runMutation.isPending}
            activeOpacity={0.8}
          >
            <Ionicons name="play" size={18} color="#fff" />
            <Text style={s.runBtnText}>{runMutation.isPending ? 'Running…' : 'Run Now'}</Text>
          </TouchableOpacity>
        )}

        {/* Nav cards */}
        <Text style={s.sectionLabel}>SECTIONS</Text>
        {navCards.map((c) => (
          <TouchableOpacity
            key={c.screen}
            style={s.navCard}
            onPress={() => navigation.navigate(c.screen as any)}
            activeOpacity={0.75}
          >
            <View style={[s.navIconBox, { backgroundColor: c.color + '1A' }]}>
              <Ionicons name={c.icon} size={24} color={c.color} />
            </View>
            <View style={s.navCardBody}>
              <Text style={s.navCardTitle}>{c.title}</Text>
              <Text style={s.navCardSub}>{c.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        ))}

        {!canEditRules && (
          <Text style={s.viewOnlyNote}>Rule editing requires admin or CEO role.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: Colors.bg },
  scroll:      { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  loadingText: { fontSize: Typography.sm, color: Colors.textSecondary, marginTop: Spacing.xs },
  errorText:   { fontSize: Typography.sm, color: Colors.error, textAlign: 'center', paddingHorizontal: Spacing.lg },
  retryBtn:    { marginTop: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs, backgroundColor: Colors.navy, borderRadius: Radius.md },
  retryText:   { color: '#fff', fontSize: Typography.sm, fontWeight: Typography.semibold },

  kpiRow:  { flexDirection: 'row', gap: Spacing.xs },
  kpiCard: { flex: 1, backgroundColor: Colors.card, borderRadius: Radius.md, padding: Spacing.sm, ...Shadow.sm, alignItems: 'center' },
  kpiValue:{ fontSize: Typography.base, fontWeight: Typography.bold },
  kpiLabel:{ fontSize: 9, color: Colors.textMuted, textAlign: 'center', marginTop: 2 },
  kpiSub:  { fontSize: 9, color: Colors.textMuted, textAlign: 'center' },

  card:      { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, ...Shadow.sm },
  cardTitle: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary, marginBottom: Spacing.sm },

  healthRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.sm },
  healthDot: { width: 10, height: 10, borderRadius: 5 },
  healthText:{ fontSize: Typography.sm, fontWeight: Typography.semibold },

  metaGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  metaItem:  { width: '47%' },
  metaLabel: { fontSize: 10, color: Colors.textMuted },
  metaValue: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary },

  sectionMini: { fontSize: 10, fontWeight: '600', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: Spacing.sm, marginBottom: 4 },
  runRow:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: Colors.border },
  runDot:      { width: 7, height: 7, borderRadius: 4 },
  runTime:     { flex: 1, fontSize: 11, color: Colors.textSecondary },
  runDur:      { fontSize: 11, color: Colors.textMuted, width: 52, textAlign: 'right' },
  runErr:      { fontSize: 11, width: 44, textAlign: 'right' },

  levelRow:  { flexDirection: 'row', justifyContent: 'space-around', marginTop: Spacing.sm },
  levelItem: { alignItems: 'center' },
  levelName: { fontSize: 9, color: Colors.textMuted, fontWeight: '600' },
  levelCount:{ fontSize: Typography.base, fontWeight: Typography.bold, marginTop: 2 },

  runBtn:         { backgroundColor: Colors.navy, borderRadius: Radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, padding: Spacing.sm },
  runBtnDisabled: { opacity: 0.6 },
  runBtnText:     { color: '#fff', fontSize: Typography.base, fontWeight: Typography.semibold },

  sectionLabel: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.textMuted, letterSpacing: 1 },
  navCard:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, ...Shadow.sm },
  navIconBox:   { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  navCardBody:  { flex: 1 },
  navCardTitle: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  navCardSub:   { fontSize: Typography.sm, color: Colors.textSecondary, marginTop: 1 },
  viewOnlyNote: { fontSize: Typography.xs, color: Colors.textMuted, textAlign: 'center', fontStyle: 'italic', marginTop: Spacing.sm },
});
