import React from 'react';
import { StyleSheet, View, Text, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }     from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { LoadingState }  from '../../components/LoadingState';
import { ErrorState }    from '../../components/ErrorState';
import { useFinanceDashboard } from '../../hooks/useFinance';
import { FinanceCenterStackParamList } from '../../navigation/types';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<FinanceCenterStackParamList, 'FinanceDashboard'>;

function Tile({ label, value, sub }: { label: string; value: string; sub?: string | null }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue} numberOfLines={1}>{value}</Text>
      {sub ? <Text style={styles.tileSub} numberOfLines={2}>{sub}</Text> : null}
    </View>
  );
}

// Finance Enterprise Phase 2 — mobile Dashboard. Every figure is the exact
// same financeDashboard() aggregation the desktop Finance Control Center
// reads — no separate mobile calculation.
export function FinanceDashboardScreen() {
  const navigation = useNavigation<NavProp>();
  const { data, isLoading, isError, refetch, isRefetching } = useFinanceDashboard();

  if (isLoading) return <LoadingState message="Loading finance overview…" fullScreen />;
  if (isError || !data) return <ErrorState message="Could not load finance dashboard" onRetry={refetch} fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader
        title="Finance"
        dark
        actions={[
          { icon: 'checkmark-done-outline', label: 'Approvals', onPress: () => navigation.navigate('FinanceApprovals') },
          { icon: 'cube-outline', label: 'Inventory', onPress: () => navigation.navigate('FinanceInventory') },
          { icon: 'clipboard-outline', label: 'Stock Counts', onPress: () => navigation.navigate('FinanceStockCounts') },
          { icon: 'alert-circle-outline', label: 'Exceptions', onPress: () => navigation.navigate('FinanceExceptions') },
        ]}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.navy} />}
      >
        {data.profitability.dataQualityWarning ? (
          <View style={styles.warningBanner}>
            <Text style={styles.warningText}>{data.profitability.dataQualityWarning}</Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Revenue</Text>
        <View style={styles.grid}>
          <Tile label="Today" value={formatCurrency(data.revenue.today)} />
          <Tile label="This Month" value={formatCurrency(data.revenue.month)} />
          <Tile label="Year to Date" value={formatCurrency(data.revenue.yearToDate)} />
          <Tile label="Awaiting Review" value={formatNumber(data.revenue.salesAwaitingReview)} />
        </View>

        <Text style={styles.sectionTitle}>Costs</Text>
        <View style={styles.grid}>
          <Tile label="Procurement (Month)" value={formatCurrency(data.costs.procurementMonth)} />
          <Tile
            label="Maintenance + Fuel (Month)"
            value={formatCurrency(data.costs.maintenanceMonth)}
            sub={data.costs.fleetCostScope === 'company-wide' ? 'Company-wide — no workshop dimension' : null}
          />
          <Tile label="Payroll (Month)" value={formatCurrency(data.costs.payrollMonth)} />
          <Tile label="Inventory Value" value={formatCurrency(data.costs.inventoryValue)} />
        </View>

        <Text style={styles.sectionTitle}>Profitability</Text>
        <View style={styles.grid}>
          <Tile
            label="Gross Margin (Month)"
            value={formatCurrency(data.profitability.grossMargin)}
            sub={data.profitability.grossMarginPct != null ? `${data.profitability.grossMarginPct}% of revenue` : null}
          />
        </View>

        <Text style={styles.sectionTitle}>Outstanding</Text>
        <View style={styles.grid}>
          <Tile label="Customer (AR)" value={data.outstanding.customerOutstanding != null ? formatCurrency(data.outstanding.customerOutstanding) : '—'} />
          <Tile label="Supplier (AP)" value={data.outstanding.supplierOutstanding != null ? formatCurrency(data.outstanding.supplierOutstanding) : '—'} />
          <Tile label="Pending Approvals" value={formatNumber(data.outstanding.pendingFinancialApprovals)} />
        </View>

        <Text style={styles.sectionTitle}>Exceptions This Month</Text>
        <View style={styles.grid}>
          <Tile label="Missing Cost Items" value={formatNumber(data.exceptions.missingCostInfoItems)} />
          <Tile label="Rejected" value={formatNumber(data.exceptions.rejectedThisMonth)} />
          <Tile label="Returned" value={formatNumber(data.exceptions.returnedForCorrectionThisMonth)} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.base, gap: Spacing.md, paddingBottom: Spacing.xxxl },
  sectionTitle: {
    fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.6, marginTop: Spacing.sm,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  tile: {
    flexBasis: '47%', flexGrow: 1,
    backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.sm,
  },
  tileLabel: { fontSize: Typography.xs, color: Colors.textMuted },
  tileValue: { fontSize: Typography.md, fontWeight: Typography.bold, color: Colors.textPrimary, marginTop: 2 },
  tileSub:   { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },
  warningBanner: {
    backgroundColor: Colors.warningBg, borderRadius: Radius.md, padding: Spacing.md,
  },
  warningText: { fontSize: Typography.sm, color: Colors.warning },
});
