import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post, patch } from '../api/client';
import { EP } from '../api/endpoints';
import type { StockTransfersListResponse, StockTransferHistoryResponse } from '../types/api';

const QK = ['stock-transfers'] as const;

export function useStockTransfersList() {
  return useQuery<StockTransfersListResponse>({
    queryKey:  QK,
    queryFn:   () => get<StockTransfersListResponse>(EP.STOCK_TRANSFERS_LIST),
    staleTime: 30_000,
  });
}

export function useStockTransferCreate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      item_id: number; from_warehouse_id: number; to_warehouse_id: number;
      requested_qty: number; reference?: string; notes?: string;
    }) => post<{ ok: true }>(EP.STOCK_TRANSFERS_CREATE, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useStockTransferApprove() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, rejectionReason }: {
      id: number; action: 'approve' | 'reject'; rejectionReason?: string;
    }) => patch<{ ok: true }>(EP.STOCK_TRANSFERS_APPROVE(id), { action, rejectionReason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useStockTransferDispatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: {
      id: number; qty: number; vehicle_id: number;
      driver_name?: string; dispatched_at?: string; reference?: string; notes?: string;
    }) => post<{ ok: true; dispatch: Record<string, unknown> }>(EP.STOCK_TRANSFERS_DISPATCH(id), payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useStockTransferReceive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, qty, notes }: { id: number; qty: number; notes?: string }) =>
      post<{ ok: true; completed: boolean }>(EP.STOCK_TRANSFERS_RECEIVE(id), { qty, notes }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useStockTransferHistory(transferId: number) {
  return useQuery<StockTransferHistoryResponse>({
    queryKey:  [...QK, 'history', transferId],
    queryFn:   () => get<StockTransferHistoryResponse>(EP.STOCK_TRANSFERS_HISTORY(transferId)),
    staleTime: 0,
  });
}
