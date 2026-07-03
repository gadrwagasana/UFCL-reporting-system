import React from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { StatusBar }      from 'expo-status-bar';
import { Ionicons }       from '@expo/vector-icons';
import { useNavigation }  from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }      from '../../components/AppHeader';
import { OfflineBanner }  from '../../components/OfflineBanner';
import { useEpmDashboard } from '../../hooks/useEpm';
import type { ReportsStackParamList } from '../../navigation/types';
import type { ExecDimension, RagStatus } from '../../types/api';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type Nav = NativeStackNavigationProp<ReportsStackParamList>;

const RAG_COLOR: Record<RagStatus, string> = {
  green: Colors.success,
  amber: Colors.warning,
  red:   Colors.error,
};
const RAG_BG: Record<RagStatus, string> = {
  green: Colors.successBg,
  amber: Colors.warningBg,
  red:   Colors.errorBg,
};

function RagBadge({ status }: { status: RagStatus }) {
  const label = status === 'green' ? 'On Track' : status === 'amber' ? 'At Risk' : 'Off Track';
  return (
    <View style={[rb.wrap, { backgroundColor: RAG_BG[status] }]}>
      <Text style={[rb.text, { color: RAG_COLOR[status] }]}>{label}</Text>
    </View>
  );
}
const rb = StyleSheet.create({
  wrap: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  text: { fontSize: 10, fontWeight: '700' },
});

function ScoreCircle({ score, size = 56 }: { score: number; size?: number }) {
  const color = score >= 80 ? Colors.success : score >= 60 ? Colors.warning : Colors.error;
  return (
    <View style={[sc.circle, { width: size, height: size, borderRadius: size / 2, borderColor: color }]}>
      <Text style={[sc.num, { color, fontSize: size * 0.34 }]}>{score}</Text>
    </View>
  );
}
const sc = StyleSheet.create({
  circle: { borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  num:    { fontWeight: Typography.bold, lineHeight: undefined },
});

function DimensionRow({ d }: { d: ExecDimension }) {
  const color = RAG_COLOR[d.status] || Colors.textMuted;
  return (
    <View style={s.dimRow}>
      <View style={[s.dimDot, { backgroundColor: color }]} />
      <View style={s.dimBody}>
        <Text style={s.dimName}>{d.name}</Text>
        <Text style={s.dimDetail} numberOfLines={1}>{d.detail}</Text>
      </View>
      <ScoreCircle score={d.score} size={40} />
    </View>
  );
}

export function EpmHomeScreen() {
  const navigation = useNavigation<Nav>();
  const { data: res, isLoading, isRefetching, refetch } = useEpmDashboard();

  if (isLoading) {
    return (
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <AppHeader title="Enterprise Performance" onBack={() => navigation.goBack()} />
        <View style={s.center}><ActivityIndicator color={Colors.navy} /></View>
      </SafeAreaView>
    );
  }

  if (!res?.ok) {
    return (
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <AppHeader title="Enterprise Performance" onBack={() => navigation.goBack()} />
        <View style={s.center}>
          <Text style={s.errText}>{(res as any)?.error || 'Load failed'}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => refetch()}>
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const { summary: sm, executive: exec } = res;
  const scoreColor = sm.company_score >= 80 ? Colors.success : sm.company_score >= 60 ? Colors.warning : Colors.error;
  const scoreStatus = sm.company_score >= 80 ? 'Strong' : sm.company_score >= 60 ? 'Moderate' : 'Critical';

  const navCards = [
    { title: 'Department Scorecards', sub: `${sm.departments} departments`, icon: 'business-outline' as const,    screen: 'EpmDepartments' as keyof ReportsStackParamList, color: '#7C3AED' },
    { title: 'KPI Dashboard',         sub: `${sm.total_kpis} KPIs tracked`, icon: 'target-outline' as never,      screen: 'EpmKpis' as keyof ReportsStackParamList,        color: Colors.navy },
    { title: 'Action Plans',          sub: `${sm.open_plans} open`,          icon: 'list-outline' as const,        screen: 'EpmActionPlans' as keyof ReportsStackParamList,  color: Colors.warning },
    { title: 'Performance Trends',    sub: '6 trend series',                 icon: 'trending-up-outline' as const, screen: 'EpmTrends' as keyof ReportsStackParamList,      color: Colors.success },
  ];

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader
        title="Enterprise Performance"
        subtitle={sm.period}
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
      >

        {/* Company Score Hero */}
        <View style={s.hero}>
          <View style={s.heroLeft}>
            <Text style={[s.heroScore, { color: scoreColor }]}>{sm.company_score}</Text>
            <Text style={[s.heroStatus, { color: scoreColor }]}>{scoreStatus}</Text>
          </View>
          <View style={s.heroRight}>
            <Text style={s.heroTitle}>Company Performance Score</Text>
            <View style={s.heroCountRow}>
              <View style={s.heroCount}>
                <Text style={[s.heroCountNum, { color: Colors.success }]}>{sm.on_track}</Text>
                <Text style={s.heroCountLbl}>On Track</Text>
              </View>
              <View style={s.heroDivider} />
              <View style={s.heroCount}>
                <Text style={[s.heroCountNum, { color: Colors.warning }]}>{sm.at_risk}</Text>
                <Text style={s.heroCountLbl}>At Risk</Text>
              </View>
              <View style={s.heroDivider} />
              <View style={s.heroCount}>
                <Text style={[s.heroCountNum, { color: Colors.error }]}>{sm.off_track}</Text>
                <Text style={s.heroCountLbl}>Off Track</Text>
              </View>
            </View>
            <Text style={s.heroMeta}>
              {sm.total_kpis} KPIs · {sm.departments} depts · {sm.open_plans} open plans
            </Text>
          </View>
        </View>

        {/* Executive Scorecard */}
        {exec && (
          <View style={s.card}>
            <View style={s.cardHeader}>
              <Text style={s.cardTitle}>Executive Scorecard</Text>
              <View style={s.cardHeaderRight}>
                <RagBadge status={exec.overall.status} />
                <Text style={s.overallScore}>{exec.overall.score}</Text>
              </View>
            </View>
            {exec.dimensions.map((d, i) => (
              <DimensionRow key={i} d={d} />
            ))}
          </View>
        )}

        {/* Navigation Cards */}
        <Text style={s.sectionLabel}>SECTIONS</Text>
        {navCards.map(c => (
          <TouchableOpacity
            key={c.screen}
            style={s.navCard}
            onPress={() => navigation.navigate(c.screen as any)}
            activeOpacity={0.75}
          >
            <View style={[s.navIcon, { backgroundColor: c.color + '1A' }]}>
              <Ionicons name={c.icon} size={22} color={c.color} />
            </View>
            <View style={s.navBody}>
              <Text style={s.navTitle}>{c.title}</Text>
              <Text style={s.navSub}>{c.sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  errText:  { fontSize: Typography.sm, color: Colors.error, textAlign: 'center' },
  retryBtn: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs, backgroundColor: Colors.navy, borderRadius: Radius.md },
  retryText:{ color: '#fff', fontSize: Typography.sm, fontWeight: Typography.semibold },

  hero:         { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, flexDirection: 'row', gap: Spacing.md, alignItems: 'center', ...Shadow.sm },
  heroLeft:     { alignItems: 'center', minWidth: 68 },
  heroScore:    { fontSize: 52, fontWeight: Typography.bold, lineHeight: 56 },
  heroStatus:   { fontSize: 11, fontWeight: Typography.semibold, textTransform: 'uppercase', letterSpacing: 0.5 },
  heroRight:    { flex: 1 },
  heroTitle:    { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary, marginBottom: Spacing.xs },
  heroCountRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 4 },
  heroCount:    { alignItems: 'center' },
  heroCountNum: { fontSize: Typography.lg, fontWeight: Typography.bold },
  heroCountLbl: { fontSize: 9, color: Colors.textMuted, textTransform: 'uppercase' },
  heroDivider:  { width: 1, height: 24, backgroundColor: Colors.border },
  heroMeta:     { fontSize: Typography.xs, color: Colors.textMuted },

  card:       { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, ...Shadow.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  cardTitle:  { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary },
  cardHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  overallScore: { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.textPrimary },

  dimRow:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  dimDot:    { width: 7, height: 7, borderRadius: 4, flexShrink: 0 },
  dimBody:   { flex: 1 },
  dimName:   { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary },
  dimDetail: { fontSize: 10, color: Colors.textMuted, marginTop: 1 },

  sectionLabel: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.textMuted, letterSpacing: 1 },
  navCard:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, ...Shadow.sm },
  navIcon:  { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  navBody:  { flex: 1 },
  navTitle: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  navSub:   { fontSize: Typography.sm, color: Colors.textSecondary, marginTop: 1 },
});
