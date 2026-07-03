import React from 'react';
import {
  StyleSheet, View, Text, FlatList,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { StatusBar }      from 'expo-status-bar';
import { Ionicons }       from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader }     from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { useEpmDepartments } from '../../hooks/useEpm';
import type { ReportsStackParamList } from '../../navigation/types';
import type { PerformanceKpi, KpiStatus } from '../../types/api';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type Nav   = NativeStackNavigationProp<ReportsStackParamList>;
type Props = NativeStackScreenProps<ReportsStackParamList, 'EpmDepartmentKpis'>;

const STATUS_COLOR: Record<KpiStatus, string> = {
  'on-track':  Colors.success,
  'at-risk':   Colors.warning,
  'off-track': Colors.error,
  'no-data':   Colors.textMuted,
};
const STATUS_BG: Record<KpiStatus, string> = {
  'on-track':  Colors.successBg,
  'at-risk':   Colors.warningBg,
  'off-track': Colors.errorBg,
  'no-data':   Colors.bg,
};

const TREND_ICON = { up: 'trending-up', stable: 'remove', down: 'trending-down' } as const;
const TREND_COLOR = { up: Colors.success, stable: Colors.textMuted, down: Colors.error };

function AchBar({ pct }: { pct: number | null }) {
  const w = Math.min(100, Math.max(0, pct || 0));
  const c = w >= 90 ? Colors.success : w >= 70 ? Colors.warning : Colors.error;
  return (
    <View style={ab.row}>
      <View style={ab.track}>
        <View style={[ab.fill, { width: `${w}%` as any, backgroundColor: c }]} />
      </View>
      <Text style={[ab.label, { color: c }]}>{w}%</Text>
    </View>
  );
}
const ab = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  track: { flex: 1, height: 5, backgroundColor: Colors.border, borderRadius: 2.5, overflow: 'hidden' },
  fill:  { height: '100%', borderRadius: 2.5 },
  label: { fontSize: 10, fontWeight: '700', width: 28, textAlign: 'right' },
});

function KpiRow({ item }: { item: PerformanceKpi }) {
  const sc = item.status as KpiStatus;
  const tr = item.trend as keyof typeof TREND_ICON;
  return (
    <View style={s.row}>
      <View style={s.rowTop}>
        <Text style={s.kpiName} numberOfLines={1}>{item.name}</Text>
        <View style={[s.statusBadge, { backgroundColor: STATUS_BG[sc] }]}>
          <Text style={[s.statusText, { color: STATUS_COLOR[sc] }]}>
            {item.status.replace('-', ' ')}
          </Text>
        </View>
      </View>
      {item.description ? (
        <Text style={s.kpiDesc} numberOfLines={1}>{item.description}</Text>
      ) : null}
      <View style={s.rowStats}>
        <Text style={s.statLabel}>Current</Text>
        <Text style={s.statValue}>
          {item.current !== null ? Number(item.current).toLocaleString() : '—'} {item.unit}
        </Text>
        <Text style={s.statLabel}>Target</Text>
        <Text style={s.statValue}>{Number(item.target).toLocaleString()} {item.unit}</Text>
        <Ionicons name={TREND_ICON[tr] || 'remove'} size={14} color={TREND_COLOR[tr] || Colors.textMuted} />
      </View>
      <AchBar pct={item.achievement} />
      <Text style={s.freq}>{item.review_freq}</Text>
    </View>
  );
}

export function EpmDepartmentKpisScreen() {
  const navigation = useNavigation<Nav>();
  const route      = useRoute<Props['route']>();
  const { department } = route.params;

  const { data: res, isLoading, isRefetching, refetch } = useEpmDepartments();

  const deptData = res?.ok ? res.scorecards.find(d => d.department === department) : null;

  if (isLoading) {
    return (
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <AppHeader title={department} onBack={() => navigation.goBack()} />
        <View style={s.center}><ActivityIndicator color={Colors.navy} /></View>
      </SafeAreaView>
    );
  }

  const kpis = deptData?.kpis || [];

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader
        title={department}
        subtitle={deptData ? `Score: ${deptData.score} · ${kpis.length} KPIs` : undefined}
        onBack={() => navigation.goBack()}
      />
      <FlatList
        data={kpis}
        keyExtractor={k => k.kpi_key}
        renderItem={({ item }) => <KpiRow item={item} />}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="ribbon-outline" size={32} color={Colors.textMuted} />
            <Text style={s.emptyText}>No KPIs for this department.</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: Spacing.xs }} />}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list:   { padding: Spacing.base, paddingBottom: Spacing.xxxl },

  row:     { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: 5, ...Shadow.sm },
  rowTop:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kpiName: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary, flex: 1, marginRight: Spacing.xs },
  kpiDesc: { fontSize: 10, color: Colors.textMuted },
  statusBadge:{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: '700' },
  rowStats:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  statLabel:  { fontSize: 10, color: Colors.textMuted },
  statValue:  { fontSize: 11, fontWeight: Typography.semibold, color: Colors.textPrimary },
  freq:       { fontSize: 10, color: Colors.textMuted, textAlign: 'right' },

  empty:     { alignItems: 'center', gap: Spacing.sm, paddingTop: 64 },
  emptyText: { fontSize: Typography.sm, color: Colors.textMuted },
});
