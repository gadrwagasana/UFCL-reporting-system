import React from 'react';
import {
  StyleSheet, View, Text, ScrollView,
  RefreshControl, ActivityIndicator, Dimensions,
} from 'react-native';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { StatusBar }     from 'expo-status-bar';
import { Ionicons }      from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LineChart }     from 'react-native-gifted-charts';
import { AppHeader }    from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { useEpmTrends } from '../../hooks/useEpm';
import type { ReportsStackParamList } from '../../navigation/types';
import type { TrendPoint } from '../../types/api';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type Nav = NativeStackNavigationProp<ReportsStackParamList>;

const CHART_W = Dimensions.get('window').width - Spacing.base * 2 - Spacing.base * 2;

type TrendKey = 'revenue' | 'production' | 'harvest' | 'fuel' | 'stock' | 'approvals';

interface TrendMeta {
  key:   TrendKey;
  title: string;
  icon:  string;
  color: string;
  unit:  string;
}

function useTrendData() {
  const { data: res, isLoading, isRefetching, refetch } = useEpmTrends();
  return { trends: res?.ok ? res.trends : null, isLoading, isRefetching, refetch };
}

const TREND_META: TrendMeta[] = [
  { key: 'revenue',    title: 'Revenue',          icon: 'cash-outline',       color: Colors.success, unit: 'ETB' },
  { key: 'production', title: 'Production Output', icon: 'hammer-outline',     color: Colors.navy,    unit: 'units' },
  { key: 'harvest',    title: 'Harvest Volume',    icon: 'leaf-outline',       color: '#15803D',      unit: 'm³' },
  { key: 'fuel',       title: 'Fuel Consumption',  icon: 'flash-outline',      color: Colors.warning, unit: 'L' },
  { key: 'stock',      title: 'Stock Value',       icon: 'cube-outline',       color: Colors.info,    unit: 'ETB' },
  { key: 'approvals',  title: 'Approvals Cycle',   icon: 'checkmark-circle-outline', color: '#7C3AED', unit: 'days' },
];

function ChartCard({ rows, meta }: { rows: TrendPoint[]; meta: TrendMeta }) {
  const vals = rows.map(r => ({ value: Number(r.value ?? 0) }));
  const latest = rows.length ? rows[rows.length - 1] : null;
  return (
    <View style={s.card}>
      <View style={s.cardHead}>
        <View style={[s.iconWrap, { backgroundColor: meta.color + '1A' }]}>
          <Ionicons name={meta.icon as never} size={16} color={meta.color} />
        </View>
        <View style={s.headText}>
          <Text style={s.cardTitle}>{meta.title}</Text>
          {latest && (
            <Text style={s.latestVal}>
              {Number(latest.value).toLocaleString()} {meta.unit}
            </Text>
          )}
        </View>
        <Text style={s.periodCount}>{rows.length} periods</Text>
      </View>

      {vals.length > 1 ? (
        <View style={s.chartWrap}>
          <LineChart
            data={vals}
            width={CHART_W}
            height={70}
            hideDataPoints
            color={meta.color}
            thickness={2}
            hideYAxisText
            hideAxesAndRules
            areaChart
            startFillColor={meta.color + '22'}
            endFillColor={meta.color + '00'}
            curved
            noOfSections={3}
            initialSpacing={0}
            endSpacing={0}
          />
        </View>
      ) : (
        <View style={s.noChart}>
          <Text style={s.noChartText}>Not enough data points</Text>
        </View>
      )}

      {/* Period labels: first and last */}
      {rows.length >= 2 && (
        <View style={s.periodRow}>
          <Text style={s.periodLabel}>{rows[0].period}</Text>
          <Text style={s.periodLabel}>{rows[rows.length - 1].period}</Text>
        </View>
      )}
    </View>
  );
}

export function EpmTrendsScreen() {
  const navigation = useNavigation<Nav>();
  const { trends, isLoading, isRefetching, refetch } = useTrendData();

  if (isLoading) {
    return (
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <AppHeader title="Performance Trends" onBack={() => navigation.goBack()} />
        <View style={s.center}><ActivityIndicator color={Colors.navy} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Performance Trends" onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
      >
        {trends ? (
          TREND_META.map(meta => (
            <ChartCard
              key={meta.key}
              rows={trends[meta.key] || []}
              meta={meta}
            />
          ))
        ) : (
          <View style={s.empty}>
            <Ionicons name="trending-up-outline" size={32} color={Colors.textMuted} />
            <Text style={s.emptyText}>Trend data unavailable.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },

  card:    { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, ...Shadow.sm },
  cardHead:{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  iconWrap:{ width: 36, height: 36, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  headText:{ flex: 1 },
  cardTitle:{ fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary },
  latestVal:{ fontSize: Typography.xs, color: Colors.textSecondary, marginTop: 1 },
  periodCount:{ fontSize: 10, color: Colors.textMuted },

  chartWrap:{ marginHorizontal: -Spacing.base + Spacing.xs },
  noChart:  { height: 70, alignItems: 'center', justifyContent: 'center' },
  noChartText: { fontSize: Typography.xs, color: Colors.textMuted },
  periodRow:{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  periodLabel: { fontSize: 9, color: Colors.textMuted },

  empty:     { alignItems: 'center', gap: Spacing.sm, paddingTop: 64 },
  emptyText: { fontSize: Typography.sm, color: Colors.textMuted },
});
