import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-gifted-charts';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader } from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { HorizontalExpenseChart } from '../../components/BarChart';
import { KpiCard } from '../../components/KpiCard';
import { useProcurementDashboard, useProcurementExecutiveDashboard } from '../../hooks/useProcurementDashboard';
import { useSupplierIntelligenceDashboard } from '../../hooks/useProcurementIntelligence';
import { useAuth } from '../../hooks/useAuth';
import { ProcurementStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

const CHART_W = 300;

// Phase 5A — compact trend-line card, mirrors reports/ExecutiveScreen.tsx's
// TrendCard (area LineChart, delta badge) — the proven pattern in this
// codebase for a single-series monthly trend, reused rather than duplicated.
function TrendMiniCard({ title, rows, valueKey, color = Colors.navy }: {
  title: string; rows: Array<Record<string, unknown>>; valueKey: string; color?: string;
}) {
  const vals = rows.map((r) => ({ value: Number(r[valueKey] ?? 0) }));
  if (vals.length < 2) return <Text style={{ fontSize: Typography.xs, color: Colors.textMuted, fontStyle: 'italic' }}>Not enough data yet.</Text>;
  const last = vals[vals.length - 1].value;
  const prev = vals[vals.length - 2].value;
  const delta = prev > 0 ? (((last - prev) / prev) * 100).toFixed(1) : null;
  const up = last >= prev;
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <Text style={{ fontSize: Typography.xs, color: Colors.textMuted }}>{title}</Text>
        {delta !== null ? (
          <Text style={{ fontSize: Typography.xs, fontWeight: Typography.semibold, color: up ? Colors.success : Colors.error }}>
            {up ? '▲' : '▼'} {Math.abs(Number(delta))}%
          </Text>
        ) : null}
      </View>
      <LineChart
        data={vals} width={CHART_W} height={50} hideDataPoints color={color} thickness={2}
        hideYAxisText hideAxesAndRules areaChart startFillColor={color + '22'} endFillColor={color + '00'}
        curved noOfSections={3} initialSpacing={0} endSpacing={0}
      />
    </View>
  );
}

type NavProp = NativeStackNavigationProp<ProcurementStackParamList, 'ProcurementDashboard'>;

const SHORTCUTS: Array<{ label: string; icon: keyof typeof Ionicons.glyphMap; screen: keyof ProcurementStackParamList }> = [
  { label: 'Requisitions', icon: 'file-tray-outline', screen: 'RequisitionsList' },
  { label: 'Suppliers', icon: 'business-outline', screen: 'SuppliersList' },
  { label: 'Compare Suppliers', icon: 'git-compare-outline', screen: 'SupplierComparison' },
  { label: 'RFQs', icon: 'document-text-outline', screen: 'RfqList' },
  { label: 'Purchase Orders', icon: 'cart-outline', screen: 'PurchaseOrdersList' },
  { label: 'Goods Receipts', icon: 'cube-outline', screen: 'GoodsReceiptList' },
  { label: 'Invoices', icon: 'receipt-outline', screen: 'InvoicesList' },
  { label: 'Reports', icon: 'bar-chart-outline', screen: 'ProcurementReports' },
  { label: 'Supplier Relationships', icon: 'people-circle-outline', screen: 'SrmDashboard' },
];

const TIER_COLOR: Record<string, string> = { Excellent: Colors.success, Good: Colors.navy, Average: Colors.warning, 'High Risk': Colors.error };

export function ProcurementDashboardScreen() {
  const navigation = useNavigation<NavProp>();
  const { role } = useAuth();
  const canManageSettings = role === 'admin' || role === 'ceo';
  const { data, isLoading, isError, refetch } = useProcurementDashboard();
  const { data: intel, isLoading: intelLoading, isError: intelError, refetch: refetchIntel } = useSupplierIntelligenceDashboard();
  const { data: exec, isLoading: execLoading, isError: execError, refetch: refetchExec } = useProcurementExecutiveDashboard();

  if (isLoading || !data) return <LoadingState message="Loading dashboard…" fullScreen />;
  if (isError) return <ErrorState message="Could not load dashboard" onRetry={refetch} fullScreen />;

  const pendingRequisitions = data.requisitionsByStatus.find((r) => r.status === 'in_approval')?.n ?? 0;
  const openPos = data.posByStatus.filter((r) => ['issued', 'acknowledged', 'partially_received'].includes(r.status)).reduce((sum, r) => sum + r.n, 0);
  const pendingInvoices = data.invoicesByStatus.filter((r) => ['pending_match', 'disputed'].includes(r.status)).reduce((sum, r) => sum + r.n, 0);
  const kpis = intel?.kpis;
  const spendChartData = (intel?.spendDistribution ?? []).map((s) => ({ label: s.name, value: s.value }));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader
        title="Procurement"
        dark
        actions={canManageSettings ? [{ icon: 'settings-outline', onPress: () => navigation.navigate('ProcurementSettings') }] : []}
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.statsRow}>
          <View style={styles.statTile}><Text style={styles.statValue}>{pendingRequisitions}</Text><Text style={styles.statLabel}>Pending Approvals</Text></View>
          <View style={styles.statTile}><Text style={styles.statValue}>{openPos}</Text><Text style={styles.statLabel}>Open POs</Text></View>
          <View style={styles.statTile}><Text style={styles.statValue}>{pendingInvoices}</Text><Text style={styles.statLabel}>Invoices to Review</Text></View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statTileAlt}><Text style={styles.statValueAlt}>{data.goodsReceiptsLast7Days}</Text><Text style={styles.statLabelAlt}>Receipts (7 days)</Text></View>
        </View>

        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Supplier Intelligence</Text>
          <TouchableOpacity onPress={() => navigation.navigate('SuppliersList')}><Text style={styles.linkText}>View Suppliers →</Text></TouchableOpacity>
        </View>
        {intelLoading ? (
          <View style={styles.statsRow}><View style={styles.statTileAlt}><Text style={styles.statLabelAlt}>Loading…</Text></View></View>
        ) : intelError || !kpis ? (
          <ErrorState message="Could not load supplier intelligence" onRetry={refetchIntel} />
        ) : (
          <>
            <View style={styles.statsRow}>
              <KpiCard variant="tile" tileSize="md" title="Total" value={kpis.totalSuppliers} />
              <KpiCard variant="tile" tileSize="md" title="Active" value={kpis.activeSuppliers} />
              <KpiCard variant="tile" tileSize="md" title="Preferred" value={kpis.preferredSuppliers} />
              <KpiCard variant="tile" tileSize="md" title="Blacklisted" value={kpis.blacklistedSuppliers} danger={kpis.blacklistedSuppliers > 0} />
            </View>
            <View style={styles.statsRow}>
              <KpiCard variant="tile" tileSize="md" title="High Risk" value={kpis.highRiskSuppliers} danger={kpis.highRiskSuppliers > 0} />
              <KpiCard variant="tile" tileSize="md" title="Contracts Exp." value={kpis.contractsExpiring} warn={kpis.contractsExpiring > 0} />
              <KpiCard variant="tile" tileSize="md" title="Avg Score" value={kpis.averageSupplierScore} />
              <KpiCard variant="tile" tileSize="md" style={{ flex: 1.4 }} valueStyle={{ fontSize: Typography.base }} title="Total Spend" value={Number(kpis.totalProcurementSpend).toLocaleString()} />
            </View>

            {intel && intel.topPerformers.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Top Performing Suppliers</Text>
                <View style={styles.divider} />
                {intel.topPerformers.slice(0, 5).map((s, i) => (
                  <View key={s.id} style={[styles.perfRow, i > 0 && styles.rowDivider]}>
                    <Text style={styles.perfName} numberOfLines={1}>{s.name}{s.preferred ? ' ★' : ''}</Text>
                    <Text style={[styles.perfScore, { color: TIER_COLOR[s.tier] ?? Colors.textPrimary }]}>{s.score}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {intel && intel.highRiskSuppliers.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>High Risk Suppliers</Text>
                <View style={styles.divider} />
                {intel.highRiskSuppliers.slice(0, 5).map((s, i) => (
                  <View key={s.id} style={[i > 0 && styles.rowDivider, { paddingVertical: Spacing.xs }]}>
                    <View style={styles.perfRow}>
                      <Text style={styles.perfName} numberOfLines={1}>{s.name}</Text>
                      <Text style={[styles.perfScore, { color: Colors.error }]}>{s.score}</Text>
                    </View>
                    <Text style={styles.riskIssue} numberOfLines={2}>{s.primaryIssue}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Contract Summary</Text>
              <View style={styles.divider} />
              <View style={styles.statsRow}>
                <View style={styles.contractStat}><Text style={[styles.perfScore, { color: Colors.success }]}>{intel?.contractSummary.active ?? 0}</Text><Text style={styles.statLabelAlt}>Active</Text></View>
                <View style={styles.contractStat}><Text style={[styles.perfScore, { color: Colors.warning }]}>{intel?.contractSummary.expiringSoon ?? 0}</Text><Text style={styles.statLabelAlt}>Expiring</Text></View>
                <View style={styles.contractStat}><Text style={[styles.perfScore, { color: Colors.error }]}>{intel?.contractSummary.expired ?? 0}</Text><Text style={styles.statLabelAlt}>Expired</Text></View>
              </View>
            </View>

            {spendChartData.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Spend Distribution</Text>
                <View style={styles.divider} />
                <HorizontalExpenseChart data={spendChartData} width={280} />
              </View>
            ) : null}
          </>
        )}

        <Text style={styles.sectionTitle}>Procurement Analytics</Text>
        {execLoading ? (
          <View style={styles.statsRow}><View style={styles.statTileAlt}><Text style={styles.statLabelAlt}>Loading…</Text></View></View>
        ) : execError || !exec ? (
          <ErrorState message="Could not load procurement analytics" onRetry={refetchExec} />
        ) : (
          <>
            <View style={styles.statsRow}>
              <View style={[styles.statTileAlt, { flex: 1.3 }]}><Text style={[styles.statValueAlt, { fontSize: Typography.base }]}>{exec.kpis.totalSpend.toLocaleString()}</Text><Text style={styles.statLabelAlt}>Total Spend</Text></View>
              <View style={styles.statTileAlt}><Text style={styles.statValueAlt}>{exec.kpis.activeContracts}</Text><Text style={styles.statLabelAlt}>Active Contracts</Text></View>
              <View style={styles.statTileAlt}><Text style={styles.statValueAlt}>{exec.kpis.purchaseOrders}</Text><Text style={styles.statLabelAlt}>Purchase Orders</Text></View>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statTileAlt}><Text style={styles.statValueAlt}>{exec.kpis.avgProcurementCycleDays}d</Text><Text style={styles.statLabelAlt}>Avg Cycle</Text></View>
              <View style={styles.statTileAlt}><Text style={styles.statValueAlt}>{exec.kpis.avgApprovalDays}d</Text><Text style={styles.statLabelAlt}>Avg Approval</Text></View>
              <View style={styles.statTileAlt}><Text style={styles.statValueAlt}>{exec.kpis.budgetUtilization.utilizationPct}%</Text><Text style={styles.statLabelAlt}>Budget Used</Text></View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Estimated Budget Utilization</Text>
              <View style={styles.divider} />
              <View style={styles.statsRow}>
                <View style={styles.contractStat}><Text style={[styles.perfScore, { fontSize: Typography.sm }]}>{exec.kpis.budgetUtilization.estimatedBudget.toLocaleString()}</Text><Text style={styles.statLabelAlt}>Estimated</Text></View>
                <View style={styles.contractStat}><Text style={[styles.perfScore, { fontSize: Typography.sm }]}>{exec.kpis.budgetUtilization.actualSpend.toLocaleString()}</Text><Text style={styles.statLabelAlt}>Actual</Text></View>
                <View style={styles.contractStat}><Text style={[styles.perfScore, { fontSize: Typography.sm, color: exec.kpis.budgetUtilization.variance >= 0 ? Colors.success : Colors.error }]}>{exec.kpis.budgetUtilization.variance >= 0 ? '+' : ''}{exec.kpis.budgetUtilization.variance.toLocaleString()}</Text><Text style={styles.statLabelAlt}>Variance</Text></View>
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Planning Savings</Text>
                <Text style={[styles.perfScore, { fontSize: Typography.md, color: exec.kpis.planningSavings.total >= 0 ? Colors.success : Colors.error }]}>
                  {exec.kpis.planningSavings.total >= 0 ? '+' : ''}{exec.kpis.planningSavings.total.toLocaleString()}
                </Text>
              </View>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Negotiation Savings</Text>
                <Text style={[styles.perfScore, { fontSize: Typography.md, color: exec.kpis.negotiationSavings.total >= 0 ? Colors.success : Colors.error }]}>
                  {exec.kpis.negotiationSavings.total >= 0 ? '+' : ''}{exec.kpis.negotiationSavings.total.toLocaleString()}
                </Text>
              </View>
            </View>

            <View style={styles.card}>
              <TrendMiniCard title="Monthly Spend Trend" rows={exec.charts.monthlySpendTrend} valueKey="total" />
            </View>
            <View style={styles.card}>
              <TrendMiniCard title="Procurement Cycle Trend (days)" rows={exec.charts.procurementCycleTrend} valueKey="avgDays" color={Colors.warning} />
            </View>

            {exec.charts.departmentSpend.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Department Spend</Text>
                <View style={styles.divider} />
                <HorizontalExpenseChart data={exec.charts.departmentSpend.map((d) => ({ label: d.department, value: d.total }))} width={280} />
              </View>
            ) : null}
            {exec.charts.workshopSpend.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Workshop Spend</Text>
                <View style={styles.divider} />
                <HorizontalExpenseChart data={exec.charts.workshopSpend.map((w) => ({ label: w.workshop, value: w.total }))} width={280} />
              </View>
            ) : null}
            {exec.charts.approvalTimeline.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Approval Timeline (avg days/stage)</Text>
                <View style={styles.divider} />
                <HorizontalExpenseChart data={exec.charts.approvalTimeline.map((a) => ({ label: a.stage.replace('_', ' '), value: a.avgDays }))} width={280} />
              </View>
            ) : null}
          </>
        )}

        <Text style={styles.sectionTitle}>Quick Access</Text>
        <View style={styles.grid}>
          {SHORTCUTS.map((s) => (
            <TouchableOpacity key={s.screen} style={styles.gridItem} onPress={() => navigation.navigate(s.screen as any)}>
              <Ionicons name={s.icon} size={22} color={Colors.navy} />
              <Text style={styles.gridLabel}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {data.recentActivity.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Recent Activity</Text>
            <View style={styles.divider} />
            {data.recentActivity.slice(0, 10).map((a, i) => (
              <View key={`${a.kind}-${a.id}`} style={[styles.activityRow, i > 0 && styles.rowDivider]}>
                <Text style={styles.activityLabel} numberOfLines={1}>{a.ref ?? '—'} · {a.label}</Text>
                <Text style={styles.activityMeta}>{a.status}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.xxxl },
  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  statTile: { flex: 1, backgroundColor: Colors.navy, borderRadius: Radius.lg, padding: Spacing.sm, alignItems: 'center' },
  statValue: { color: Colors.white, fontSize: Typography.lg, fontWeight: Typography.bold },
  statLabel: { color: 'rgba(255,255,255,0.7)', fontSize: Typography.xs, marginTop: 2, textAlign: 'center' },
  statTileAlt: { flex: 1, backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.sm, alignItems: 'center', ...Shadow.sm },
  statValueAlt: { color: Colors.textPrimary, fontSize: Typography.lg, fontWeight: Typography.bold },
  statValueWarn: { color: Colors.warning },
  statValueDanger: { color: Colors.error },
  statLabelAlt: { color: Colors.textMuted, fontSize: Typography.xs, marginTop: 2, textAlign: 'center' },
  sectionTitle: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: Spacing.xs },
  sectionTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.xs },
  linkText: { fontSize: Typography.xs, color: Colors.navy, fontWeight: Typography.medium },
  perfRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.xs, gap: Spacing.sm },
  perfName: { flex: 1, fontSize: Typography.sm, color: Colors.textPrimary },
  perfScore: { fontSize: Typography.base, fontWeight: Typography.bold },
  riskIssue: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: -2 },
  contractStat: { flex: 1, alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  gridItem: { width: '31%', backgroundColor: Colors.card, borderRadius: Radius.md, padding: Spacing.sm, alignItems: 'center', gap: 6, ...Shadow.sm },
  gridLabel: { fontSize: Typography.xs, color: Colors.textPrimary, textAlign: 'center', fontWeight: Typography.medium },
  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, ...Shadow.sm },
  cardTitle: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.sm },
  divider: { height: 1, backgroundColor: Colors.divider, marginBottom: Spacing.sm },
  rowDivider: { borderTopWidth: 1, borderTopColor: Colors.divider },
  activityRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.xs, gap: Spacing.sm },
  activityLabel: { fontSize: Typography.sm, color: Colors.textPrimary, flex: 1 },
  activityMeta: { fontSize: Typography.xs, color: Colors.textMuted },
});
