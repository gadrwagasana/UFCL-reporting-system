import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../api/client';
import { EP } from '../api/endpoints';
import { MonthlyDashboard } from '../types/api';

export function useMonthlyDashboard(monthKey: string) {
  return useQuery<MonthlyDashboard>({
    queryKey: ['ceo-monthly', monthKey],
    queryFn:  () => get<MonthlyDashboard>(`${EP.CEO_MONTHLY}?month=${monthKey}`),
    staleTime: 3 * 60_000,
    enabled: !!monthKey,
  });
}

export function useMonthlyApprove(monthKey: string) {
  const qc = useQueryClient();

  async function approveMonth(): Promise<void> {
    await post(EP.CEO_MONTHLY_APPROVE(monthKey), {});
    qc.invalidateQueries({ queryKey: ['ceo-monthly', monthKey] });
    qc.invalidateQueries({ queryKey: ['ceo-overview'] });
  }

  return { approveMonth };
}
