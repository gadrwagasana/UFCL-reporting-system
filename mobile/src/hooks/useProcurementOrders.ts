import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post, patch } from '../api/client';
import { EP } from '../api/endpoints';
import type {
  ProcurementPurchaseOrder, ProcurementPoItem, ProcurementGoodsReceipt, ProcurementGoodsReceiptItem,
  ProcurementPoFulfillment, ProcurementApprovalStep,
} from '../types/api';

interface PosResponse { ok: true; rows: ProcurementPurchaseOrder[] }
interface PoDetailResponse {
  ok: true; po: ProcurementPurchaseOrder; items: ProcurementPoItem[];
  fulfillment: ProcurementPoFulfillment; steps: ProcurementApprovalStep[];
}
interface PoPdfHtmlResponse { ok: true; html: string }
interface ReceiptsResponse { ok: true; rows: ProcurementGoodsReceipt[] }
interface ReceiptDetailResponse { ok: true; receipt: ProcurementGoodsReceipt; items: ProcurementGoodsReceiptItem[] }
interface PoShortageReportsResponse {
  ok: true;
  closedWithShortageOrders: { id: number; po_number: string; supplier_name: string; shortage_reason: string; shortage_supplier_explanation: string | null; requested_by_name: string | null; shortage_requested_at: string; shortage_closed_at: string | null }[];
  outstandingQtyBySupplier: { supplier_name: string; outstanding_qty: number }[];
  supplierShortageHistory: { po_number: string; supplier_name: string; status: string; shortage_reason: string; requested_by_name: string | null; shortage_requested_at: string; shortage_closed_at: string | null }[];
  mostCommonShortageReasons: { shortage_reason: string; n: number }[];
  topSuppliersByShortageValue: { supplier_name: string; shortage_value: number }[];
  supplierFulfillmentRate: { supplier_name: string; delivered_qty_pct: number }[];
  avgSupplierCompletionRate: { supplier_name: string; avg_fulfillment_pct: number }[];
}

export function useProcurementPos(filters: { status?: string } = {}) {
  return useQuery<PosResponse>({
    queryKey: ['procurement-pos', filters],
    queryFn:  () => get<PosResponse>(EP.PROCUREMENT_POS, filters as Record<string, unknown>),
    staleTime: 30_000,
  });
}

export function useProcurementPoDetail(id: number) {
  return useQuery<PoDetailResponse>({
    queryKey: ['procurement-po', id],
    queryFn:  () => get<PoDetailResponse>(EP.PROCUREMENT_PO(id)),
    enabled:  !!id,
  });
}

export function useProcurementPoPdfHtml(id: number, enabled: boolean) {
  return useQuery<PoPdfHtmlResponse>({
    queryKey: ['procurement-po-pdf', id],
    queryFn:  () => get<PoPdfHtmlResponse>(EP.PROCUREMENT_PO_PDF_HTML(id)),
    enabled:  enabled && !!id,
  });
}

export function useProcurementGoodsReceipts() {
  return useQuery<ReceiptsResponse>({
    queryKey: ['procurement-receipts'],
    queryFn:  () => get<ReceiptsResponse>(EP.PROCUREMENT_RECEIPTS),
    staleTime: 30_000,
  });
}

export function useProcurementGoodsReceiptDetail(id: number) {
  return useQuery<ReceiptDetailResponse>({
    queryKey: ['procurement-receipt', id],
    queryFn:  () => get<ReceiptDetailResponse>(EP.PROCUREMENT_RECEIPT(id)),
    enabled:  !!id,
  });
}

export function useProcurementOrderActions() {
  const qc = useQueryClient();

  return {
    async generate(requisitionId: number, quotationId: number) {
      const res = await post<{ ok: boolean; id?: number; error?: string }>(EP.PROCUREMENT_PO_GENERATE, { requisitionId, quotationId });
      await qc.invalidateQueries({ queryKey: ['procurement-pos'] });
      await qc.invalidateQueries({ queryKey: ['procurement-requisitions'] });
      return res;
    },
    async update(id: number, payload: Partial<ProcurementPurchaseOrder>) {
      await patch(EP.PROCUREMENT_PO(id), payload);
      await qc.invalidateQueries({ queryKey: ['procurement-po', id] });
    },
    async recordReceipt(poId: number, payload: {
      items: Array<{ po_item_id: number; quantity_received: number; quantity_rejected?: number; rejection_reason?: string; notes?: string }>;
      notes?: string;
    }) {
      const res = await post<{ ok: boolean; id?: number; error?: string }>(EP.PROCUREMENT_PO_RECEIPTS(poId), payload);
      await qc.invalidateQueries({ queryKey: ['procurement-receipts'] });
      await qc.invalidateQueries({ queryKey: ['procurement-po', poId] });
      await qc.invalidateQueries({ queryKey: ['procurement-pos'] });
      return res;
    },
    // Procurement Exception Management Phase 3 — Close with Shortage.
    async closeWithShortage(poId: number, reason: string, supplierExplanation?: string) {
      const res = await post<{ ok: boolean; outstandingQty?: number; outstandingValue?: number; stages?: string[]; error?: string }>(
        EP.PROCUREMENT_PO_CLOSE_SHORTAGE(poId), { reason, supplierExplanation });
      await qc.invalidateQueries({ queryKey: ['procurement-po', poId] });
      await qc.invalidateQueries({ queryKey: ['procurement-pos'] });
      return res;
    },
    async decideShortage(poId: number, decision: 'approved' | 'rejected', notes?: string) {
      const res = await post<{ ok: boolean; status?: string; error?: string }>(EP.PROCUREMENT_PO_APPROVE(poId), { decision, notes });
      await qc.invalidateQueries({ queryKey: ['procurement-po', poId] });
      await qc.invalidateQueries({ queryKey: ['procurement-pos'] });
      return res;
    },
  };
}

// Procurement Exception Management Phase 3 — mirrors
// useProcurementRequisitionRevisionReports' shape exactly.
export function useProcurementPoShortageReports() {
  return useQuery<PoShortageReportsResponse>({
    queryKey: ['procurement-po-shortage-reports'],
    queryFn:  () => get<PoShortageReportsResponse>(EP.PROCUREMENT_REPORT_PO_SHORTAGES),
    staleTime: 60_000,
  });
}
