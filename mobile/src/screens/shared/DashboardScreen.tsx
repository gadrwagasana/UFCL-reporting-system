import React from 'react';
import {
  StyleSheet, View, Text, ScrollView, RefreshControl, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useQuery } from '@tanstack/react-query';
import { AppHeader }    from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState }   from '../../components/ErrorState';
import { KpiCard }      from '../../components/KpiCard';
import { AlertsPanel }  from '../../components/AlertsPanel';
import { PendingActionItem } from '../../components/PendingActionItem';
import { RecentRow }    from '../../components/RecentRow';
import { StackedProductionChart, HorizontalExpenseChart } from '../../components/BarChart';
import { get }           from '../../api/client';
import { EP }            from '../../api/endpoints';
import { useAuthStore }  from '../../stores/authStore';
import { DashboardStats } from '../../types/dashboard';
import { formatCurrency, formatNumber, formatDate } from '../../utils/formatters';
import { resolveActionRoute } from '../../utils/actionRoutes';
import { Colors, Spacing, TextStyles, Radius, Shadow } from '../../theme';
import { useNavigation } from '@react-navigation/native';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH  = SCREEN_WIDTH - (Spacing.base * 2) - (Spacing.base * 2);

export function DashboardScreen() {
  const isOfflineSession = useAuthStore((s) => s.isOfflineSession);
  const navigation = useNavigation<any>();

  const { data, isLoading, isError, isRefetching, refetch } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn:  () => get<DashboardStats>(EP.DASHBOARD_STATS),
    staleTime: 30_000,
  });

  if (isLoading) {
    return <LoadingState message="Loading dashboard…" fullScreen />;
  }

  if (isError || !data) {
    return <ErrorState message="Could not load dashboard" onRetry={refetch} fullScreen />;
  }

  const { greeting, date, alerts, stock, production, sales, expenses, activity, pending } = data;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Dashboard" dark />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />
        }
      >
        {isOfflineSession && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineBannerText}>Offline Mode — Data from last sync</Text>
          </View>
        )}

        {/* Hero greeting */}
        <View style={styles.heroCard}>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.heroDate}>{date}</Text>
        </View>

        {/* Alerts */}
        <AlertsPanel
          alerts={alerts}
          onPress={(type) => {
            // ERP Remaining Departments Completion Program — 'ChangeRequestList'
            // is not a registered route anywhere (the real screen name is
            // 'Changes'); this tile silently failed to navigate on tap.
            if (type === 'pending_changes') navigation.navigate('Changes');
          }}
        />

        {/* Stock */}
        <Text style={styles.sectionTitle}>Stock</Text>
        <KpiCard
          title="Timber Stock"
          value={formatNumber(stock.timberStock)}
          icon="layers-outline"
          color={Colors.navy}
          subtitle={`Produced ${formatNumber(stock.timberProduced)} · Sold ${formatNumber(stock.timberSold)}`}
        />
        <KpiCard
          title="Poles Stock"
          value={formatNumber(stock.polesStock)}
          icon="podium-outline"
          color={Colors.green}
          subtitle={`Produced ${formatNumber(stock.polesProduced)} · Sold ${formatNumber(stock.polesSold)}`}
        />

        {/* Production */}
        <Text style={styles.sectionTitle}>Production — {data.month}</Text>
        <KpiCard
          title="Timber Units"
          value={formatNumber(production.thisMonth.timber)}
          icon="construct-outline"
          color={Colors.navy}
          trend={production.trend.timber}
        />
        <KpiCard
          title="Poles Units"
          value={formatNumber(production.thisMonth.poles)}
          icon="podium-outline"
          color={Colors.green}
          trend={production.trend.poles}
        />

        {production.daily7.length > 0 && (
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Last 7 Days</Text>
            <StackedProductionChart
              chartWidth={CHART_WIDTH}
              data={production.daily7.map((d) => ({
                label:       formatDate(d.log_date, 'dd/MM'),
                timberUnits: d.timber_units,
                polesUnits:  d.poles_units,
              }))}
            />
          </View>
        )}

        {/* Sales */}
        <Text style={styles.sectionTitle}>Sales — {data.month}</Text>
        <KpiCard
          title="Revenue"
          value={formatCurrency(sales.thisMonth.revenue, sales.thisMonth.currency)}
          icon="cash-outline"
          color={Colors.orange}
          subtitle={`${sales.thisMonth.orders} orders · ${formatNumber(sales.thisMonth.qty)} units`}
        />

        {sales.recent.length > 0 && (
          <View style={styles.listCard}>
            {sales.recent.map((row) => (
              <RecentRow
                key={row.id}
                id={row.id}
                left={`${row.customer_name} — ${row.order_number}`}
                sub={`${row.product_type} ${row.product_size}`}
                right={formatCurrency(row.quantity * row.unit_price, row.currency)}
                iconType="sales_order"
              />
            ))}
          </View>
        )}

        {/* Expenses */}
        <Text style={styles.sectionTitle}>Expenses — {data.month}</Text>
        <KpiCard
          title="Total Expenses"
          value={formatCurrency(expenses.thisMonth, expenses.currency)}
          icon="wallet-outline"
          color={Colors.error}
        />
        {expenses.byCategory.length > 0 && (
          <View style={styles.chartCard}>
            <HorizontalExpenseChart
              width={CHART_WIDTH}
              data={expenses.byCategory.map((c) => ({ label: c.name, value: c.total }))}
            />
          </View>
        )}

        {/* Pending actions */}
        {pending.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Pending Actions</Text>
            {pending.map((item) => (
              <PendingActionItem
                key={item.id}
                item={item}
                onPress={(p) => {
                  const resolved = resolveActionRoute(p.action);
                  if (resolved) navigation.navigate(resolved.route, resolved.params);
                }}
              />
            ))}
          </>
        )}

        {/* Recent activity */}
        {activity.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <View style={styles.listCard}>
              {activity.map((row) => (
                <RecentRow
                  key={row.id}
                  id={row.id}
                  left={row.description}
                  sub={`${row.user_name} · ${row.time}`}
                  iconType={row.type}
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.base, paddingBottom: Spacing.xxxl },

  offlineBanner: {
    backgroundColor: Colors.warningBg, borderRadius: Radius.md, padding: Spacing.md,
    marginBottom: Spacing.base,
  },
  offlineBannerText: {
    ...TextStyles.captionMedium, color: Colors.warning,
  },

  heroCard: {
    backgroundColor: Colors.navy, borderRadius: Radius.xl,
    padding: Spacing.xl, ...Shadow.md, marginBottom: Spacing.base,
  },
  greeting: { ...TextStyles.heading, color: Colors.textOnDark },
  heroDate: { ...TextStyles.caption, color: Colors.textOnDarkMuted, marginTop: Spacing.xxs },

  sectionTitle: {
    ...TextStyles.label,
    color: Colors.textMuted,
    marginTop: Spacing.base,
    marginBottom: Spacing.sm,
  },

  chartCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, ...Shadow.sm, marginBottom: Spacing.sm,
  },
  chartTitle: {
    ...TextStyles.captionMedium, color: Colors.textMuted, marginBottom: Spacing.sm,
  },

  listCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.md, ...Shadow.sm, marginBottom: Spacing.sm,
  },
});
