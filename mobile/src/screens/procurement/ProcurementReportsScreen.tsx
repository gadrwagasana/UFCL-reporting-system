import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, TextInput, Share, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader } from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { LoadingState } from '../../components/LoadingState';
import { HorizontalExpenseChart } from '../../components/BarChart';
import { FormSelect } from '../../components/FormSelect';
import { StatusBadge } from '../../components/StatusBadge';
import {
  useProcurementSpendReport, useProcurementSupplierPerfReport,
  useProcurementDeliveryPerfReport, useProcurementBudgetReport, useProcurementAnalytics,
  useProcurementExecutiveDashboard, useProcurementSpendBudgetAnalytics,
  useProcurementForecastingDashboard, useProcurementExecutiveReport,
  useProcurementAutomationDashboard, useProcurementTasks, useProcurementTaskActions,
  useProcurementEscalationActions,
  useProcurementPerformanceScorecard, useProcurementBuyerPerformance, useProcurementDepartmentPerformance,
  useProcurementWorkshopPerformance, useProcurementExecutivePerformance, useProcurementRiskMonitor,
} from '../../hooks/useProcurementDashboard';
import { useSupplierIntelligenceReport } from '../../hooks/useProcurementIntelligence';
import { useSrmReport } from '../../hooks/useSrm';
import { useProcurementRequisitionRevisionReports } from '../../hooks/useProcurementRequisitions';
import { useProcurementPoShortageReports } from '../../hooks/useProcurementOrders';
import { ProcurementStackParamList } from '../../navigation/types';
import type { SrmReportType, ProcurementExecReportType } from '../../types/api';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp = NativeStackNavigationProp<ProcurementStackParamList, 'ProcurementReports'>;

// Phase 5A — the pre-existing 'analytics' tab (cycle days/late deliveries/
// top products/rankings) is relabeled "Cycle & Products" — same tab key,
// same function, zero logic change — since "Analytics" is the more fitting
// name for the new executive tab ('executive').
type Tab = 'spend' | 'suppliers' | 'delivery' | 'budget' | 'executive' | 'budgetspend' | 'forecasting' | 'analytics' | 'intelligence' | 'srm' | 'automation' | 'performance' | 'revisions' | 'poShortages';
const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'spend', label: 'Spend' },
  { key: 'suppliers', label: 'Suppliers' },
  { key: 'delivery', label: 'Delivery' },
  { key: 'budget', label: 'Budget' },
  { key: 'executive', label: 'Analytics' },
  { key: 'budgetspend', label: 'Budget & Spend' },
  { key: 'forecasting', label: 'Forecasting & Reports' },
  { key: 'analytics', label: 'Cycle & Products' },
  { key: 'intelligence', label: 'Intelligence' },
  { key: 'srm', label: 'SRM' },
  // Phase 6 — Procurement Automation Engine
  { key: 'automation', label: 'Automation & Tasks' },
  // Phase 7 — Procurement Performance Management
  { key: 'performance', label: 'Performance' },
  // Procurement Exception Management Phase 2 — Return for Revision
  { key: 'revisions', label: 'Requisition Revisions' },
  // Procurement Exception Management Phase 3 — Close with Shortage
  { key: 'poShortages', label: 'PO Shortages' },
];

type PerfSubView = 'scorecard' | 'buyers' | 'departments' | 'workshops' | 'executive' | 'risk';
const PERF_SUBVIEWS: Array<{ key: PerfSubView; label: string }> = [
  { key: 'scorecard', label: 'Scorecard' }, { key: 'buyers', label: 'Buyers' },
  { key: 'departments', label: 'Departments' }, { key: 'workshops', label: 'Workshops' },
  { key: 'executive', label: 'Executive' }, { key: 'risk', label: 'Risk' },
];

function kpiUnitText(unit: string, v: number | null): string {
  if (v == null) return '—';
  if (unit === 'days') return `${v}d`;
  if (unit === 'currency') return v.toLocaleString();
  return `${v}`;
}

const TASK_CATEGORY_LABELS: Record<string, string> = {
  pending_approvals: 'Pending Approvals', rfqs: 'RFQs', purchase_orders: 'Purchase Orders',
  goods_receipts: 'Goods Receipts', supplier_invoices: 'Supplier Invoices', contracts: 'Contracts',
  compliance: 'Compliance', corrective_actions: 'Corrective Actions',
  improvement_plans: 'Improvement Plans', supplier_reviews: 'Supplier Reviews',
};

// Phase 5D — the 13 executive report types, all served by the one
// procurementExecutiveReport function.
const PROC_EXEC_REPORT_OPTIONS: Array<{ label: string; value: ProcurementExecReportType }> = [
  { label: 'Executive Procurement Summary', value: 'executive_summary' },
  { label: 'Procurement Spend Report', value: 'spend' },
  { label: 'Budget Utilization Report', value: 'budget_utilization' },
  { label: 'Procurement Forecast Report', value: 'forecast' },
  { label: 'Supplier Performance Report', value: 'supplier_performance' },
  { label: 'Supplier Spend Report', value: 'supplier_spend' },
  { label: 'Contract Performance Report', value: 'contract_performance' },
  { label: 'Department Spend Report', value: 'department_spend' },
  { label: 'Workshop Spend Report', value: 'workshop_spend' },
  { label: 'Procurement Savings Report', value: 'savings' },
  { label: 'Procurement KPI Report', value: 'kpi_report' },
  { label: 'Procurement Trend Report', value: 'trend_report' },
  { label: 'Executive Dashboard Report', value: 'executive_dashboard_report' },
];

// Phase 4 — the 7 SRM report types, all served by the one srmReport backend
// function. Row shapes differ per type, so the table below is rendered
// generically from whatever keys each row actually has.
const SRM_REPORT_OPTIONS: Array<{ label: string; value: SrmReportType }> = [
  { label: 'Contract Register', value: 'contract_register' },
  { label: 'Expiring Contracts', value: 'expiring_contracts' },
  { label: 'Compliance Status', value: 'compliance_status' },
  { label: 'Document Register', value: 'document_register' },
  { label: 'Communication Log', value: 'communication_log' },
  { label: 'Improvement Plans', value: 'improvement_plans' },
  { label: 'Executive Summary', value: 'executive_summary' },
];

// Phase 3C — the 9 executive report types, all served by the one
// procurementSupplierIntelligenceReports backend function.
const INTEL_REPORT_OPTIONS = [
  { label: 'Best Suppliers', value: 'best' },
  { label: 'Worst Suppliers', value: 'worst' },
  { label: 'Preferred Suppliers', value: 'preferred' },
  { label: 'High Risk Suppliers', value: 'high_risk' },
  { label: 'Blacklisted Suppliers', value: 'blacklisted' },
  { label: 'Highest Spend Suppliers', value: 'highest_spend' },
  { label: 'Most Reliable Suppliers', value: 'most_reliable' },
  { label: 'Lowest Performing Suppliers', value: 'lowest_performing' },
  { label: 'Inactive Suppliers', value: 'inactive' },
  { label: 'Contracts Near Expiry', value: 'contracts_near_expiry' },
];

function csvEscape(v: unknown): string {
  const s = String(v ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export function ProcurementReportsScreen() {
  const navigation = useNavigation<NavProp>();
  const [tab, setTab] = useState<Tab>('spend');
  const [intelType, setIntelType] = useState('best');
  const [srmType, setSrmType] = useState<SrmReportType>('contract_register');
  const [exporting, setExporting] = useState(false);

  const spend = useProcurementSpendReport();
  const supplierPerf = useProcurementSupplierPerfReport();
  const delivery = useProcurementDeliveryPerfReport();
  const budget = useProcurementBudgetReport();
  const analytics = useProcurementAnalytics();
  const exec = useProcurementExecutiveDashboard();
  const budgetSpend = useProcurementSpendBudgetAnalytics();
  const [bsSupplierSearch, setBsSupplierSearch] = useState('');
  const forecasting = useProcurementForecastingDashboard();
  const [pfxType, setPfxType] = useState<ProcurementExecReportType>('executive_summary');
  const pfxReport = useProcurementExecutiveReport(tab === 'forecasting' ? pfxType : null);
  const intelReport = useSupplierIntelligenceReport(intelType);
  const srmReport = useSrmReport(tab === 'srm' ? srmType : null);
  const automationDash = useProcurementAutomationDashboard();
  const tasks = useProcurementTasks({ status: 'open' });
  const taskActions = useProcurementTaskActions();
  const escalationActions = useProcurementEscalationActions();
  const [perfSub, setPerfSub] = useState<PerfSubView>('scorecard');
  const scorecard = useProcurementPerformanceScorecard();
  const buyers = useProcurementBuyerPerformance();
  const deptPerf = useProcurementDepartmentPerformance();
  const wsPerf = useProcurementWorkshopPerformance();
  const execPerf = useProcurementExecutivePerformance();
  const riskMonitor = useProcurementRiskMonitor();
  const revisionReports = useProcurementRequisitionRevisionReports();
  const poShortageReports = useProcurementPoShortageReports();

  async function exportIntelCsv() {
    const rows = intelReport.data?.rows ?? [];
    if (!rows.length) { Alert.alert('Nothing to export', 'This report has no rows yet.'); return; }
    setExporting(true);
    try {
      const header = 'Supplier,Score,Rating,Spend,Reject Rate %,On-Time %,Last Purchase,Primary Risk';
      const lines = [header, ...rows.map((s) => [
        csvEscape(s.name), s.overallScore, s.tier, s.totalSpend, s.rejectRatePct, s.onTimeRatePct ?? '',
        s.lastPurchaseDate ? new Date(s.lastPurchaseDate).toLocaleDateString() : '', csvEscape(s.riskIndicators[0] ?? ''),
      ].join(','))];
      await Share.share({ message: lines.join('\n'), title: `supplier_${intelType}.csv` });
    } catch (err: any) {
      if (err?.message !== 'User did not share') Alert.alert('Export failed', err?.message ?? 'Unknown error');
    } finally {
      setExporting(false);
    }
  }

  async function exportExecCsv() {
    if (!exec.data) { Alert.alert('Nothing to export', 'Analytics have not loaded yet.'); return; }
    setExporting(true);
    try {
      const k = exec.data.kpis;
      const lines = [
        'Metric,Value',
        `Total Procurement Spend,${k.totalSpend}`, `Spend This Month,${k.spendThisMonth}`,
        `Spend This Quarter,${k.spendThisQuarter}`, `Spend This Year,${k.spendThisYear}`,
        `Active Suppliers,${k.activeSuppliers}`, `Active Contracts,${k.activeContracts}`,
        `Purchase Orders,${k.purchaseOrders}`, `Goods Receipts,${k.goodsReceipts}`,
        `Avg Procurement Cycle (days),${k.avgProcurementCycleDays}`, `Avg Approval Time (days),${k.avgApprovalDays}`,
        `Estimated Budget,${k.budgetUtilization.estimatedBudget}`, `Actual Spend (Budget),${k.budgetUtilization.actualSpend}`,
        `Budget Utilization %,${k.budgetUtilization.utilizationPct}`, `Budget Variance,${k.budgetUtilization.variance}`,
        `Planning Savings,${k.planningSavings.total}`, `Negotiation Savings,${k.negotiationSavings.total}`,
        '', 'Month,Spend', ...exec.data.charts.monthlySpendTrend.map((x) => `${x.month},${x.total}`),
      ];
      await Share.share({ message: lines.join('\n'), title: `procurement_executive_analytics.csv` });
    } catch (err: any) {
      if (err?.message !== 'User did not share') Alert.alert('Export failed', err?.message ?? 'Unknown error');
    } finally {
      setExporting(false);
    }
  }

  async function exportBudgetSpendCsv() {
    if (!budgetSpend.data) { Alert.alert('Nothing to export', 'Analytics have not loaded yet.'); return; }
    setExporting(true);
    try {
      const d = budgetSpend.data;
      const k = d.kpis;
      const lines = [
        'Metric,Value',
        `Total Spend,${k.totalSpend}`, `Estimated Budget,${k.budgetUtilization.estimatedBudget}`, `Actual Spend,${k.budgetUtilization.actualSpend}`,
        `Budget Utilization %,${k.budgetUtilization.utilizationPct}`, `Procurement Variance,${k.budgetUtilization.variance}`,
        `Planning Savings,${k.planningSavings.total}`, `Negotiation Savings,${k.negotiationSavings.total}`,
        `Under Contract Spend,${d.contractSpendSplit.underContract}`, `Outside Contract Spend,${d.contractSpendSplit.outsideContract}`,
        '', 'Budget Code,Requisitions,Estimated,Actual,Variance,Utilization %',
        ...d.budgetByCode.map((x) => `${csvEscape(x.budgetCode)},${x.requisitions},${x.estimated},${x.actual},${x.variance},${x.utilizationPct}`),
        '', 'Department,Spend,Budget,Variance',
        ...d.departmentSpend.map((x) => `${csvEscape(x.department)},${x.total},${x.estimated},${x.variance}`),
        '', 'Workshop,Spend,Budget,Variance',
        ...d.workshopSpend.map((x) => `${csvEscape(x.workshop)},${x.total},${x.estimated},${x.variance}`),
        '', 'Supplier,Total Spend,This Month,Avg Order,Share %',
        ...d.supplierSpend.map((x) => `${csvEscape(x.name)},${x.totalSpend},${x.monthSpend},${x.avgOrder},${x.procurementSharePct}`),
        '', 'Contract,Supplier,Status,Value,Actual Spend,Utilization %,Indicator',
        ...d.contractUtilization.map((x) => `${csvEscape(x.contractRef)},${csvEscape(x.supplierName)},${x.status},${x.contractValue ?? ''},${x.actualSpend},${x.utilizationPct ?? ''},${x.indicator}`),
      ];
      await Share.share({ message: lines.join('\n'), title: 'procurement_budget_spend.csv' });
    } catch (err: any) {
      if (err?.message !== 'User did not share') Alert.alert('Export failed', err?.message ?? 'Unknown error');
    } finally {
      setExporting(false);
    }
  }

  async function exportPfxCsv() {
    const rows = pfxReport.data?.rows ?? [];
    if (!rows.length) { Alert.alert('Nothing to export', 'This report has no exportable rows (it is a summary-style report).'); return; }
    setExporting(true);
    try {
      const keys = Object.keys(rows[0]);
      const lines = [keys.join(','), ...rows.map((row) => keys.map((k) => csvEscape((row as Record<string, unknown>)[k])).join(','))];
      await Share.share({ message: lines.join('\n'), title: `procurement_${pfxType}.csv` });
    } catch (err: any) {
      if (err?.message !== 'User did not share') Alert.alert('Export failed', err?.message ?? 'Unknown error');
    } finally {
      setExporting(false);
    }
  }

  async function exportSrmCsv() {
    const rows = srmReport.data?.rows ?? [];
    if (!rows.length) { Alert.alert('Nothing to export', 'This report has no rows yet.'); return; }
    setExporting(true);
    try {
      const keys = Object.keys(rows[0]);
      const header = keys.join(',');
      const lines = [header, ...rows.map((r) => keys.map((k) => csvEscape((r as Record<string, unknown>)[k])).join(','))];
      await Share.share({ message: lines.join('\n'), title: `srm_${srmType}.csv` });
    } catch (err: any) {
      if (err?.message !== 'User did not share') Alert.alert('Export failed', err?.message ?? 'Unknown error');
    } finally {
      setExporting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader title="Procurement Reports" dark onBack={() => navigation.goBack()} />
      <View style={styles.tabBar}>
        {TABS.map((t) => (
          <TouchableOpacity key={t.key} style={[styles.tab, tab === t.key && styles.tabActive]} onPress={() => setTab(t.key)}>
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {tab === 'spend' && (
          spend.isLoading ? <LoadingState message="Loading…" /> : (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Spend by Supplier</Text>
              <View style={styles.divider} />
              {spend.data?.rows.length ? (
                <HorizontalExpenseChart data={spend.data.rows.slice(0, 8).map((r) => ({ label: r.supplier_name, value: Number(r.total_spend) }))} />
              ) : <Text style={styles.emptyText}>No spend data yet.</Text>}
              {spend.data?.rows.map((r, i) => (
                <View key={r.supplier_name} style={i > 0 ? styles.rowDivider : undefined}>
                  <Row label={r.supplier_name} value={`${r.po_count} POs · ${Number(r.total_spend).toLocaleString()}`} />
                </View>
              ))}
            </View>
          )
        )}

        {tab === 'suppliers' && (
          supplierPerf.isLoading ? <LoadingState message="Loading…" /> : (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Supplier Performance</Text>
              <View style={styles.divider} />
              {supplierPerf.data?.rows.map((r, i) => (
                <View key={r.id} style={i > 0 ? styles.rowDivider : undefined}>
                  <Row label={`${r.name}${r.preferred ? ' ★' : ''}${r.blacklisted ? ' (blacklisted)' : ''}`} value={`${r.total_pos} POs · ${r.total_rejected}/${r.total_received} rejected`} />
                  <Row label="Completed / Shortage / Fulfillment" value={`${r.orders_completed} / ${r.orders_closed_with_shortage} / ${r.avg_fulfillment_pct}%`} />
                </View>
              ))}
              {!supplierPerf.data?.rows.length ? <Text style={styles.emptyText}>No supplier activity yet.</Text> : null}
            </View>
          )
        )}

        {tab === 'delivery' && (
          delivery.isLoading ? <LoadingState message="Loading…" /> : (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Delivery Performance</Text>
              <View style={styles.divider} />
              {delivery.data?.rows.map((r, i) => (
                <View key={r.po_number} style={i > 0 ? styles.rowDivider : undefined}>
                  <Row label={`${r.po_number} · ${r.supplier_name}`} value={r.on_time === null ? 'Pending' : r.on_time ? 'On Time' : 'Late'} />
                </View>
              ))}
              {!delivery.data?.rows.length ? <Text style={styles.emptyText}>No delivery data yet.</Text> : null}
            </View>
          )
        )}

        {tab === 'budget' && (
          budget.isLoading ? <LoadingState message="Loading…" /> : (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Budget Utilization</Text>
              <View style={styles.divider} />
              {budget.data?.rows.map((r, i) => (
                <View key={r.budget_code} style={i > 0 ? styles.rowDivider : undefined}>
                  <Row label={r.budget_code} value={`${r.requisitions} req · ${Number(r.total_estimated).toLocaleString()}`} />
                </View>
              ))}
              {!budget.data?.rows.length ? <Text style={styles.emptyText}>No budget-coded requisitions yet.</Text> : null}
            </View>
          )
        )}

        {tab === 'revisions' && (
          revisionReports.isLoading || !revisionReports.data ? <LoadingState message="Loading…" /> : (() => {
            const d = revisionReports.data;
            const outcomeMap = Object.fromEntries(d.outcomeCounts.map((x) => [x.status, x.n]));
            return (
              <>
                <View style={styles.statsRow}>
                  <View style={styles.statTile}><Text style={[styles.statValue, { color: Colors.success }]}>{outcomeMap.approved || 0}</Text><Text style={styles.statLabel}>Approved</Text></View>
                  <View style={styles.statTile}><Text style={[styles.statValue, { color: Colors.error }]}>{outcomeMap.rejected || 0}</Text><Text style={styles.statLabel}>Rejected</Text></View>
                  <View style={styles.statTile}><Text style={[styles.statValue, { color: Colors.warning }]}>{outcomeMap.returned_for_revision || 0}</Text><Text style={styles.statLabel}>Returned</Text></View>
                </View>
                <View style={styles.statsRow}>
                  <View style={[styles.statTile, { flex: 1 }]}><Text style={styles.statValue}>{d.avgRevisionTimeHours.toFixed(1)}h</Text><Text style={styles.statLabel}>Avg. Revision Time</Text></View>
                </View>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Most Revised Requisitions</Text>
                  <View style={styles.divider} />
                  {d.revisionCount.map((x, i) => (
                    <View key={x.id} style={i > 0 ? styles.rowDivider : undefined}>
                      <Row label={`${x.requisition_number} — ${x.title}`} value={`${x.revision_count} rev.`} />
                    </View>
                  ))}
                  {!d.revisionCount.length ? <Text style={styles.emptyText}>No revisions yet.</Text> : null}
                </View>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Most Revised Departments</Text>
                  <View style={styles.divider} />
                  {d.mostRevisedDepartments.map((x, i) => (
                    <View key={x.department} style={i > 0 ? styles.rowDivider : undefined}>
                      <Row label={x.department} value={`${x.revisions} rev.`} />
                    </View>
                  ))}
                  {!d.mostRevisedDepartments.length ? <Text style={styles.emptyText}>No revisions yet.</Text> : null}
                </View>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Most Common Revision Reasons</Text>
                  <View style={styles.divider} />
                  {d.mostCommonRevisionReasons.map((x, i) => (
                    <View key={i} style={i > 0 ? styles.rowDivider : undefined}>
                      <Row label={x.reviewer_notes} value={String(x.n)} />
                    </View>
                  ))}
                  {!d.mostCommonRevisionReasons.length ? <Text style={styles.emptyText}>No revisions yet.</Text> : null}
                </View>
              </>
            );
          })()
        )}

        {tab === 'poShortages' && (
          poShortageReports.isLoading || !poShortageReports.data ? <LoadingState message="Loading…" /> : (() => {
            const d = poShortageReports.data;
            return (
              <>
                <View style={styles.statsRow}>
                  <View style={[styles.statTile, { flex: 1 }]}><Text style={[styles.statValue, { color: Colors.error }]}>{d.closedWithShortageOrders.length}</Text><Text style={styles.statLabel}>Closed with Shortage</Text></View>
                </View>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Closed with Shortage Orders</Text>
                  <View style={styles.divider} />
                  {d.closedWithShortageOrders.map((x, i) => (
                    <View key={x.id} style={i > 0 ? styles.rowDivider : undefined}>
                      <Row label={`${x.po_number} — ${x.supplier_name}`} value={x.shortage_reason} />
                    </View>
                  ))}
                  {!d.closedWithShortageOrders.length ? <Text style={styles.emptyText}>No orders closed with shortage yet.</Text> : null}
                </View>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Outstanding Quantity by Supplier</Text>
                  <View style={styles.divider} />
                  {d.outstandingQtyBySupplier.map((x, i) => (
                    <View key={x.supplier_name} style={i > 0 ? styles.rowDivider : undefined}>
                      <Row label={x.supplier_name} value={String(x.outstanding_qty)} />
                    </View>
                  ))}
                  {!d.outstandingQtyBySupplier.length ? <Text style={styles.emptyText}>No outstanding orders.</Text> : null}
                </View>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Supplier Fulfillment Rate</Text>
                  <View style={styles.divider} />
                  {d.supplierFulfillmentRate.map((x, i) => (
                    <View key={x.supplier_name} style={i > 0 ? styles.rowDivider : undefined}>
                      <Row label={x.supplier_name} value={`${x.delivered_qty_pct}%`} />
                    </View>
                  ))}
                  {!d.supplierFulfillmentRate.length ? <Text style={styles.emptyText}>No data yet.</Text> : null}
                </View>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Average Supplier Completion Rate</Text>
                  <View style={styles.divider} />
                  {d.avgSupplierCompletionRate.map((x, i) => (
                    <View key={x.supplier_name} style={i > 0 ? styles.rowDivider : undefined}>
                      <Row label={x.supplier_name} value={`${x.avg_fulfillment_pct}%`} />
                    </View>
                  ))}
                  {!d.avgSupplierCompletionRate.length ? <Text style={styles.emptyText}>No data yet.</Text> : null}
                </View>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Most Common Shortage Reasons</Text>
                  <View style={styles.divider} />
                  {d.mostCommonShortageReasons.map((x, i) => (
                    <View key={i} style={i > 0 ? styles.rowDivider : undefined}>
                      <Row label={x.shortage_reason} value={String(x.n)} />
                    </View>
                  ))}
                  {!d.mostCommonShortageReasons.length ? <Text style={styles.emptyText}>No data yet.</Text> : null}
                </View>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Top Suppliers by Shortage Value</Text>
                  <View style={styles.divider} />
                  {d.topSuppliersByShortageValue.map((x, i) => (
                    <View key={x.supplier_name} style={i > 0 ? styles.rowDivider : undefined}>
                      <Row label={x.supplier_name} value={Number(x.shortage_value).toLocaleString()} />
                    </View>
                  ))}
                  {!d.topSuppliersByShortageValue.length ? <Text style={styles.emptyText}>No data yet.</Text> : null}
                </View>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Supplier Shortage History</Text>
                  <View style={styles.divider} />
                  {d.supplierShortageHistory.map((x, i) => (
                    <View key={i} style={i > 0 ? styles.rowDivider : undefined}>
                      <Row label={`${x.po_number} — ${x.supplier_name}`} value={x.status} />
                    </View>
                  ))}
                  {!d.supplierShortageHistory.length ? <Text style={styles.emptyText}>No shortage requests yet.</Text> : null}
                </View>
              </>
            );
          })()
        )}

        {tab === 'executive' && (
          exec.isLoading || !exec.data ? <LoadingState message="Loading…" /> : (
            <>
              <TouchableOpacity style={[styles.exportBtn, exporting && { opacity: 0.6 }]} onPress={exportExecCsv} disabled={exporting}>
                <Ionicons name="share-outline" size={16} color={Colors.white} />
                <Text style={styles.exportBtnText}>{exporting ? 'Preparing…' : 'Share / Export CSV'}</Text>
              </TouchableOpacity>
              <View style={styles.statsRow}>
                <View style={[styles.statTile, { flex: 1.3 }]}><Text style={[styles.statValue, { fontSize: Typography.base }]}>{exec.data.kpis.totalSpend.toLocaleString()}</Text><Text style={styles.statLabel}>Total Spend</Text></View>
                <View style={styles.statTile}><Text style={styles.statValue}>{exec.data.kpis.activeContracts}</Text><Text style={styles.statLabel}>Active Contracts</Text></View>
                <View style={styles.statTile}><Text style={styles.statValue}>{exec.data.kpis.purchaseOrders}</Text><Text style={styles.statLabel}>Purchase Orders</Text></View>
              </View>
              <View style={styles.statsRow}>
                <View style={styles.statTile}><Text style={styles.statValue}>{exec.data.kpis.avgProcurementCycleDays}d</Text><Text style={styles.statLabel}>Avg Cycle</Text></View>
                <View style={styles.statTile}><Text style={styles.statValue}>{exec.data.kpis.avgApprovalDays}d</Text><Text style={styles.statLabel}>Avg Approval</Text></View>
                <View style={styles.statTile}><Text style={styles.statValue}>{exec.data.kpis.budgetUtilization.utilizationPct}%</Text><Text style={styles.statLabel}>Budget Used</Text></View>
              </View>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Estimated Budget Utilization</Text>
                <View style={styles.divider} />
                <Row label="Estimated Budget" value={exec.data.kpis.budgetUtilization.estimatedBudget.toLocaleString()} />
                <Row label="Actual Spend" value={exec.data.kpis.budgetUtilization.actualSpend.toLocaleString()} />
                <Row label="Variance" value={`${exec.data.kpis.budgetUtilization.variance >= 0 ? '+' : ''}${exec.data.kpis.budgetUtilization.variance.toLocaleString()}`} />
              </View>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Savings</Text>
                <View style={styles.divider} />
                <Row label="Planning Savings" value={`${exec.data.kpis.planningSavings.total >= 0 ? '+' : ''}${exec.data.kpis.planningSavings.total.toLocaleString()}`} />
                <Row label="Negotiation Savings" value={`${exec.data.kpis.negotiationSavings.total >= 0 ? '+' : ''}${exec.data.kpis.negotiationSavings.total.toLocaleString()}`} />
              </View>
              {exec.data.charts.monthlySpendTrend.length > 0 ? (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Monthly Spend Trend</Text>
                  <View style={styles.divider} />
                  <HorizontalExpenseChart data={exec.data.charts.monthlySpendTrend.map((m) => ({ label: m.month, value: m.total }))} />
                </View>
              ) : null}
              {exec.data.charts.departmentSpend.length > 0 ? (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Department Spend</Text>
                  <View style={styles.divider} />
                  <HorizontalExpenseChart data={exec.data.charts.departmentSpend.map((d) => ({ label: d.department, value: d.total }))} />
                </View>
              ) : null}
              {exec.data.charts.workshopSpend.length > 0 ? (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Workshop Spend</Text>
                  <View style={styles.divider} />
                  <HorizontalExpenseChart data={exec.data.charts.workshopSpend.map((w) => ({ label: w.workshop, value: w.total }))} />
                </View>
              ) : null}
              {exec.data.charts.approvalTimeline.length > 0 ? (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Approval Timeline (avg days/stage)</Text>
                  <View style={styles.divider} />
                  <HorizontalExpenseChart data={exec.data.charts.approvalTimeline.map((a) => ({ label: a.stage.replace('_', ' '), value: a.avgDays }))} />
                </View>
              ) : null}
            </>
          )
        )}

        {tab === 'budgetspend' && (
          budgetSpend.isLoading || !budgetSpend.data ? <LoadingState message="Loading…" /> : (() => {
            const d = budgetSpend.data;
            const k = d.kpis;
            const filteredSuppliers = bsSupplierSearch.trim()
              ? d.supplierSpend.filter((s) => s.name.toLowerCase().includes(bsSupplierSearch.trim().toLowerCase()))
              : d.supplierSpend;
            return (
              <>
                <TouchableOpacity style={[styles.exportBtn, exporting && { opacity: 0.6 }]} onPress={exportBudgetSpendCsv} disabled={exporting}>
                  <Ionicons name="share-outline" size={16} color={Colors.white} />
                  <Text style={styles.exportBtnText}>{exporting ? 'Preparing…' : 'Share / Export CSV'}</Text>
                </TouchableOpacity>

                <View style={styles.statsRow}>
                  <View style={[styles.statTile, { flex: 1.3 }]}><Text style={[styles.statValue, { fontSize: Typography.base }]}>{k.totalSpend.toLocaleString()}</Text><Text style={styles.statLabel}>Total Spend</Text></View>
                  <View style={styles.statTile}><Text style={styles.statValue}>{k.budgetUtilization.utilizationPct}%</Text><Text style={styles.statLabel}>Budget Used</Text></View>
                </View>
                <View style={styles.statsRow}>
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Procurement Variance</Text>
                    <Text style={[styles.intelScore, { color: k.budgetUtilization.variance >= 0 ? Colors.success : Colors.error }]}>
                      {k.budgetUtilization.variance >= 0 ? '+' : ''}{k.budgetUtilization.variance.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Planning Savings</Text>
                    <Text style={[styles.intelScore, { color: k.planningSavings.total >= 0 ? Colors.success : Colors.error }]}>
                      {k.planningSavings.total >= 0 ? '+' : ''}{k.planningSavings.total.toLocaleString()}
                    </Text>
                  </View>
                </View>

                {d.trends.quarterly.length > 0 ? (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Quarterly Spend Trend</Text>
                    <View style={styles.divider} />
                    <HorizontalExpenseChart data={d.trends.quarterly.map((q) => ({ label: q.quarter, value: q.total }))} />
                  </View>
                ) : null}
                {d.trends.annual.length > 0 ? (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Annual Spend Trend</Text>
                    <View style={styles.divider} />
                    <HorizontalExpenseChart data={d.trends.annual.map((a) => ({ label: a.year, value: a.total }))} />
                  </View>
                ) : null}

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Budget vs Actual (by Budget Code)</Text>
                  <View style={styles.divider} />
                  {d.budgetByCode.map((x, i) => (
                    <View key={x.budgetCode} style={i > 0 ? styles.rowDivider : undefined}>
                      <Row label={x.budgetCode} value={`${x.actual.toLocaleString()} / ${x.estimated.toLocaleString()} (${x.utilizationPct}%)`} />
                    </View>
                  ))}
                  {!d.budgetByCode.length ? <Text style={styles.emptyText}>No budget-coded requisitions yet.</Text> : null}
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Department Analysis</Text>
                  <View style={styles.divider} />
                  {d.departmentSpend.map((x, i) => (
                    <View key={x.department} style={i > 0 ? styles.rowDivider : undefined}>
                      <Row label={x.department} value={`${x.total.toLocaleString()} (${x.variance >= 0 ? '+' : ''}${x.variance.toLocaleString()})`} />
                    </View>
                  ))}
                  {!d.departmentSpend.length ? <Text style={styles.emptyText}>No department spend yet.</Text> : null}
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Workshop Analysis</Text>
                  <View style={styles.divider} />
                  {d.workshopSpend.map((x, i) => (
                    <TouchableOpacity
                      key={`${x.workshopId}-${x.workshop}`}
                      style={[styles.intelRow, i > 0 && styles.rowDivider]}
                      onPress={() => x.workshopId != null && navigation.navigate('PurchaseOrdersList', { workshopId: x.workshopId, workshopName: x.workshop })}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowLabel}>{x.workshop}</Text>
                        <Text style={styles.intelMeta}>{x.total.toLocaleString()} spend · variance {x.variance >= 0 ? '+' : ''}{x.variance.toLocaleString()}</Text>
                      </View>
                      {x.workshopId != null ? <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} /> : null}
                    </TouchableOpacity>
                  ))}
                  {!d.workshopSpend.length ? <Text style={styles.emptyText}>No workshop spend yet.</Text> : null}
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Supplier Spend</Text>
                  <View style={styles.divider} />
                  <TextInput
                    style={styles.searchInput}
                    value={bsSupplierSearch}
                    onChangeText={setBsSupplierSearch}
                    placeholder="Search supplier…"
                    placeholderTextColor={Colors.textMuted}
                  />
                  {filteredSuppliers.map((x, i) => (
                    <TouchableOpacity
                      key={x.id}
                      style={[styles.intelRow, i > 0 && styles.rowDivider]}
                      onPress={() => navigation.navigate('SupplierDetail', { supplierId: x.id })}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowLabel} numberOfLines={1}>{x.name}</Text>
                        <Text style={styles.intelMeta}>{x.totalSpend.toLocaleString()} total · {x.poCount} POs · {x.procurementSharePct}% share</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                    </TouchableOpacity>
                  ))}
                  {!filteredSuppliers.length ? <Text style={styles.emptyText}>No suppliers match.</Text> : null}
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Contract Spend</Text>
                  <View style={styles.divider} />
                  <Row label="Under Contract" value={d.contractSpendSplit.underContract.toLocaleString()} />
                  <Row label="Outside Contract" value={d.contractSpendSplit.outsideContract.toLocaleString()} />
                  <Row label="Under Contract %" value={`${d.contractSpendSplit.underContractPct}%`} />
                </View>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Contract Utilization</Text>
                  <View style={styles.divider} />
                  {d.contractUtilization.map((x, i) => (
                    <TouchableOpacity
                      key={x.contractId}
                      style={[styles.intelRow, i > 0 && styles.rowDivider]}
                      onPress={() => navigation.navigate('SupplierDetail', { supplierId: x.supplierId })}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowLabel} numberOfLines={1}>{x.contractRef} · {x.supplierName}</Text>
                        <Text style={styles.intelMeta}>
                          {x.contractValue != null ? `${x.actualSpend.toLocaleString()} / ${x.contractValue.toLocaleString()}` : `${x.actualSpend.toLocaleString()} spend`}
                          {x.utilizationPct != null ? ` · ${x.utilizationPct}%` : ''}
                        </Text>
                      </View>
                      <StatusBadge status={x.indicator === 'on-track' ? 'active' : x.indicator === 'over' ? 'rejected' : x.indicator === 'under' ? 'pending' : 'draft'} label={x.indicator} size="sm" />
                    </TouchableOpacity>
                  ))}
                  {!d.contractUtilization.length ? <Text style={styles.emptyText}>No contracts yet.</Text> : null}
                </View>
              </>
            );
          })()
        )}

        {tab === 'forecasting' && (
          forecasting.isLoading || !forecasting.data ? <LoadingState message="Loading…" /> : (() => {
            const f = forecasting.data;
            const k = f.kpis;
            const monthlyChartData = [
              ...f.charts.monthlyProjectionTrend.historical.map((v, i) => ({ label: `H${i + 1}`, value: v })),
              ...f.charts.monthlyProjectionTrend.forecast.map((v, i) => ({ label: `F${i + 1}`, value: v })),
            ];
            return (
              <>
                <View style={styles.statsRow}>
                  <View style={[styles.statTile, { flex: 1.3 }]}><Text style={[styles.statValue, { fontSize: Typography.base }]}>{k.expectedMonthlySpend.toLocaleString()}</Text><Text style={styles.statLabel}>Expected Monthly Spend</Text></View>
                  <View style={styles.statTile}><Text style={styles.statValue}>{k.forecastAccuracy != null ? `${k.forecastAccuracy}%` : '—'}</Text><Text style={styles.statLabel}>Forecast Accuracy</Text></View>
                </View>
                <View style={styles.statsRow}>
                  <View style={styles.statTile}><Text style={styles.statValue}>{k.upcomingContractRenewals}</Text><Text style={styles.statLabel}>Contract Renewals</Text></View>
                  <View style={styles.statTile}><Text style={styles.statValue}>{k.expectedProcurementVolume}</Text><Text style={styles.statLabel}>Predicted Volume</Text></View>
                  <View style={styles.statTile}><Text style={styles.statValue}>{k.highDemandSuppliersCount}</Text><Text style={styles.statLabel}>High Demand Suppliers</Text></View>
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Budget Projection</Text>
                  <View style={styles.divider} />
                  <Row label="Projected Annual Spend" value={k.budgetProjection.projectedAnnualSpend.toLocaleString()} />
                  <Row label="Estimated Budget" value={k.budgetProjection.estimatedBudget.toLocaleString()} />
                  <Row label="Projected Utilization" value={`${k.budgetProjection.projectedUtilizationPct}%`} />
                </View>

                {monthlyChartData.length > 0 ? (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Monthly Projection Trend (H = historical, F = forecast)</Text>
                    <View style={styles.divider} />
                    <HorizontalExpenseChart data={monthlyChartData} />
                  </View>
                ) : null}
                {f.charts.seasonalTrend.length > 0 ? (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Seasonal Procurement Trend</Text>
                    <View style={styles.divider} />
                    <HorizontalExpenseChart data={f.charts.seasonalTrend.map((s) => ({ label: s.month, value: s.avg }))} />
                  </View>
                ) : null}

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Upcoming Contract Renewals</Text>
                  <View style={styles.divider} />
                  {f.contractRenewalForecast.slice(0, 10).map((c, i) => (
                    <View key={c.contractId} style={i > 0 ? styles.rowDivider : undefined}>
                      <Row label={`${c.contractRef} · ${c.supplierName}`} value={`${c.endDate} · ${c.expectedRenewalValue?.toLocaleString() ?? '—'}`} />
                    </View>
                  ))}
                  {!f.contractRenewalForecast.length ? <Text style={styles.emptyText}>No renewals due within 12 months.</Text> : null}
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Procurement Calendar (next 90 days)</Text>
                  <View style={styles.divider} />
                  {f.calendar.slice(0, 15).map((c, i) => (
                    <View key={`${c.type}-${c.date}-${i}`} style={i > 0 ? styles.rowDivider : undefined}>
                      <Row label={c.label} value={c.date} />
                    </View>
                  ))}
                  {!f.calendar.length ? <Text style={styles.emptyText}>No upcoming events.</Text> : null}
                </View>

                <View style={styles.card}>
                  <FormSelect
                    label="Executive Report"
                    options={PROC_EXEC_REPORT_OPTIONS}
                    value={pfxType}
                    onChange={(v) => setPfxType(v as ProcurementExecReportType)}
                  />
                  <TouchableOpacity style={[styles.exportBtn, exporting && { opacity: 0.6 }]} onPress={exportPfxCsv} disabled={exporting}>
                    <Ionicons name="share-outline" size={16} color={Colors.white} />
                    <Text style={styles.exportBtnText}>{exporting ? 'Preparing…' : 'Share / Export CSV'}</Text>
                  </TouchableOpacity>
                </View>
                {pfxReport.isLoading ? <LoadingState message="Loading…" /> : pfxReport.data?.summary ? (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>{PROC_EXEC_REPORT_OPTIONS.find((o) => o.value === pfxType)?.label}</Text>
                    <View style={styles.divider} />
                    {Object.entries(pfxReport.data.summary).map(([key, val], i) => (
                      typeof val === 'object' ? null : (
                        <View key={key} style={i > 0 ? styles.rowDivider : undefined}>
                          <Row label={key.replace(/([A-Z])/g, ' $1')} value={String(val)} />
                        </View>
                      )
                    ))}
                  </View>
                ) : pfxReport.data?.rows ? (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>{PROC_EXEC_REPORT_OPTIONS.find((o) => o.value === pfxType)?.label} ({pfxReport.data.rows.length})</Text>
                    <View style={styles.divider} />
                    {pfxReport.data.rows.slice(0, 20).map((row, i) => {
                      const entries = Object.entries(row);
                      const primary = String(entries[0]?.[1] ?? `Row ${i + 1}`);
                      const secondary = entries.slice(1, 3).map(([, v]) => String(v)).join(' · ');
                      return (
                        <View key={i} style={i > 0 ? styles.rowDivider : undefined}>
                          <Row label={primary} value={secondary} />
                        </View>
                      );
                    })}
                    {!pfxReport.data.rows.length ? <Text style={styles.emptyText}>No rows for this report.</Text> : null}
                  </View>
                ) : null}
              </>
            );
          })()
        )}

        {tab === 'analytics' && (
          analytics.isLoading || !analytics.data ? <LoadingState message="Loading…" /> : (
            <>
              <View style={styles.statsRow}>
                <View style={styles.statTile}><Text style={styles.statValue}>{analytics.data.avgProcurementCycleDays}</Text><Text style={styles.statLabel}>Avg Cycle Days</Text></View>
                <View style={styles.statTile}><Text style={styles.statValue}>{analytics.data.lateDeliveriesCount}</Text><Text style={styles.statLabel}>Late Deliveries</Text></View>
              </View>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Top Purchased Products</Text>
                <View style={styles.divider} />
                {analytics.data.topPurchasedProducts.map((p, i) => (
                  <View key={p.description} style={i > 0 ? styles.rowDivider : undefined}>
                    <Row label={p.description} value={`${p.times_ordered}× · qty ${p.total_qty}`} />
                  </View>
                ))}
                {!analytics.data.topPurchasedProducts.length ? <Text style={styles.emptyText}>No purchase history yet.</Text> : null}
              </View>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Supplier Rankings</Text>
                <View style={styles.divider} />
                {analytics.data.supplierRankings.map((s, i) => (
                  <View key={s.name} style={i > 0 ? styles.rowDivider : undefined}>
                    <Row label={s.name} value={`${s.po_count} POs · ${Number(s.total_spend).toLocaleString()}`} />
                  </View>
                ))}
                {!analytics.data.supplierRankings.length ? <Text style={styles.emptyText}>No supplier rankings yet.</Text> : null}
              </View>
            </>
          )
        )}

        {tab === 'intelligence' && (
          <>
            <View style={styles.card}>
              <FormSelect
                label="Report"
                options={INTEL_REPORT_OPTIONS}
                value={intelType}
                onChange={(v) => setIntelType(String(v))}
              />
              <TouchableOpacity style={[styles.exportBtn, exporting && { opacity: 0.6 }]} onPress={exportIntelCsv} disabled={exporting}>
                <Ionicons name="share-outline" size={16} color={Colors.white} />
                <Text style={styles.exportBtnText}>{exporting ? 'Preparing…' : 'Share / Export CSV'}</Text>
              </TouchableOpacity>
            </View>
            {intelReport.isLoading ? <LoadingState message="Loading…" /> : (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{INTEL_REPORT_OPTIONS.find((o) => o.value === intelType)?.label} ({intelReport.data?.rows.length ?? 0})</Text>
                <View style={styles.divider} />
                {(intelReport.data?.rows ?? []).map((s, i) => (
                  <View key={s.id} style={[styles.intelRow, i > 0 && styles.rowDivider]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowLabel} numberOfLines={1}>{s.name}{s.preferred ? ' ★' : ''}</Text>
                      <Text style={styles.intelMeta}>{Number(s.totalSpend).toLocaleString()} · Reject {s.rejectRatePct}%{s.onTimeRatePct != null ? ` · On-time ${s.onTimeRatePct}%` : ''}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text style={styles.intelScore}>{s.overallScore}</Text>
                      <StatusBadge status={s.tier} size="sm" />
                    </View>
                  </View>
                ))}
                {!intelReport.data?.rows.length ? <Text style={styles.emptyText}>No suppliers match this report.</Text> : null}
              </View>
            )}
          </>
        )}

        {tab === 'srm' && (
          <>
            <View style={styles.card}>
              <FormSelect
                label="Report"
                options={SRM_REPORT_OPTIONS}
                value={srmType}
                onChange={(v) => setSrmType(v as SrmReportType)}
              />
              {srmType !== 'executive_summary' ? (
                <TouchableOpacity style={[styles.exportBtn, exporting && { opacity: 0.6 }]} onPress={exportSrmCsv} disabled={exporting}>
                  <Ionicons name="share-outline" size={16} color={Colors.white} />
                  <Text style={styles.exportBtnText}>{exporting ? 'Preparing…' : 'Share / Export CSV'}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {srmReport.isLoading ? <LoadingState message="Loading…" /> : srmType === 'executive_summary' && srmReport.data?.summary ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Executive SRM Summary</Text>
                <View style={styles.divider} />
                <Row label="Total Suppliers" value={String(srmReport.data.summary.kpis.totalSuppliers)} />
                <Row label="Active Contracts" value={String(srmReport.data.summary.kpis.activeContracts)} />
                <Row label="Expiring Contracts" value={String(srmReport.data.summary.kpis.expiringContracts)} />
                <Row label="Expired Contracts" value={String(srmReport.data.summary.kpis.expiredContracts)} />
                <Row label="Compliance %" value={`${srmReport.data.summary.kpis.compliancePct}%`} />
                <Row label="Missing Documents" value={String(srmReport.data.summary.kpis.missingDocuments)} />
                <Row label="Open Improvement Plans" value={String(srmReport.data.summary.kpis.openImprovementPlans)} />
                <Row label="High Risk Suppliers" value={String(srmReport.data.summary.kpis.highRiskSuppliers)} />
              </View>
            ) : (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{SRM_REPORT_OPTIONS.find((o) => o.value === srmType)?.label} ({srmReport.data?.rows?.length ?? 0})</Text>
                <View style={styles.divider} />
                {(srmReport.data?.rows ?? []).map((r, i) => {
                  const row = r as Record<string, unknown>;
                  const primary = String(row.contract_ref ?? row.original_filename ?? row.subject ?? row.title ?? row.compliance_type ?? row.supplier_name ?? `Row ${i + 1}`);
                  const secondary = [row.supplier_name, row.status ?? row.computedStatus, row.date, row.expiry_date, row.end_date]
                    .filter((v) => v != null && v !== primary).map(String).join(' · ');
                  return (
                    <View key={i} style={i > 0 ? styles.rowDivider : undefined}>
                      <Row label={primary} value={secondary} />
                    </View>
                  );
                })}
                {!srmReport.data?.rows?.length ? <Text style={styles.emptyText}>No rows for this report.</Text> : null}
              </View>
            )}
          </>
        )}

        {tab === 'automation' && (
          automationDash.isLoading || !automationDash.data ? <LoadingState message="Loading…" /> : (() => {
            const d = automationDash.data;
            const s = d.summary;
            const openTasks = tasks.data?.rows ?? [];
            return (
              <>
                <View style={styles.statsRow}>
                  <View style={styles.statTile}><Text style={styles.statValue}>{s.pending_tasks}</Text><Text style={styles.statLabel}>Pending Tasks</Text></View>
                  <View style={styles.statTile}><Text style={styles.statValue}>{s.overdue_tasks}</Text><Text style={styles.statLabel}>Overdue Tasks</Text></View>
                  <View style={styles.statTile}><Text style={styles.statValue}>{s.active_escalations}</Text><Text style={styles.statLabel}>Escalations</Text></View>
                </View>
                <View style={styles.statsRow}>
                  <View style={styles.statTile}><Text style={styles.statValue}>{s.pending_approvals}</Text><Text style={styles.statLabel}>Pending Approvals</Text></View>
                  <View style={styles.statTile}><Text style={styles.statValue}>{s.outstanding_deliveries}</Text><Text style={styles.statLabel}>Outstanding Deliveries</Text></View>
                  <View style={styles.statTile}><Text style={styles.statValue}>{s.outstanding_invoices}</Text><Text style={styles.statLabel}>Outstanding Invoices</Text></View>
                </View>
                <View style={styles.statsRow}>
                  <View style={styles.statTile}><Text style={styles.statValue}>{s.contracts_expiring}</Text><Text style={styles.statLabel}>Contracts Expiring</Text></View>
                  <View style={styles.statTile}><Text style={styles.statValue}>{s.compliance_expiring}</Text><Text style={styles.statLabel}>Compliance Expiring</Text></View>
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Active Escalations</Text>
                  <View style={styles.divider} />
                  {d.escalations.active.map((e, i) => (
                    <View key={e.id} style={i > 0 ? styles.rowDivider : undefined}>
                      <View style={styles.intelRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rowLabel}>{e.entity_ref || `${e.entity_type} #${e.entity_id}`}</Text>
                          <Text style={styles.intelMeta}>{e.entity_type.replace('procurement_', '').replace('_', ' ')} · {e.age_hours}h</Text>
                        </View>
                        <StatusBadge status={e.current_level === 'ceo' || e.current_level === 'director' ? 'rejected' : 'pending'} label={e.current_level} size="sm" />
                        <TouchableOpacity
                          style={[styles.exportBtn, { marginTop: 0, marginLeft: Spacing.sm, paddingHorizontal: Spacing.sm }]}
                          onPress={() => Alert.alert('Resolve escalation?', e.entity_ref || undefined, [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Resolve', onPress: async () => {
                                const r = await escalationActions.resolve(e.id, 'Resolved via mobile');
                                if (!r.ok) Alert.alert('Could not resolve', r.error ?? 'Unknown error');
                              },
                            },
                          ])}
                        >
                          <Text style={styles.exportBtnText}>Resolve</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                  {!d.escalations.active.length ? <Text style={styles.emptyText}>No active procurement escalations — nothing is stuck.</Text> : null}
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Procurement Task Center ({openTasks.length})</Text>
                  <View style={styles.divider} />
                  {tasks.isLoading ? <LoadingState message="Loading…" /> : openTasks.map((t, i) => {
                    const overdue = !!t.due_date && new Date(t.due_date) < new Date(new Date().toDateString());
                    return (
                      <View key={t.id} style={i > 0 ? styles.rowDivider : undefined}>
                        <View style={styles.intelRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.rowLabel}>{t.title}</Text>
                            <Text style={[styles.intelMeta, overdue && { color: Colors.error, fontWeight: Typography.semibold as any }]}>
                              {TASK_CATEGORY_LABELS[t.category] || t.category} · {t.owner_role}{t.due_date ? ` · due ${t.due_date}${overdue ? ' (overdue)' : ''}` : ''}
                            </Text>
                          </View>
                          <StatusBadge status={t.priority === 'high' ? 'rejected' : t.priority === 'medium' ? 'pending' : 'draft'} label={t.priority} size="sm" />
                          <TouchableOpacity
                            style={[styles.exportBtn, { marginTop: 0, marginLeft: Spacing.sm, paddingHorizontal: Spacing.sm }]}
                            onPress={async () => {
                              const r = await taskActions.complete(t.id);
                              if (!r.ok) Alert.alert('Could not complete task', r.error ?? 'Unknown error');
                            }}
                          >
                            <Text style={styles.exportBtnText}>Done</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                  {!tasks.isLoading && !openTasks.length ? <Text style={styles.emptyText}>No open tasks — you're all caught up.</Text> : null}
                </View>
              </>
            );
          })()
        )}

        {tab === 'performance' && (
          <>
            <View style={styles.tabBar}>
              {PERF_SUBVIEWS.map((s) => (
                <TouchableOpacity key={s.key} style={[styles.tab, perfSub === s.key && styles.tabActive]} onPress={() => setPerfSub(s.key)}>
                  <Text style={[styles.tabText, perfSub === s.key && styles.tabTextActive]}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {perfSub === 'scorecard' && (
              scorecard.isLoading || !scorecard.data ? <LoadingState message="Loading…" /> : (
                <View style={{ gap: Spacing.sm }}>
                  {Object.values(scorecard.data.kpis).map((k) => (
                    <View key={k.key} style={styles.card}>
                      <Text style={styles.cardTitle}>{k.label}</Text>
                      <View style={styles.divider} />
                      <View style={styles.row}>
                        <Text style={[styles.statValue, { color: Colors.textPrimary, fontSize: Typography.lg }]}>{kpiUnitText(k.unit, k.current)}</Text>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.intelMeta}>{k.previous != null ? `prev ${kpiUnitText(k.unit, k.previous)}` : 'no prior period'}</Text>
                          {k.target != null ? <Text style={styles.intelMeta}>target {kpiUnitText(k.unit, k.target)}</Text> : null}
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )
            )}

            {perfSub === 'buyers' && (
              buyers.isLoading || !buyers.data ? <LoadingState message="Loading…" /> : (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Buyer Ranking ({buyers.data.buyers.length})</Text>
                  <View style={styles.divider} />
                  {buyers.data.buyers.map((b, i) => (
                    <View key={b.id} style={i > 0 ? styles.rowDivider : undefined}>
                      <View style={styles.intelRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rowLabel}>{b.rank}. {b.name}</Text>
                          <Text style={styles.intelMeta}>{b.purchaseOrdersIssued} POs · {b.rfqsManaged} RFQs · {b.escalationsReceived} escalations</Text>
                        </View>
                        <Text style={styles.intelScore}>{b.overallScore ?? '—'}</Text>
                      </View>
                    </View>
                  ))}
                  {!buyers.data.buyers.length ? <Text style={styles.emptyText}>No buyer activity yet.</Text> : null}
                </View>
              )
            )}

            {perfSub === 'departments' && (
              deptPerf.isLoading || !deptPerf.data ? <LoadingState message="Loading…" /> : (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Department Performance</Text>
                  <View style={styles.divider} />
                  {deptPerf.data.departments.map((d, i) => (
                    <View key={d.department} style={i > 0 ? styles.rowDivider : undefined}>
                      <View style={styles.intelRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rowLabel}>{d.department}</Text>
                          <Text style={styles.intelMeta}>{d.procurementSpend.toLocaleString()} · {d.budgetUsagePct ?? '—'}% used · {d.avgCycleDays ?? '—'}d cycle</Text>
                        </View>
                        <StatusBadge status={d.procurementRisk === 'high' ? 'rejected' : d.procurementRisk === 'medium' ? 'pending' : 'approved'} label={d.procurementRisk} size="sm" />
                      </View>
                    </View>
                  ))}
                  {!deptPerf.data.departments.length ? <Text style={styles.emptyText}>No department spend yet.</Text> : null}
                </View>
              )
            )}

            {perfSub === 'workshops' && (
              wsPerf.isLoading || !wsPerf.data ? <LoadingState message="Loading…" /> : (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Workshop Performance</Text>
                  <View style={styles.divider} />
                  {wsPerf.data.workshops.map((w, i) => (
                    <TouchableOpacity
                      key={w.workshopId}
                      style={i > 0 ? styles.rowDivider : undefined}
                      onPress={() => navigation.navigate('PurchaseOrdersList', { workshopId: w.workshopId, workshopName: w.workshop })}
                    >
                      <Row label={w.workshop} value={`${w.procurementCost.toLocaleString()} · ${w.efficiency ?? '—'}% eff.`} />
                    </TouchableOpacity>
                  ))}
                  {!wsPerf.data.workshops.length ? <Text style={styles.emptyText}>No workshop spend yet.</Text> : null}
                </View>
              )
            )}

            {perfSub === 'executive' && (
              execPerf.isLoading || !execPerf.data ? <LoadingState message="Loading…" /> : (
                <>
                  <View style={styles.statsRow}>
                    <View style={styles.statTile}><Text style={styles.statValue}>{execPerf.data.kpis.procurementHealth ?? '—'}</Text><Text style={styles.statLabel}>Health</Text></View>
                    <View style={styles.statTile}><Text style={styles.statValue}>{execPerf.data.kpis.budgetUtilization ?? '—'}%</Text><Text style={styles.statLabel}>Budget Utilization</Text></View>
                    <View style={styles.statTile}><Text style={styles.statValue}>{execPerf.data.kpis.outstandingRisks ?? '—'}</Text><Text style={styles.statLabel}>Risk</Text></View>
                  </View>
                  <View style={styles.statsRow}>
                    <View style={[styles.statTile, { flex: 1.3 }]}><Text style={[styles.statValue, { fontSize: Typography.base }]}>{execPerf.data.kpis.totalProcurementSpend.toLocaleString()}</Text><Text style={styles.statLabel}>Total Spend</Text></View>
                    <View style={styles.statTile}><Text style={styles.statValue}>{execPerf.data.kpis.procurementSavings.toLocaleString()}</Text><Text style={styles.statLabel}>Savings</Text></View>
                  </View>
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Buyer Ranking</Text>
                    <View style={styles.divider} />
                    {execPerf.data.charts.buyerRanking.map((b, i) => (
                      <View key={b.name} style={i > 0 ? styles.rowDivider : undefined}>
                        <Row label={`${i + 1}. ${b.name}`} value={String(b.score ?? '—')} />
                      </View>
                    ))}
                    {!execPerf.data.charts.buyerRanking.length ? <Text style={styles.emptyText}>No buyer ranking yet.</Text> : null}
                  </View>
                </>
              )
            )}

            {perfSub === 'risk' && (
              riskMonitor.isLoading || !riskMonitor.data ? <LoadingState message="Loading…" /> : (
                <>
                  <View style={styles.statsRow}>
                    <View style={styles.statTile}><Text style={styles.statValue}>{riskMonitor.data.highRiskSuppliers.length}</Text><Text style={styles.statLabel}>High Risk Suppliers</Text></View>
                    <View style={styles.statTile}><Text style={styles.statValue}>{riskMonitor.data.budgetRisk.length}</Text><Text style={styles.statLabel}>Budget Codes Over</Text></View>
                    <View style={styles.statTile}><Text style={styles.statValue}>{riskMonitor.data.escalationVolume}</Text><Text style={styles.statLabel}>Escalations</Text></View>
                  </View>
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>High Risk Suppliers</Text>
                    <View style={styles.divider} />
                    {riskMonitor.data.highRiskSuppliers.map((s, i) => (
                      <View key={s.id} style={i > 0 ? styles.rowDivider : undefined}>
                        <Row label={s.name} value={String(s.score)} />
                        <Text style={styles.intelMeta}>{s.primaryIssue}</Text>
                      </View>
                    ))}
                    {!riskMonitor.data.highRiskSuppliers.length ? <Text style={styles.emptyText}>No high risk suppliers.</Text> : null}
                  </View>
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Budget Risk</Text>
                    <View style={styles.divider} />
                    {riskMonitor.data.budgetRisk.map((b, i) => (
                      <View key={b.budgetCode} style={i > 0 ? styles.rowDivider : undefined}>
                        <Row label={b.budgetCode} value={`${b.utilizationPct}% · over ${b.overspend.toLocaleString()}`} />
                      </View>
                    ))}
                    {!riskMonitor.data.budgetRisk.length ? <Text style={styles.emptyText}>No budget codes over 100% utilization.</Text> : null}
                  </View>
                </>
              )
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  tabBar: { flexDirection: 'row', paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, gap: Spacing.xs, flexWrap: 'wrap' },
  tab: { paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border },
  tabActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  tabText: { fontSize: Typography.xs, fontWeight: Typography.medium, color: Colors.textMuted },
  tabTextActive: { color: Colors.white },
  scroll: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.xxxl },
  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  statTile: { flex: 1, backgroundColor: Colors.navy, borderRadius: Radius.lg, padding: Spacing.sm, alignItems: 'center' },
  statValue: { color: Colors.white, fontSize: Typography.lg, fontWeight: Typography.bold },
  statLabel: { color: 'rgba(255,255,255,0.7)', fontSize: Typography.xs, marginTop: 2, textAlign: 'center' },
  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, ...Shadow.sm },
  searchInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, fontSize: Typography.sm, color: Colors.textPrimary, backgroundColor: Colors.bg, marginBottom: Spacing.xs },
  cardTitle: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.sm },
  divider: { height: 1, backgroundColor: Colors.divider, marginBottom: Spacing.xs },
  rowDivider: { borderTopWidth: 1, borderTopColor: Colors.divider },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.sm, gap: Spacing.base },
  rowLabel: { fontSize: Typography.sm, color: Colors.textPrimary, flex: 1 },
  rowValue: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textMuted, textAlign: 'right' },
  emptyText: { fontSize: Typography.sm, color: Colors.textMuted, fontStyle: 'italic' },
  exportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, backgroundColor: Colors.navy, borderRadius: Radius.md, paddingVertical: Spacing.sm, marginTop: Spacing.sm },
  exportBtnText: { color: Colors.white, fontSize: Typography.sm, fontWeight: Typography.semibold },
  intelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm, gap: Spacing.sm },
  intelMeta: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },
  intelScore: { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.textPrimary },
});
