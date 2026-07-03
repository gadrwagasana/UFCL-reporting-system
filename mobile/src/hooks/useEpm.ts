import { useQuery } from '@tanstack/react-query';
import { get }      from '../api/client';
import { EP }       from '../api/endpoints';
import type { EpmDashboardResponse, EpmDepartmentsResponse, EpmTrendsResponse } from '../types/api';

export function useEpmDashboard() {
  return useQuery<EpmDashboardResponse>({
    queryKey: ['epm', 'dashboard'],
    queryFn:  () => get<EpmDashboardResponse>(EP.EPM_DASHBOARD),
    staleTime: 5 * 60 * 1000,
  });
}

export function useEpmDepartments() {
  return useQuery<EpmDepartmentsResponse>({
    queryKey: ['epm', 'departments'],
    queryFn:  () => get<EpmDepartmentsResponse>(EP.EPM_DEPARTMENTS),
    staleTime: 5 * 60 * 1000,
  });
}

export function useEpmTrends() {
  return useQuery<EpmTrendsResponse>({
    queryKey: ['epm', 'trends'],
    queryFn:  () => get<EpmTrendsResponse>(EP.EPM_TRENDS),
    staleTime: 5 * 60 * 1000,
  });
}
