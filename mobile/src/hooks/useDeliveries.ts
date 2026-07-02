import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post, patch, del } from '../api/client';
import { EP } from '../api/endpoints';
import { DeliveryListResponse, DeliveryStatus } from '../types/api';

const QK = ['delivery-list'] as const;

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
    queryKey:  QK,
    queryFn:   () => get<DeliveryListResponse>(EP.DELIVERY_LIST),
    staleTime: 30_000,
  });
}

export function useDeliveryStatusUpdate() {
  const qc = useQueryClient();

  async function updateStatus(id: number, status: DeliveryStatus): Promise<void> {
    await post(EP.DELIVERY_STATUS(id), { status });
    await qc.invalidateQueries({ queryKey: QK });
  }

  return { updateStatus };
}

export function useDeliveryCreate() {
  const qc = useQueryClient();

  async function createDelivery(payload: CreateDeliveryPayload): Promise<void> {
    await post(EP.DELIVERY_CREATE, payload);
    await qc.invalidateQueries({ queryKey: QK });
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
    await qc.invalidateQueries({ queryKey: QK });
  }

  return { recordPOD };
}

export function useDeliveryUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: {
      id:             number;
      driver_name:    string;
      vehicle_id?:    number | null;
      delivery_date?: string | null;
      route?:         string;
      notes?:         string;
      qty_dispatched?: number | null;
    }) => patch<{ ok: true }>(EP.DELIVERY_UPDATE(id), payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useDeliveryDelete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
      del<{ ok: true }>(EP.DELIVERY_DELETE(id), { reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}
