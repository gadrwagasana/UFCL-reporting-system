import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../api/client';
import { EP } from '../api/endpoints';
import { MaterialRequestsListResponse, StockItemsResponse, MechanicianDashboardResponse } from '../types/api';

export function useMaterialRequests() {
  return useQuery<MaterialRequestsListResponse>({
    queryKey:  ['material-requests'],
    queryFn:   () => get<MaterialRequestsListResponse>(EP.MATERIAL_LIST),
    staleTime: 2 * 60_000,
  });
}

// Mechanician Phase 1 (Priority 5) — tailored dashboard for the mechanician role.
export function useMechanicianDashboard() {
  return useQuery<MechanicianDashboardResponse>({
    queryKey:  ['mechanician-dashboard'],
    queryFn:   () => get<MechanicianDashboardResponse>(EP.DASHBOARD_MECHANICIAN),
    staleTime: 60_000,
  });
}

export function useStockItems() {
  return useQuery<StockItemsResponse>({
    queryKey:  ['meta-stock-items'],
    queryFn:   () => get<StockItemsResponse>(EP.META_STOCK_ITEMS),
    staleTime: 10 * 60_000,
  });
}

interface CreateMaterialRequestPayload {
  item_id:       number;
  requested_qty: number;
  reason?:       string;
  priority?:     'normal' | 'high' | 'urgent';
  needed_by?:    string;
  workshop_id?:  number;
}

export function useMaterialRequestCreate() {
  const qc = useQueryClient();

  async function createRequest(payload: CreateMaterialRequestPayload): Promise<void> {
    await post(EP.MATERIAL_CREATE, payload);
    await qc.invalidateQueries({ queryKey: ['material-requests'] });
    await qc.invalidateQueries({ queryKey: ['my-requests'] });
  }

  return { createRequest };
}
