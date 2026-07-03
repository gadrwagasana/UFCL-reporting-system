import React, { useState, useMemo } from 'react';
import {
  StyleSheet, View, Text, FlatList, TouchableOpacity,
  TextInput, ScrollView, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { StatusBar }     from 'expo-status-bar';
import { Ionicons }      from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }    from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { useEpmDashboard } from '../../hooks/useEpm';
import type { ReportsStackParamList } from '../../navigation/types';
import type { PerformanceKpi, KpiStatus } from '../../types/api';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type Nav = NativeStackNavigationProp<ReportsStackParamList>;

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
      <Text style={[ab.pct, { color: c }]}>{w}%</Text>
    </View>
  );
}
const ab = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  track: { flex: 1, height: 5, backgroundColor: Colors.border, borderRadius: 2.5, overflow: 'hidden' },
  fill:  { height: '100%', borderRadius: 2.5 },
  pct:   { fontSize: 10, fontWeight: '700', width: 28, textAlign: 'right' },
});

type StatusFilter = 'all' | KpiStatus;

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'on-track',  label: 'On Track' },
  { key: 'at-risk',   label: 'At Risk' },
  { key: 'off-track', label: 'Off Track' },
  { key: 'no-data',   label: 'No Data' },
];

function KpiRow({ item }: { item: PerformanceKpi }) {
  const sc = item.status as KpiStatus;
  const tr = item.trend as keyof typeof TREND_ICON;
  return (
    <View style={s.row}>
      <View style={s.rowTop}>
        <View style={s.rowLeft}>
          <Text style={s.kpiName} numberOfLines={1}>{item.name}</Text>
          <Text style={s.deptTag}>{item.department}</Text>
        </View>
        <View style={[s.statusBadge, { backgroundColor: STATUS_BG[sc] }]}>
          <Text style={[s.statusText, { color: STATUS_COLOR[sc] }]}>
            {item.status.replace('-', ' ')}
          </Text>
        </View>
      </View>
      <View style={s.rowStats}>
        <Text style={s.statLabel}>Current</Text>
        <Text style={s.statValue}>
          {item.current !== null ? Number(item.current).toLocaleString() : '—'} {item.unit}
        </Text>
        <Text style={s.statSep}>·</Text>
        <Text style={s.statLabel}>Target</Text>
        <Text style={s.statValue}>{Number(item.target).toLocaleString()} {item.unit}</Text>
        <View style={{ flex: 1 }} />
        <Ionicons
          name={TREND_ICON[tr] || 'remove'}
          size={14}
          color={TREND_COLOR[tr] || Colors.textMuted}
        />
      </View>
      <AchBar pct={item.achievement} />
    </View>
  );
}

export function EpmKpisScreen() {
  const navigation = useNavigation<Nav>();
  const { data: res, isLoading, isRefetching, refetch } = useEpmDashboard();

  const [search, setSearch]       = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const deptOptions = useMemo(() => {
    if (!res?.ok) return ['All'];
    const unique = Array.from(new Set(res.kpis.map(k => k.department))).sort();
    return ['All', ...unique];
  }, [res]);

  const filtered = useMemo(() => {
    if (!res?.ok) return [];
    return res.kpis.filter(k => {
      const matchSearch = !search || k.name.toLowerCase().includes(search.toLowerCase());
      const matchDept   = deptFilter === 'All' || k.department === deptFilter;
      const matchStatus = statusFilter === 'all' || k.status === statusFilter;
      return matchSearch && matchDept && matchStatus;
    });
  }, [res, search, deptFilter, statusFilter]);

  if (isLoading) {
    return (
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <AppHeader title="KPI Dashboard" onBack={() => navigation.goBack()} />
        <View style={s.center}><ActivityIndicator color={Colors.navy} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader
        title="KPI Dashboard"
        subtitle={`${filtered.length} KPIs`}
        onBack={() => navigation.goBack()}
      />

      {/* Search Bar */}
      <View style={s.searchWrap}>
        <Ionicons name="search-outline" size={16} color={Colors.textMuted} style={s.searchIcon} />
        <TextInput
          style={s.searchInput}
          placeholder="Search KPIs..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Department Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.chipScroll}
      >
        {deptOptions.map(d => (
          <TouchableOpacity
            key={d}
            style={[s.chip, deptFilter === d && s.chipActive]}
            onPress={() => setDeptFilter(d)}
          >
            <Text style={[s.chipText, deptFilter === d && s.chipTextActive]}>{d}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Status Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.chipScroll}
      >
        {STATUS_FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[s.chip, statusFilter === f.key && s.chipActive]}
            onPress={() => setStatusFilter(f.key)}
          >
            <Text style={[s.chipText, statusFilter === f.key && s.chipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={k => k.kpi_key}
        renderItem={({ item }) => <KpiRow item={item} />}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="ribbon-outline" size={32} color={Colors.textMuted} />
            <Text style={s.emptyText}>No KPIs match filters.</Text>
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

  searchWrap:  { flexDirection: 'row', alignItems: 'center', margin: Spacing.base, marginBottom: Spacing.xs, backgroundColor: Colors.card, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  searchIcon:  { marginRight: 4 },
  searchInput: { flex: 1, height: 38, fontSize: Typography.sm, color: Colors.textPrimary },

  chipScroll: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.xs, gap: Spacing.xs },
  chip:       { paddingHorizontal: Spacing.sm, paddingVertical: 5, borderRadius: 16, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipText:   { fontSize: 12, fontWeight: Typography.semibold, color: Colors.textSecondary },
  chipTextActive: { color: '#fff' },

  row:        { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: 5, ...Shadow.sm },
  rowTop:     { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  rowLeft:    { flex: 1, marginRight: Spacing.xs },
  kpiName:    { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary },
  deptTag:    { fontSize: 10, color: Colors.textMuted, marginTop: 1 },
  statusBadge:{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: '700' },
  rowStats:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statLabel:  { fontSize: 10, color: Colors.textMuted },
  statValue:  { fontSize: 11, fontWeight: Typography.semibold, color: Colors.textPrimary },
  statSep:    { fontSize: 10, color: Colors.border },

  empty:     { alignItems: 'center', gap: Spacing.sm, paddingTop: 64 },
  emptyText: { fontSize: Typography.sm, color: Colors.textMuted },
});
