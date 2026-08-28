import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../api/client';
import { EP } from '../api/endpoints';
import type { ProcurementInvoice, ProcurementPayment } from '../types/api';

interface InvoicesResponse { ok: true; rows: ProcurementInvoice[] }
interface PaymentsResponse { ok: true; rows: ProcurementPayment[] }
interface MatchResponse { ok: true; matched: boolean; variancePct: number; poTotal: number; receivedValue: number; invoiceAmount: number }

export function useProcurementInvoices(filters: { status?: string } = {}) {
  return useQuery<InvoicesResponse>({
    queryKey: ['procurement-invoices', filters],
    queryFn:  () => get<InvoicesResponse>(EP.PROCUREMENT_INVOICES, filters as Record<string, unknown>),
    staleTime: 30_000,
  });
}

export function useProcurementPayments() {
  return useQuery<PaymentsResponse>({
    queryKey: ['procurement-payments'],
    queryFn:  () => get<PaymentsResponse>(EP.PROCUREMENT_PAYMENTS),
    staleTime: 30_000,
  });
}

export function useProcurementInvoiceActions() {
  const qc = useQueryClient();
  const invalidateInvoices = () => qc.invalidateQueries({ queryKey: ['procurement-invoices'] });

  return {
    async create(poId: number, payload: { invoice_number: string; invoice_date?: string; invoice_amount: number }) {
      const res = await post<{ ok: boolean; id?: number; error?: string }>(EP.PROCUREMENT_INVOICE_CREATE(poId), payload);
      await invalidateInvoices();
      return res;
    },
    async match(id: number): Promise<MatchResponse> {
      const res = await post<MatchResponse>(EP.PROCUREMENT_INVOICE_MATCH(id), {});
      await invalidateInvoices();
      return res;
    },
    async decide(id: number, decision: 'approved' | 'rejected', notes?: string) {
      await post(EP.PROCUREMENT_INVOICE_APPROVE(id), { decision, notes });
      await invalidateInvoices();
    },
    async createPayment(invoiceId: number, payload: { amount?: number; payment_date?: string; payment_method?: string; reference?: string }) {
      const res = await post<{ ok: boolean; id?: number; error?: string }>(EP.PROCUREMENT_PAYMENT_CREATE(invoiceId), payload);
      await qc.invalidateQueries({ queryKey: ['procurement-payments'] });
      return res;
    },
    async decidePayment(id: number, decision: 'approved' | 'rejected', notes?: string) {
      await post(EP.PROCUREMENT_PAYMENT_APPROVE(id), { decision, notes });
      await qc.invalidateQueries({ queryKey: ['procurement-payments'] });
      await invalidateInvoices();
    },
  };
}
