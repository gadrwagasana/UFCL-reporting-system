import React from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { AppHeader }    from '../../components/AppHeader';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState }   from '../../components/ErrorState';
import { OfflineBanner } from '../../components/OfflineBanner';
import { get }          from '../../api/client';
import { EP }           from '../../api/endpoints';
import { useAuthStore } from '../../stores/authStore';
import { CeoTabParamList } from '../../navigation/types';
import { CeoOverview } from '../../types/api';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';
import { formatNumber } from '../../utils/formatters';

type CeoTabNav = BottomTabNavigationProp<CeoTabParamList>;

interface KpiCardProps { label: string; value: string; icon: string; color: string; }
function KpiCard({ label, value, icon, color }: KpiCardProps) {
  return (
    <View style={[styles.kpiCard, { borderLeftColor: color }]}>
      <Ionicons name={icon as any} size={28} color={color} />
      <View style={styles.kpiText}>
        <Text style={styles.kpiValue}>{value}</Text>
        <Text style={styles.kpiLabel}>{label}</Text>
      </View>
    </View>
  );
}

export function CeoOverviewScreen() {
  const user       = useAuthStore((s) => s.user);
  const navigation = useNavigation<CeoTabNav>();

  const { data, isLoading, isError, refetch, isRefetching } = useQuery<CeoOverview>({
    queryKey: ['ceo-overview'],
    queryFn:  () => get<CeoOverview>(EP.CEO_OVERVIEW),
    staleTime: 5 * 60_000,
  });

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
      ) : isError ? (
        <ErrorState message="Could not load overview" onRetry={refetch} fullScreen />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.greeting}>Good morning, {user?.name?.split(' ')[0] ?? 'CEO'}</Text>

          {/* Alert banner — pending poles requests */}
          {(data?.pendingPolesRequests ?? 0) > 0 ? (
            <TouchableOpacity
              style={styles.alertBanner}
              onPress={() => navigation.navigate('CeoApprovals')}
              activeOpacity={0.8}
            >
              <Ionicons name="alert-circle" size={18} color={Colors.warning} />
              <Text style={styles.alertText}>
                {data?.pendingPolesRequests} poles purchase request{data?.pendingPolesRequests !== 1 ? 's' : ''} awaiting your approval
              </Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.warning} />
            </TouchableOpacity>
          ) : null}

          {/* Alert banner — pending monthly approval */}
          {data?.pendingMonthlyApproval ? (
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

          {/* KPI cards */}
          <Text style={styles.sectionTitle}>Today's Production</Text>
          <View style={styles.kpiGrid}>
            <KpiCard
              label="Logs Harvested"
              value={formatNumber(data?.harvest?.log_count)}
              icon="leaf"
              color={Colors.green}
            />
            <KpiCard
              label="Trees Felled"
              value={formatNumber(data?.harvest?.total_trees)}
              icon="leaf-outline"
              color={Colors.green}
            />
            <KpiCard
              label="Timber Volume (m³)"
              value={formatNumber(data?.sawmill?.volume_m3, 2)}
              icon="construct"
              color={Colors.navy}
            />
            <KpiCard
              label="Poles Produced"
              value={formatNumber(data?.poles?.total_units)}
              icon="podium"
              color={Colors.orange}
            />
          </View>

          <Text style={styles.sectionTitle}>Sales</Text>
          <View style={styles.kpiGrid}>
            <KpiCard
              label="Orders"
              value={formatNumber(data?.sales?.total_orders)}
              icon="receipt"
              color={Colors.navy}
            />
            <KpiCard
              label="Revenue (ETB)"
              value={formatNumber(data?.sales?.total_revenue, 0)}
              icon="cash"
              color={Colors.green}
            />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.xxxl },
  greeting: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warningBg,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  alertText: {
    flex: 1,
    fontSize: Typography.sm,
    color: Colors.warning,
    fontWeight: Typography.medium,
  },
  sectionTitle: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: Spacing.sm,
  },
  kpiGrid: { gap: Spacing.sm },
  kpiCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderLeftWidth: 4,
    ...Shadow.sm,
  },
  kpiText:  { flex: 1 },
  kpiValue: { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.textPrimary },
  kpiLabel: { fontSize: Typography.sm, color: Colors.textMuted, marginTop: 2 },
});
