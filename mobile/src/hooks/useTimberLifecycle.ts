import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../api/client';
import { EP } from '../api/endpoints';
import {
  HarvestWasteListResponse, HarvestWasteCategoriesResponse, HarvestWasteCreateResult,
  ResolutionsListResponse, ResolutionCreateResult, ResolutionSourceType, ResolutionDestination,
  ProductionOffcutsListResponse, ProductionReconciliationResponse,
  RejectionHoldsListResponse, QualityReportResponse, QualityInspectionCreateResult,
} from '../types/api';

// Enterprise Timber Lifecycle Integration Program — Phase 1.

export function useHarvestWasteCategories() {
  return useQuery<HarvestWasteCategoriesResponse>({
    queryKey: ['harvest-waste-categories'],
    queryFn:  () => get<HarvestWasteCategoriesResponse>(EP.HARVEST_WASTE_CATEGORIES),
    staleTime: 5 * 60_000,
  });
}

export function useHarvestWasteList() {
  return useQuery<HarvestWasteListResponse>({
    queryKey: ['harvest-waste-list'],
    queryFn:  () => get<HarvestWasteListResponse>(EP.HARVEST_WASTE_LIST),
    staleTime: 60_000,
  });
}

export interface HarvestWasteCreatePayload {
  harvest_log_id: number; category_id?: number; volume_logs: number; supervisor: string; reason: string;
}
export function useHarvestWasteCreate() {
  const qc = useQueryClient();
  async function createWaste(payload: HarvestWasteCreatePayload): Promise<HarvestWasteCreateResult> {
    const result = await post<HarvestWasteCreateResult>(EP.HARVEST_WASTE_CREATE, payload);
    await qc.invalidateQueries({ queryKey: ['harvest-waste-list'] });
    await qc.invalidateQueries({ queryKey: ['harvest-dashboard'] });
    return result;
  }
  return { createWaste };
}

export interface ResolutionCreatePayload {
  source_type: ResolutionSourceType; source_id: number; destination: ResolutionDestination;
  destination_detail?: string; volume: number; unit_cost?: number; warehouse_id?: number; notes?: string;
}
export function useResolutionsList(sourceType?: ResolutionSourceType) {
  return useQuery<ResolutionsListResponse>({
    queryKey: ['resolutions-list', sourceType],
    queryFn:  () => get<ResolutionsListResponse>(EP.RESOLUTIONS_LIST, sourceType ? { sourceType } : undefined),
    staleTime: 60_000,
  });
}
export function useResolutionCreate() {
  const qc = useQueryClient();
  async function resolve(payload: ResolutionCreatePayload): Promise<ResolutionCreateResult> {
    const result = await post<ResolutionCreateResult>(EP.RESOLUTIONS_CREATE, payload);
    await qc.invalidateQueries({ queryKey: ['resolutions-list'] });
    await qc.invalidateQueries({ queryKey: ['harvest-waste-list'] });
    await qc.invalidateQueries({ queryKey: ['production-offcuts-list'] });
    await qc.invalidateQueries({ queryKey: ['production-reconciliation'] });
    return result;
  }
  return { resolve };
}

export function useProductionOffcutsList(status?: string) {
  return useQuery<ProductionOffcutsListResponse>({
    queryKey: ['production-offcuts-list', status],
    queryFn:  () => get<ProductionOffcutsListResponse>(EP.PRODUCTION_OFFCUTS_LIST, status ? { status } : undefined),
    staleTime: 60_000,
  });
}
export function useProductionReconciliation() {
  return useQuery<ProductionReconciliationResponse>({
    queryKey: ['production-reconciliation'],
    queryFn:  () => get<ProductionReconciliationResponse>(EP.PRODUCTION_RECONCILIATION),
    staleTime: 60_000,
  });
}
export function useProductionOffcutActions() {
  const qc = useQueryClient();
  async function createOffcut(daily_log_id: number, quantity: number) {
    const r = await post(EP.PRODUCTION_OFFCUTS_CREATE, { daily_log_id, quantity });
    await qc.invalidateQueries({ queryKey: ['production-offcuts-list'] });
    await qc.invalidateQueries({ queryKey: ['production-reconciliation'] });
    return r;
  }
  async function decide(offcutId: number, recoverable: boolean) {
    const r = await post(EP.PRODUCTION_OFFCUTS_DECIDE(offcutId), { recoverable });
    await qc.invalidateQueries({ queryKey: ['production-offcuts-list'] });
    return r;
  }
  async function recordRecovery(offcutId: number, payload: { machine_id: number; recovered_quantity: number; width_mm?: number; thickness_mm?: number; length_m?: number }) {
    const r = await post(EP.PRODUCTION_OFFCUTS_RECOVERY(offcutId), payload);
    await qc.invalidateQueries({ queryKey: ['production-offcuts-list'] });
    return r;
  }
  async function inspect(offcutId: number, payload: { approved_qty: number; rejection_reason?: string; notes?: string }): Promise<QualityInspectionCreateResult> {
    const r = await post<QualityInspectionCreateResult>(EP.PRODUCTION_OFFCUTS_INSPECT(offcutId), payload);
    await qc.invalidateQueries({ queryKey: ['production-offcuts-list'] });
    await qc.invalidateQueries({ queryKey: ['production-reconciliation'] });
    await qc.invalidateQueries({ queryKey: ['rejection-holds-list'] });
    return r;
  }
  return { createOffcut, decide, recordRecovery, inspect };
}

// Timber Lifecycle Phase 2 (Workstream 3/4/13) — Rejection Holds.
// Phase 3: sourceType ('sawmill' | 'value_added') scopes to one department;
// omit for both.
export function useRejectionHoldsList(status?: string, sourceType?: string) {
  return useQuery<RejectionHoldsListResponse>({
    queryKey: ['rejection-holds-list', status, sourceType],
    queryFn:  () => get<RejectionHoldsListResponse>(EP.REJECTION_HOLDS_LIST, { ...(status ? { status } : {}), ...(sourceType ? { sourceType } : {}) }),
    staleTime: 60_000,
  });
}
export function useQualityReport() {
  return useQuery<QualityReportResponse>({
    queryKey: ['quality-report'],
    queryFn:  () => get<QualityReportResponse>(EP.QUALITY_REPORT),
    staleTime: 60_000,
  });
}
export function useRejectionHoldActions() {
  const qc = useQueryClient();
  function invalidate() {
    return Promise.all([
      qc.invalidateQueries({ queryKey: ['rejection-holds-list'] }),
      qc.invalidateQueries({ queryKey: ['production-offcuts-list'] }),
      qc.invalidateQueries({ queryKey: ['quality-report'] }),
      qc.invalidateQueries({ queryKey: ['vat-list'] }),
    ]);
  }
  // Timber Lifecycle Phase 3 — the hold's source (Sawmill offcut vs. VAT
  // production output) determines which id comes back; only one is ever set.
  async function rework(holdId: number) {
    const r = await post<{ ok: true; newOffcutId?: number; newOutputId?: number }>(EP.REJECTION_HOLDS_REWORK(holdId), {});
    await invalidate();
    return r;
  }
  async function downgrade(holdId: number, payload: { downgrade_product_id: number; reason?: string }) {
    const r = await post(EP.REJECTION_HOLDS_DOWNGRADE(holdId), payload);
    await invalidate();
    return r;
  }
  async function returnToInventory(holdId: number, reason: string) {
    const r = await post(EP.REJECTION_HOLDS_RETURN(holdId), { reason });
    await invalidate();
    return r;
  }
  return { rework, downgrade, returnToInventory };
}
