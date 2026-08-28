import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post, del } from '../api/client';
import { EP } from '../api/endpoints';
import {
  PolesListResponse, PoleProductionBatchListResponse,
  PoleProductionInspectResult, PoleProductionReconciliation,
  PendingPoleQCListResponse, PoleGoodsReceiptInspectResult, PolesSourceReport,
  PolePendingApproval,
} from '../types/api';

export function usePolesList() {
  return useQuery<PolesListResponse>({
    queryKey:  ['poles-list'],
    queryFn:   () => get<PolesListResponse>(EP.POLES_PURCHASE_LIST),
    staleTime: 2 * 60_000,
  });
}

interface CreatePurchaseRequestPayload {
  supplier_name: string;
  requested_qty: number;
  unit_price?:   number;
  notes?:        string;
}

export function usePolesPurchaseCreate() {
  const qc = useQueryClient();

  async function createRequest(payload: CreatePurchaseRequestPayload): Promise<void> {
    await post(EP.POLES_PURCHASE_CREATE, payload);
    await qc.invalidateQueries({ queryKey: ['poles-list'] });
  }

  return { createRequest };
}

interface CreateDeliveryPayload {
  delivery_date:        string;
  delivered_qty:        number;
  purchase_request_id?: number;
  supplier_name?:       string;
  delivery_note_ref?:   string;
  notes?:               string;
}

export function usePolesDeliveryCreate() {
  const qc = useQueryClient();

  async function createDelivery(payload: CreateDeliveryPayload): Promise<void> {
    await post(EP.POLES_DELIVERY_CREATE, payload);
    await qc.invalidateQueries({ queryKey: ['poles-list'] });
  }

  return { createDelivery };
}

interface QualityCheckPayload {
  approved_qty:      number;
  rejection_reason?: string;
}

export function usePolesQualityCheck(deliveryId: number) {
  const qc = useQueryClient();

  async function submitQC(payload: QualityCheckPayload): Promise<void> {
    await post(EP.POLES_DELIVERY_QC(deliveryId), payload);
    await qc.invalidateQueries({ queryKey: ['poles-list'] });
    await qc.invalidateQueries({ queryKey: ['sawmill-list'] });  // available_qty also affects production validation
  }

  return { submitQC };
}

// ─── Pole Production Batches (Pole Production Phase 1) ────────────────────────
// Batches consume raw logs from the same pooled balance usePolesList reads,
// and produce one or more real Product Catalog output lines, each going
// through Quality Inspection — same shape/pattern as VAT's useVat hooks.

export function usePoleProductionBatches() {
  return useQuery<PoleProductionBatchListResponse>({
    queryKey:  ['pole-production-batches'],
    queryFn:   () => get<PoleProductionBatchListResponse>(EP.POLES_PRODUCTION_LIST),
    staleTime: 2 * 60_000,
  });
}

interface PoleProductionOutputPayload { output_product_id: number; quantity: number }
interface CreatePoleProductionBatchPayload {
  batch_date:        string;
  input_raw_log_qty: number;
  outputs:           PoleProductionOutputPayload[];
  operator?:         string;
  supervisor?:       string;
  machine_id?:       number;
  downtime_minutes?: number;
  downtime_reason?:  string;
  notes?:            string;
  workshop_id?:      number;
}

export function usePoleProductionBatchCreate() {
  const qc = useQueryClient();

  async function createBatch(payload: CreatePoleProductionBatchPayload): Promise<void> {
    await post(EP.POLES_PRODUCTION_CREATE, payload);
    await qc.invalidateQueries({ queryKey: ['pole-production-batches'] });
    await qc.invalidateQueries({ queryKey: ['poles-list'] });
    await qc.invalidateQueries({ queryKey: ['pole-production-reconciliation'] });
  }

  return { createBatch };
}

// ERP Final Enterprise Hardening Phase — was discarding the response and
// always invalidating queries, even when the delete was actually blocked and
// queued for approval (applyGovernance's pendingApproval shape) rather than
// executed — a governance-restricted user would have seen the batch
// optimistically vanish from the list as if deleted. Fixed to match
// useVatDelete's exact pattern: only invalidate on a real delete.
export function usePoleProductionBatchDelete() {
  const qc = useQueryClient();

  async function deleteBatch(id: number, reason: string): Promise<PolePendingApproval | void> {
    const result = await del<PolePendingApproval | { ok: true }>(EP.POLES_PRODUCTION_DELETE(id), { reason });
    if ('pendingApproval' in result && result.pendingApproval) {
      return result as PolePendingApproval;
    }
    await qc.invalidateQueries({ queryKey: ['pole-production-batches'] });
    await qc.invalidateQueries({ queryKey: ['poles-list'] });
  }

  return { deleteBatch };
}

interface PoleProductionInspectPayload {
  approved_qty:      number;
  rejection_reason?: string;
  notes?:            string;
}

export function usePoleProductionInspect() {
  const qc = useQueryClient();

  async function inspect(outputId: number, payload: PoleProductionInspectPayload): Promise<PoleProductionInspectResult> {
    const result = await post<PoleProductionInspectResult>(EP.POLES_PRODUCTION_INSPECT(outputId), payload);
    await qc.invalidateQueries({ queryKey: ['pole-production-batches'] });
    // Pole Production Phase 2 (bug found during audit) — this invalidated a
    // query key ('pole-rejection-holds') nothing ever subscribed to; the
    // real key useRejectionHoldsList (useTimberLifecycle.ts) uses is
    // 'rejection-holds-list'. Inert while no mobile screen read rejection
    // holds (Phase 1), but would have silently served stale data to the new
    // PoleRejectionHoldsScreen this phase adds — fixed at the source.
    await qc.invalidateQueries({ queryKey: ['rejection-holds-list'] });
    await qc.invalidateQueries({ queryKey: ['pole-production-reconciliation'] });
    return result;
  }

  return { inspect };
}

export function usePoleProductionReconciliation() {
  return useQuery<PoleProductionReconciliation>({
    queryKey:  ['pole-production-reconciliation'],
    queryFn:   () => get<PoleProductionReconciliation>(EP.POLES_PRODUCTION_RECONCILIATION),
    staleTime: 60_000,
  });
}

// ─── Purchased Finished Poles (Pole Production Phase 2) ────────────────────────
// A purchased-pole goods-receipt line is held at qc_status='pending_qc'
// instead of posting straight to stock (procurementGoodsReceiptCreate) —
// these hooks are the queue/action for that hold, same shape as the
// manufactured-pole batch hooks above.

export function usePendingPoleQC() {
  return useQuery<PendingPoleQCListResponse>({
    queryKey:  ['pending-pole-qc'],
    queryFn:   () => get<PendingPoleQCListResponse>(EP.POLES_PURCHASED_PENDING_QC),
    staleTime: 60_000,
  });
}

interface PoleGoodsReceiptInspectPayload {
  approved_qty:      number;
  rejection_reason?: string;
  notes?:            string;
}

export function usePoleGoodsReceiptInspect() {
  const qc = useQueryClient();

  async function inspect(receiptItemId: number, payload: PoleGoodsReceiptInspectPayload): Promise<PoleGoodsReceiptInspectResult> {
    const result = await post<PoleGoodsReceiptInspectResult>(EP.POLES_PURCHASED_INSPECT(receiptItemId), payload);
    await qc.invalidateQueries({ queryKey: ['pending-pole-qc'] });
    await qc.invalidateQueries({ queryKey: ['rejection-holds-list'] });
    await qc.invalidateQueries({ queryKey: ['poles-source-report'] });
    return result;
  }

  return { inspect };
}

export function usePolesSourceReport() {
  return useQuery<PolesSourceReport>({
    queryKey:  ['poles-source-report'],
    queryFn:   () => get<PolesSourceReport>(EP.POLES_SOURCE_REPORT),
    staleTime: 60_000,
  });
}
