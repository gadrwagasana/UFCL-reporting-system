import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../api/client';
import { EP } from '../api/endpoints';
import { PolesListResponse } from '../types/api';

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
