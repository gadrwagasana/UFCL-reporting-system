import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../api/client';
import { EP } from '../api/endpoints';
import { ShowroomInventoryResponse, ShowroomDamageListResponse } from '../types/api';

// Timber Lifecycle Phase 3 (Workstream 12) — Showroom Quality/Damage Check.
export function useShowroomInventory() {
  return useQuery<ShowroomInventoryResponse>({
    queryKey: ['showroom-inventory'],
    queryFn:  () => get<ShowroomInventoryResponse>(EP.SHOWROOM_INVENTORY),
    staleTime: 60_000,
  });
}

export function useShowroomDamageList(status?: string) {
  return useQuery<ShowroomDamageListResponse>({
    queryKey: ['showroom-damage-list', status],
    queryFn:  () => get<ShowroomDamageListResponse>(EP.SHOWROOM_DAMAGE_LIST, status ? { status } : undefined),
    staleTime: 60_000,
  });
}

export function useShowroomDamageCreate() {
  const qc = useQueryClient();
  async function report(payload: { stock_item_id: number; warehouse_id: number; quantity: number; reason: string }) {
    const r = await post<{ ok: true; id: number }>(EP.SHOWROOM_DAMAGE_CREATE, payload);
    await qc.invalidateQueries({ queryKey: ['showroom-inventory'] });
    await qc.invalidateQueries({ queryKey: ['showroom-damage-list'] });
    return r;
  }
  return { report };
}
