import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post, patch } from '../api/client';
import { EP } from '../api/endpoints';
import type { ProcurementRequisition, ProcurementRequisitionItem, ProcurementApprovalStep, ProcurementRequisitionRevision, WarehouseRef } from '../types/api';

interface RequisitionsResponse { ok: true; rows: ProcurementRequisition[] }
interface WorkshopsResponse { ok: true; rows: WarehouseRef[] }
interface RequisitionRevisionReportsResponse {
  ok: true;
  outcomeCounts: { status: string; n: number }[];
  revisionCount: { id: number; requisition_number: string; title: string; revision_count: number }[];
  avgRevisionTimeHours: number;
  mostRevisedDepartments: { department: string; revisions: number }[];
  mostCommonRevisionReasons: { reviewer_notes: string; n: number }[];
}

// Phase 2B, Priority 4: workshopsForDropdown (data.js) backs this endpoint —
// unrestricted, so any requester can populate this picker. Mirrors
// useStockItems in useMaterialRequests.ts for the same reason.
export function useWorkshops() {
  return useQuery<WorkshopsResponse>({
    queryKey:  ['meta-workshops'],
    queryFn:   () => get<WorkshopsResponse>(EP.META_WAREHOUSES),
    staleTime: 10 * 60_000,
  });
}
interface RequisitionDetailResponse {
  ok: true;
  requisition: ProcurementRequisition;
  items: ProcurementRequisitionItem[];
  steps: ProcurementApprovalStep[];
  revisions: ProcurementRequisitionRevision[];
}

export interface RequisitionItemInput {
  description: string;
  quantity: number;
  unit?: string;
  estimated_unit_price?: number;
  stock_item_id?: number;
}

export interface RequisitionPayload {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  budget_code?: string;
  department?: string;
  workshop_id?: number;
  items: RequisitionItemInput[];
}

export function useProcurementRequisitions(filters: { status?: string } = {}) {
  return useQuery<RequisitionsResponse>({
    queryKey: ['procurement-requisitions', filters],
    queryFn:  () => get<RequisitionsResponse>(EP.PROCUREMENT_REQUISITIONS, filters as Record<string, unknown>),
    staleTime: 30_000,
  });
}

export function useProcurementRequisitionDetail(id: number) {
  return useQuery<RequisitionDetailResponse>({
    queryKey: ['procurement-requisition', id],
    queryFn:  () => get<RequisitionDetailResponse>(EP.PROCUREMENT_REQUISITION(id)),
    enabled:  !!id,
  });
}

export function useProcurementRequisitionActions() {
  const qc = useQueryClient();
  const invalidate = (id?: number) => {
    qc.invalidateQueries({ queryKey: ['procurement-requisitions'] });
    if (id) qc.invalidateQueries({ queryKey: ['procurement-requisition', id] });
  };

  return {
    async create(payload: RequisitionPayload): Promise<{ ok: boolean; id?: number; error?: string }> {
      const res = await post<{ ok: boolean; id?: number; error?: string }>(EP.PROCUREMENT_REQUISITIONS, payload);
      await invalidate();
      return res;
    },
    async update(id: number, payload: Partial<RequisitionPayload>) {
      await patch(EP.PROCUREMENT_REQUISITION(id), payload);
      await invalidate(id);
    },
    async submit(id: number) {
      await post(EP.PROCUREMENT_REQUISITION_SUBMIT(id), {});
      await invalidate(id);
    },
    async cancel(id: number, reason?: string) {
      await post(EP.PROCUREMENT_REQUISITION_CANCEL(id), { reason });
      await invalidate(id);
    },
    async decide(id: number, decision: 'approved' | 'rejected' | 'returned_for_revision', notes?: string) {
      await post(EP.PROCUREMENT_REQUISITION_APPROVE(id), { decision, notes });
      await invalidate(id);
    },
  };
}

// Procurement Exception Management Phase 2 — Return for Revision reporting.
// Mirrors desktop's Revisions tab on the Procurement Reports page; mobile
// already has a ProcurementReportsScreen (unlike Maintenance/Inventory,
// where reports stayed desktop-only), so this follows that existing parity.
export function useProcurementRequisitionRevisionReports() {
  return useQuery<RequisitionRevisionReportsResponse>({
    queryKey: ['procurement-requisition-revision-reports'],
    queryFn:  () => get<RequisitionRevisionReportsResponse>(EP.PROCUREMENT_REPORT_REVISIONS),
    staleTime: 60_000,
  });
}
