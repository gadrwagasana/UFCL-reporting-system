import { useQuery } from '@tanstack/react-query';
import { get } from '../api/client';
import { EP } from '../api/endpoints';

interface OverviewData {
  ok: true;
  harvest?: { log_count?: number; total_trees?: number };
  sawmill?: { volume_m3?: number };
  poles?: { total_units?: number };
  sales?: { total_orders?: number; total_revenue?: number };
  pendingPolesRequests?: number;
  pendingMonthlyApproval?: boolean;
  [key: string]: unknown;
}

export function useCeoOverview() {
  return useQuery<OverviewData>({
    queryKey: ['ceo-overview'],
    queryFn:  () => get<OverviewData>(EP.CEO_OVERVIEW),
    staleTime: 5 * 60_000,
  });
}
