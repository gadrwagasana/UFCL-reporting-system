import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post, put, del } from '../api/client';
import { EP } from '../api/endpoints';
import {
  VapAvailableInputsResponse, VapBatchListResponse, VapInspectResult,
  VapReconciliationResponse, VapReportResponse, VapPendingApproval,
} from '../types/api';

// Nyanza Value-Added Production & Finished Products Completion Phase —
// generalizes what was "VAT (Value-Added Timber)" into a batch +
// input/output-lines model. See db/migrate.js
// createNyanzaValueAddedProduction() for the schema/rationale.

export function useVatAvailableInputs() {
  return useQuery<VapAvailableInputsResponse>({
    queryKey:  ['vap-available-inputs'],
    queryFn:   () => get<VapAvailableInputsResponse>(EP.VAT_AVAILABLE_INPUTS),
    staleTime: 60_000,
  });
}

export function useVatList() {
  return useQuery<VapBatchListResponse>({
    queryKey:  ['vat-list'],
    queryFn:   () => get<VapBatchListResponse>(EP.VAT_LIST),
    staleTime: 2 * 60_000,
  });
}

export interface VapInputLinePayload  { stock_item_id: number; quantity: number }
export interface VapOutputLinePayload { output_product_id: number; quantity: number }
export interface CreateVapBatchPayload {
  batch_date:        string;
  production_type?:  string;
  customer_id?:       number;
  order_reference?:  string;
  operator?:         string;
  supervisor?:       string;
  notes?:            string;
  inputs:            VapInputLinePayload[];
  outputs:           VapOutputLinePayload[];
}

export function useVatCreate() {
  const qc = useQueryClient();

  async function createBatch(payload: CreateVapBatchPayload): Promise<void> {
    await post(EP.VAT_CREATE, payload);
    await qc.invalidateQueries({ queryKey: ['vat-list'] });
    await qc.invalidateQueries({ queryKey: ['vap-available-inputs'] });
    await qc.invalidateQueries({ queryKey: ['vap-report'] });
  }

  return { createBatch };
}

// ERP Enterprise Cross-Department Verification — this hook existed but was
// never called from any screen (a real backend=YES/desktop=YES/mobile=NO
// gap found during audit). Now wired into VatProcessingScreen's BatchCard.
// pendingApproval handling added to match every other governed-delete hook
// in this codebase (e.g. useMachineFuelDelete) — the previous version
// silently proceeded to invalidateQueries/return void even when governance
// blocked the delete pending approval, since `del()` doesn't throw on a
// {ok:false, pendingApproval:true} response (that shape is sent as HTTP 200
// by respond.js specifically so it doesn't reject like a real error).
// Final Enterprise Completion Gate — same class of gap as useVatDelete
// above: valueAddedProductionBatchUpdate has full backend/IPC/desktop
// wiring (renderer/app.js) but was never exposed on mobile at all (no hook
// called it, VAT_UPDATE was declared in endpoints.ts but referenced
// nowhere). Metadata-only, matching the backend's own boundary — input/
// output lines already have real stock/QC consequences attached and stay
// uneditable after creation on both platforms.
export interface UpdateVapBatchPayload {
  batch_date:       string;
  production_type?: string | null;
  customer_id?:     number | null;
  order_reference?: string | null;
  operator?:        string | null;
  supervisor?:      string | null;
  notes?:           string | null;
}

export function useVatUpdate() {
  const qc = useQueryClient();
  async function updateBatch(id: number, payload: UpdateVapBatchPayload): Promise<VapPendingApproval | void> {
    const result = await put<VapPendingApproval | { ok: true }>(EP.VAT_UPDATE(id), payload);
    if ('pendingApproval' in result && result.pendingApproval) {
      return result as VapPendingApproval;
    }
    await qc.invalidateQueries({ queryKey: ['vat-list'] });
  }
  return { updateBatch };
}

export function useVatDelete() {
  const qc = useQueryClient();
  async function deleteBatch(id: number, reason: string): Promise<VapPendingApproval | void> {
    const result = await del<VapPendingApproval | { ok: true }>(EP.VAT_DELETE(id), { reason });
    if ('pendingApproval' in result && result.pendingApproval) {
      return result as VapPendingApproval;
    }
    await qc.invalidateQueries({ queryKey: ['vat-list'] });
    await qc.invalidateQueries({ queryKey: ['vap-available-inputs'] });
  }
  return { deleteBatch };
}

// Value-Added Quality Inspection — now per output line rather than per raw
// VAT entry; output_product_id was already chosen at output-line creation,
// so there's no product-inference step on this side either.
export function useVatInspect() {
  const qc = useQueryClient();
  async function inspect(outputId: number, payload: { approved_qty: number; rejection_reason?: string; notes?: string }): Promise<VapInspectResult> {
    const r = await post<VapInspectResult>(EP.VAT_INSPECT(outputId), payload);
    await qc.invalidateQueries({ queryKey: ['vat-list'] });
    await qc.invalidateQueries({ queryKey: ['rejection-holds-list'] });
    await qc.invalidateQueries({ queryKey: ['quality-report'] });
    await qc.invalidateQueries({ queryKey: ['vap-report'] });
    return r;
  }
  return { inspect };
}

export function useVatReconciliation() {
  return useQuery<VapReconciliationResponse>({
    queryKey:  ['vap-reconciliation'],
    queryFn:   () => get<VapReconciliationResponse>(EP.VAT_RECONCILIATION),
    staleTime: 60_000,
  });
}

export function useVatReport() {
  return useQuery<VapReportResponse>({
    queryKey:  ['vap-report'],
    queryFn:   () => get<VapReportResponse>(EP.VAT_REPORT),
    staleTime: 60_000,
  });
}
