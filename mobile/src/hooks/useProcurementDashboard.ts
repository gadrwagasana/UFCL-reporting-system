import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, patch, post } from '../api/client';
import { EP } from '../api/endpoints';
import type {
  ProcurementDashboard, ProcurementAnalytics, ProcurementConfig, ProcurementExecutiveDashboard,
  ProcurementSpendBudgetAnalytics, ProcurementForecastingDashboard, ProcurementExecReportResult, ProcurementExecReportType,
  ProcurementAutomationDashboard, ProcurementAutomationTask, ProcurementTaskCategory,
  ProcurementPerformanceScorecard, ProcurementBuyerPerformance, ProcurementDepartmentPerformance,
  ProcurementWorkshopPerformance, ProcurementExecutivePerformanceDashboard, ProcurementRiskMonitor,
  ProcurementBenchmarkResult,
} from '../types/api';

interface DashboardResponse extends ProcurementDashboard { ok: true }
interface AnalyticsResponse extends ProcurementAnalytics { ok: true }
interface ExecutiveDashboardResponse extends ProcurementExecutiveDashboard { ok: true }
interface SpendBudgetAnalyticsResponse extends ProcurementSpendBudgetAnalytics { ok: true }
interface ForecastingDashboardResponse extends ProcurementForecastingDashboard { ok: true }
interface SpendReportResponse { ok: true; rows: Array<{ supplier_name: string; po_count: number; total_spend: number }> }
interface SupplierPerfReportResponse {
  ok: true;
  // orders_completed/orders_closed_with_shortage/delivered_qty_pct/
  // avg_fulfillment_pct added in Procurement Exception Management Phase 3.
  rows: Array<{
    id: number; name: string; rating: number | null; preferred: boolean; blacklisted: boolean;
    total_pos: number; total_rejected: number; total_received: number;
    orders_completed: number; orders_closed_with_shortage: number; delivered_qty_pct: number; avg_fulfillment_pct: number;
  }>;
}
interface DeliveryPerfReportResponse {
  ok: true;
  rows: Array<{ po_number: string; expected_delivery_date: string | null; first_received_at: string | null; supplier_name: string; on_time: boolean | null }>;
}
interface BudgetReportResponse { ok: true; rows: Array<{ budget_code: string; requisitions: number; total_estimated: number }> }

export function useProcurementDashboard() {
  return useQuery<DashboardResponse>({
    queryKey: ['procurement-dashboard'],
    queryFn:  () => get<DashboardResponse>(EP.PROCUREMENT_DASHBOARD),
    staleTime: 60_000,
  });
}

export function useProcurementAnalytics() {
  return useQuery<AnalyticsResponse>({
    queryKey: ['procurement-analytics'],
    queryFn:  () => get<AnalyticsResponse>(EP.PROCUREMENT_ANALYTICS),
    staleTime: 5 * 60_000,
  });
}

// Phase 5A — Executive Procurement Dashboard (Procurement Analytics & Forecasting)
export function useProcurementExecutiveDashboard() {
  return useQuery<ExecutiveDashboardResponse>({
    queryKey: ['procurement-executive-dashboard'],
    queryFn:  () => get<ExecutiveDashboardResponse>(EP.PROCUREMENT_EXECUTIVE_DASHBOARD),
    staleTime: 60_000,
  });
}

// Phase 5B — Spend & Budget Analytics
export function useProcurementSpendBudgetAnalytics() {
  return useQuery<SpendBudgetAnalyticsResponse>({
    queryKey: ['procurement-spend-budget-analytics'],
    queryFn:  () => get<SpendBudgetAnalyticsResponse>(EP.PROCUREMENT_SPEND_BUDGET_ANALYTICS),
    staleTime: 60_000,
  });
}

// Phase 5C + 5D — Procurement Forecasting & Executive Reporting
export function useProcurementForecastingDashboard() {
  return useQuery<ForecastingDashboardResponse>({
    queryKey: ['procurement-forecasting-dashboard'],
    queryFn:  () => get<ForecastingDashboardResponse>(EP.PROCUREMENT_FORECASTING_DASHBOARD),
    staleTime: 60_000,
  });
}

export function useProcurementExecutiveReport(reportType: ProcurementExecReportType | null) {
  return useQuery<ProcurementExecReportResult>({
    queryKey: ['procurement-executive-report', reportType],
    queryFn:  () => get<ProcurementExecReportResult>(EP.PROCUREMENT_EXECUTIVE_REPORT(reportType as string)),
    enabled:  !!reportType,
  });
}

// Phase 6 — Procurement Automation Engine
interface AutomationDashboardResponse extends ProcurementAutomationDashboard { ok: true }
interface TasksResponse { ok: true; rows: ProcurementAutomationTask[] }

export function useProcurementAutomationDashboard() {
  return useQuery<AutomationDashboardResponse>({
    queryKey: ['procurement-automation-dashboard'],
    queryFn:  () => get<AutomationDashboardResponse>(EP.PROCUREMENT_AUTOMATION_DASHBOARD),
    staleTime: 30_000,
  });
}

export function useProcurementTasks(filters?: { category?: ProcurementTaskCategory; priority?: string; status?: 'open' | 'closed' }) {
  return useQuery<TasksResponse>({
    queryKey: ['procurement-tasks', filters],
    queryFn:  () => get<TasksResponse>(EP.PROCUREMENT_TASKS, filters as Record<string, unknown> | undefined),
    staleTime: 30_000,
  });
}

export function useProcurementTaskActions() {
  const qc = useQueryClient();
  return {
    async complete(taskId: number): Promise<{ ok: boolean; error?: string }> {
      const res = await patch<{ ok: boolean; error?: string }>(EP.PROCUREMENT_TASK_COMPLETE(taskId), {});
      await qc.invalidateQueries({ queryKey: ['procurement-tasks'] });
      await qc.invalidateQueries({ queryKey: ['procurement-automation-dashboard'] });
      return res;
    },
  };
}

interface EscalationsResponse { ok: true; escalations: Array<Record<string, unknown>> }

export function useProcurementEscalations(filters?: { status?: string }) {
  return useQuery<EscalationsResponse>({
    queryKey: ['procurement-escalations', filters],
    queryFn:  () => get<EscalationsResponse>(EP.PROCUREMENT_ESCALATIONS, filters as Record<string, unknown> | undefined),
    staleTime: 30_000,
  });
}

export function useProcurementEscalationActions() {
  const qc = useQueryClient();
  return {
    async resolve(escalationId: number, reason: string): Promise<{ ok: boolean; error?: string }> {
      const res = await post<{ ok: boolean; error?: string }>(EP.PROCUREMENT_ESCALATION_RESOLVE(escalationId), { reason });
      await qc.invalidateQueries({ queryKey: ['procurement-escalations'] });
      await qc.invalidateQueries({ queryKey: ['procurement-automation-dashboard'] });
      return res;
    },
  };
}

// Phase 7 — Procurement Performance Management
interface ScorecardResponse extends ProcurementPerformanceScorecard { ok: true }
interface BuyersResponse { ok: true; buyers: ProcurementBuyerPerformance[] }
interface DepartmentsResponse { ok: true; departments: ProcurementDepartmentPerformance[] }
interface WorkshopsResponse { ok: true; workshops: ProcurementWorkshopPerformance[] }
interface ExecutivePerfResponse extends ProcurementExecutivePerformanceDashboard { ok: true }
interface RiskResponse extends ProcurementRiskMonitor { ok: true }
interface BenchmarkResponse extends ProcurementBenchmarkResult { ok: true }

export function useProcurementPerformanceScorecard() {
  return useQuery<ScorecardResponse>({
    queryKey: ['procurement-perf-scorecard'],
    queryFn:  () => get<ScorecardResponse>(EP.PROCUREMENT_PERF_SCORECARD),
    staleTime: 60_000,
  });
}

export function useProcurementBuyerPerformance() {
  return useQuery<BuyersResponse>({
    queryKey: ['procurement-perf-buyers'],
    queryFn:  () => get<BuyersResponse>(EP.PROCUREMENT_PERF_BUYERS),
    staleTime: 60_000,
  });
}

export function useProcurementDepartmentPerformance() {
  return useQuery<DepartmentsResponse>({
    queryKey: ['procurement-perf-departments'],
    queryFn:  () => get<DepartmentsResponse>(EP.PROCUREMENT_PERF_DEPARTMENTS),
    staleTime: 60_000,
  });
}

export function useProcurementWorkshopPerformance() {
  return useQuery<WorkshopsResponse>({
    queryKey: ['procurement-perf-workshops'],
    queryFn:  () => get<WorkshopsResponse>(EP.PROCUREMENT_PERF_WORKSHOPS),
    staleTime: 60_000,
  });
}

export function useProcurementExecutivePerformance() {
  return useQuery<ExecutivePerfResponse>({
    queryKey: ['procurement-perf-executive'],
    queryFn:  () => get<ExecutivePerfResponse>(EP.PROCUREMENT_PERF_EXECUTIVE),
    staleTime: 60_000,
  });
}

export function useProcurementRiskMonitor() {
  return useQuery<RiskResponse>({
    queryKey: ['procurement-perf-risk'],
    queryFn:  () => get<RiskResponse>(EP.PROCUREMENT_PERF_RISK),
    staleTime: 60_000,
  });
}

export function useProcurementBenchmark(dimension: string | null, a?: string, b?: string) {
  return useQuery<BenchmarkResponse>({
    queryKey: ['procurement-perf-benchmark', dimension, a, b],
    queryFn:  () => get<BenchmarkResponse>(EP.PROCUREMENT_PERF_BENCHMARK, { dimension, a, b }),
    enabled:  !!dimension,
  });
}

export function useProcurementSpendReport() {
  return useQuery<SpendReportResponse>({
    queryKey: ['procurement-report-spend'],
    queryFn:  () => get<SpendReportResponse>(EP.PROCUREMENT_REPORT_SPEND),
    staleTime: 5 * 60_000,
  });
}

export function useProcurementSupplierPerfReport() {
  return useQuery<SupplierPerfReportResponse>({
    queryKey: ['procurement-report-supplier-perf'],
    queryFn:  () => get<SupplierPerfReportResponse>(EP.PROCUREMENT_REPORT_SUPPLIER_PERF),
    staleTime: 5 * 60_000,
  });
}

export function useProcurementDeliveryPerfReport() {
  return useQuery<DeliveryPerfReportResponse>({
    queryKey: ['procurement-report-delivery-perf'],
    queryFn:  () => get<DeliveryPerfReportResponse>(EP.PROCUREMENT_REPORT_DELIVERY_PERF),
    staleTime: 5 * 60_000,
  });
}

export function useProcurementBudgetReport() {
  return useQuery<BudgetReportResponse>({
    queryKey: ['procurement-report-budget'],
    queryFn:  () => get<BudgetReportResponse>(EP.PROCUREMENT_REPORT_BUDGET),
    staleTime: 5 * 60_000,
  });
}

// Procurement Settings (Phase 2B, Priority 1). Read is unrestricted (matches
// the desktop/backend behavior — see PROCUREMENT_PHASE2B_COMPLETION_REPORT.md);
// the update call is the one actually gated to admin/ceo, enforced server-side
// by the pre-existing procurementConfigUpdate check this hook does not alter.
interface ConfigResponse { ok: true; config: ProcurementConfig }

export function useProcurementConfig() {
  return useQuery<ConfigResponse>({
    queryKey: ['procurement-config'],
    queryFn:  () => get<ConfigResponse>(EP.PROCUREMENT_CONFIG),
    staleTime: 60_000,
  });
}

export function useProcurementConfigActions() {
  const qc = useQueryClient();
  return {
    async update(ceoThreshold: number): Promise<{ ok: boolean; error?: string }> {
      const res = await patch<{ ok: boolean; error?: string }>(EP.PROCUREMENT_CONFIG, { ceoThreshold });
      await qc.invalidateQueries({ queryKey: ['procurement-config'] });
      return res;
    },
  };
}
