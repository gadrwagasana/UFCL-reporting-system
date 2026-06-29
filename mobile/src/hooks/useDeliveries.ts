import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../api/client';
import { EP } from '../api/endpoints';
import { DeliveryListResponse, DeliveryStatus } from '../types/api';

interface CreateDeliveryPayload {
  driver_name:      string;
  vehicle_id?:      number;
  sales_order_id?:  number;
  qty_dispatched?:  number;
  delivery_date?:   string;
  route?:           string;
  notes?:           string;
}

export function useDeliveryList() {
  return useQuery<DeliveryListResponse>({
    queryKey:  ['delivery-list'],
    queryFn:   () => get<DeliveryListResponse>(EP.DELIVERY_LIST),
    staleTime: 2 * 60_000,
  });
}

export function useDeliveryStatusUpdate() {
  const qc = useQueryClient();

  async function updateStatus(id: number, status: DeliveryStatus): Promise<void> {
    await post(EP.DELIVERY_STATUS(id), { status });
    await qc.invalidateQueries({ queryKey: ['delivery-list'] });
  }

  return { updateStatus };
}

export function useDeliveryCreate() {
  const qc = useQueryClient();

  async function createDelivery(payload: CreateDeliveryPayload): Promise<void> {
    await post(EP.DELIVERY_CREATE, payload);
    await qc.invalidateQueries({ queryKey: ['delivery-list'] });
  }

  return { createDelivery };
}

export function usePODCreate() {
  const qc = useQueryClient();

  async function recordPOD(
    id: number,
    payload: { qty_accepted: number; rejection_reason?: string },
  ): Promise<void> {
    await post(EP.DELIVERY_POD(id), payload);
    await qc.invalidateQueries({ queryKey: ['delivery-list'] });
  }

  return { recordPOD };
}
