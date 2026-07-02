import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../api/client';
import { EP } from '../api/endpoints';
import type {
  WeeklyCostResponse, WeeklyPerfResponse, KpiBudgetsResponse,
  ExecutiveDashboardResponse, BiDashboardResponse, MonthlyDashboardResponse,
} from '../types/api';

const QK = {
  weeklyCost:  ['reports-weekly-cost']  as const,
  weeklyPerf:  ['reports-weekly-perf']  as const,
  kpi:         (month?: string) => ['reports-kpi', month ?? ''] as const,
  executive:   ['reports-executive']    as const,
  bi:          ['reports-bi']           as const,
  monthly:     (month?: string) => ['reports-monthly', month ?? ''] as const,
};

export function useWeeklyCost() {
  return useQuery({
    queryKey: QK.weeklyCost,
    queryFn:  () => get<WeeklyCostResponse>(EP.REPORTS_WEEKLY_COST),
    staleTime: 60_000,
  });
}

export function useSaveWeeklyExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      categoryId: number;
      amount: number;
      weekNumber: number;
      month: string;
      reason?: string;
    }) => post(EP.REPORTS_WEEKLY_EXPENSES, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.weeklyCost }),
  });
}

export function useWeeklyPerf() {
  return useQuery({
    queryKey: QK.weeklyPerf,
    queryFn:  () => get<WeeklyPerfResponse>(EP.REPORTS_WEEKLY_PERF),
    staleTime: 60_000,
  });
}

export function useKpiBudgets(month?: string) {
  const url = month
    ? `${EP.REPORTS_KPI}?month=${month}`
    : EP.REPORTS_KPI;
  return useQuery({
    queryKey: QK.kpi(month),
    queryFn:  () => get<KpiBudgetsResponse>(url),
    staleTime: 60_000,
  });
}

export function useSaveKpiBudgets() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { month: string; items: Array<{ id: number; budget_amount: number }> }) =>
      post(EP.REPORTS_KPI, payload),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: QK.kpi(vars.month) }),
  });
}

export function useExecutiveDashboard() {
  return useQuery({
    queryKey: QK.executive,
    queryFn:  () => get<ExecutiveDashboardResponse>(EP.REPORTS_EXECUTIVE),
    staleTime: 60_000,
  });
}

export function useBiDashboard() {
  return useQuery({
    queryKey: QK.bi,
    queryFn:  () => get<BiDashboardResponse>(EP.REPORTS_BI),
    staleTime: 60_000,
  });
}

export function useMonthlyDashboard(month?: string) {
  const url = month
    ? `${EP.REPORTS_MONTHLY}?month=${month}`
    : EP.REPORTS_MONTHLY;
  return useQuery({
    queryKey: QK.monthly(month),
    queryFn:  () => get<MonthlyDashboardResponse>(url),
    staleTime: 60_000,
  });
}

export function useMonthlyApprove() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (month: string) => post(EP.REPORTS_MONTHLY_APPROVE, { month }),
    onSuccess: (_data, month) => qc.invalidateQueries({ queryKey: QK.monthly(month) }),
  });
}
