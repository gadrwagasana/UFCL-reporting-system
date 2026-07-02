import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post, patch, del } from '../api/client';
import { EP } from '../api/endpoints';
import type { SalesListResponse } from '../types/api';

const QK = ['sales-orders'] as const;

export function useSalesOrdersList() {
  return useQuery<SalesListResponse>({
    queryKey:  QK,
    queryFn:   () => get<SalesListResponse>(EP.SALES_LIST),
    staleTime: 30_000,
  });
}

export function useSalesOrderCreate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      order_number:     string;
      customer_id?:     number;
      customer_name:    string;
      product_type:     string;
      product_sub_type?: string;
      product_size:     string;
      quantity:         number;
      unit_price:       number;
      currency:         string;
      price_tax_type:   string;
      payment_due_date?: string;
      notes?:           string;
      reason:           string;
    }) => post<{ ok: true }>(EP.SALES_CREATE, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useSalesOrderUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: {
      id:               number;
      order_number:     string;
      customer_id?:     number;
      customer_name:    string;
      product_type:     string;
      product_sub_type?: string;
      product_size:     string;
      quantity:         number;
      unit_price:       number;
      currency:         string;
      price_tax_type:   string;
      payment_due_date?: string;
      notes?:           string;
    }) => patch<{ ok: true }>(EP.SALES_UPDATE(id), payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useSalesOrderPay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, paymentStatus }: { id: number; paymentStatus: 'Paid' | 'Unpaid' }) =>
      patch<{ ok: true }>(EP.SALES_PAY(id), { paymentStatus }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useSalesOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      patch<{ ok: true }>(EP.SALES_STATUS(id), { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useSalesOrderCloseShort() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => post<{ ok: true }>(EP.SALES_CLOSE_SHORT(id), {}),
    onSuccess:  () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useSalesOrderDelete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
      del<{ ok: true }>(EP.SALES_DELETE(id), { reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useSalesOrderDeliver() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: {
      id:           number;
      driver_name:  string;
      vehicle_id?:  number;
      delivery_date?: string;
      route?:       string;
      notes?:       string;
    }) => post<{ ok: true }>(EP.SALES_DELIVER(id), payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}
