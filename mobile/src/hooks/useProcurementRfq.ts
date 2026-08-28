import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../api/client';
import { EP } from '../api/endpoints';
import type { ProcurementRfq, ProcurementRfqSupplier, ProcurementQuotation } from '../types/api';

interface RfqsResponse { ok: true; rows: ProcurementRfq[] }
interface RfqDetailResponse { ok: true; rfq: ProcurementRfq; suppliers: ProcurementRfqSupplier[]; quotations: ProcurementQuotation[] }
interface CompareResponse { ok: true; rows: ProcurementQuotation[] }

export function useProcurementRfqs() {
  return useQuery<RfqsResponse>({
    queryKey: ['procurement-rfqs'],
    queryFn:  () => get<RfqsResponse>(EP.PROCUREMENT_RFQS),
    staleTime: 30_000,
  });
}

export function useProcurementRfqDetail(id: number) {
  return useQuery<RfqDetailResponse>({
    queryKey: ['procurement-rfq', id],
    queryFn:  () => get<RfqDetailResponse>(EP.PROCUREMENT_RFQ(id)),
    enabled:  !!id,
  });
}

export function useProcurementQuotationsCompare(rfqId: number) {
  return useQuery<CompareResponse>({
    queryKey: ['procurement-rfq-compare', rfqId],
    queryFn:  () => get<CompareResponse>(EP.PROCUREMENT_RFQ_COMPARE(rfqId)),
    enabled:  !!rfqId,
  });
}

export function useProcurementRfqActions() {
  const qc = useQueryClient();

  return {
    async create(requisitionId: number, payload: { title?: string; due_date?: string }) {
      const res = await post<{ ok: boolean; id?: number }>(EP.PROCUREMENT_RFQ_CREATE(requisitionId), payload);
      await qc.invalidateQueries({ queryKey: ['procurement-rfqs'] });
      return res;
    },
    async sendToSuppliers(rfqId: number, supplierIds: number[]) {
      await post(EP.PROCUREMENT_RFQ_SEND(rfqId), { supplierIds });
      await qc.invalidateQueries({ queryKey: ['procurement-rfq', rfqId] });
    },
    async submitQuotation(rfqId: number, supplierId: number, payload: { quoted_amount: number; delivery_days?: number; terms?: string; notes?: string }) {
      await post(EP.PROCUREMENT_RFQ_QUOTATIONS(rfqId), { supplierId, ...payload });
      await qc.invalidateQueries({ queryKey: ['procurement-rfq', rfqId] });
      await qc.invalidateQueries({ queryKey: ['procurement-rfq-compare', rfqId] });
    },
    async selectQuotation(quotationId: number, rfqId: number) {
      await post(EP.PROCUREMENT_QUOTATION_SELECT(quotationId), {});
      await qc.invalidateQueries({ queryKey: ['procurement-rfq', rfqId] });
      await qc.invalidateQueries({ queryKey: ['procurement-rfq-compare', rfqId] });
    },
  };
}
