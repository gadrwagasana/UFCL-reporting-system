import React from 'react';
import {
  StyleSheet, View, Text, ScrollView, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { AppHeader }    from '../../components/AppHeader';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState }   from '../../components/ErrorState';
import { OfflineBanner } from '../../components/OfflineBanner';
import { KpiCard }      from '../../components/KpiCard';
import { RecentRow }    from '../../components/RecentRow';
import { get }          from '../../api/client';
import { EP }           from '../../api/endpoints';
import { useAuthStore } from '../../stores/authStore';
import { LogisticsDashboard } from '../../types/dashboard';
import { Colors, Spacing, TextStyles, Radius, Shadow } from '../../theme';
import { formatNumber } from '../../utils/formatters';

export function LogisticsDashboardScreen() {
  const user = useAuthStore((s) => s.user);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery<LogisticsDashboard>({
    queryKey: ['logistics-dashboard'],
    queryFn:  () => get<LogisticsDashboard>(EP.LOGISTICS_DASHBOARD),
    staleTime: 30_000,
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Warehouse Overview" subtitle={user?.name ?? ''} />

      {isLoading ? (
        <LoadingState message="Loading warehouse data…" fullScreen />
      ) : isError || !data ? (
        <ErrorState message="Could not load warehouse data" onRetry={refetch} fullScreen />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Workshops */}
          <Text style={styles.sectionTitle}>Workshops</Text>
          {data.workshops.length === 0 ? (
            <Text style={styles.emptyText}>No workshops found.</Text>
          ) : (
            data.workshops.map((w) => (
              <KpiCard
                key={w.id}
                title={w.name}
                value={formatNumber(w.item_count)}
                icon="business-outline"
                color={Colors.navy}
                subtitle={`${w.location} · ${formatNumber(w.total_qty)} units`}
              />
            ))
          )}

          {/* Low stock alerts */}
          {data.lowStock.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Low Stock</Text>
              <View style={styles.listCard}>
                {data.lowStock.map((s, i) => (
                  <View key={`${s.name}-${i}`} style={styles.lowStockRow}>
                    <Ionicons name="alert-circle-outline" size={18} color={Colors.warning} />
                    <View style={styles.lowStockContent}>
                      <Text style={styles.lowStockName}>{s.name}</Text>
                      <Text style={styles.lowStockSub}>
                        {s.warehouse_name} · {formatNumber(s.total_stock)} / {formatNumber(s.min_stock)} {s.uom}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Month totals */}
          {data.monthTotals.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>This Month</Text>
              {data.monthTotals.map((t) => (
                <KpiCard
                  key={t.movement_type}
                  title={t.movement_type === 'in' ? 'Stock In' : 'Stock Out'}
                  value={formatNumber(t.count)}
                  icon={t.movement_type === 'in' ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'}
                  color={t.movement_type === 'in' ? Colors.green : Colors.orange}
                  subtitle={`${formatNumber(t.total_qty)} units`}
                />
              ))}
            </>
          )}

          {/* Recent movements */}
          {data.activity.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Recent Movements</Text>
              <View style={styles.listCard}>
                {data.activity.map((row) => (
                  <RecentRow
                    key={row.id}
                    id={row.id}
                    left={row.item_name}
                    sub={`${row.workshop_name} · ${row.user_name}`}
                    right={`${row.type === 'stock_movement_in' ? '+' : '-'}${formatNumber(row.quantity)}`}
                    iconType={row.type}
                  />
                ))}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.base, paddingBottom: Spacing.xxxl },

  sectionTitle: {
    ...TextStyles.label,
    color: Colors.textMuted,
    marginTop: Spacing.base,
    marginBottom: Spacing.sm,
  },

  emptyText: {
    ...TextStyles.body,
    color: Colors.textMuted,
  },

  listCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.md, ...Shadow.sm, marginBottom: Spacing.sm,
  },

  lowStockRow: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  lowStockContent: {
    flex: 1,
  },
  lowStockName: {
    ...TextStyles.body,
    color: Colors.textPrimary,
  },
  lowStockSub: {
    ...TextStyles.caption,
    color:     Colors.textMuted,
    marginTop: 1,
  },
});
