import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post, patch, del } from '../api/client';
import { EP } from '../api/endpoints';
import type { DispatchListResponse } from '../types/api';

const QK = ['dispatch'] as const;

export function useDispatchList() {
  return useQuery<DispatchListResponse>({
    queryKey:  QK,
    queryFn:   () => get<DispatchListResponse>(EP.DISPATCH_LIST),
    staleTime: 30_000,
  });
}

export function useDispatchCreate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { delivery_order_id: number; notes?: string }) =>
      post<{ ok: true }>(EP.DISPATCH_CREATE, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useDispatchReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, notes }: { id: number; status: string; notes?: string }) =>
      patch<{ ok: true }>(EP.DISPATCH_REVIEW(id), { status, notes }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useDispatchDelete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      del<{ ok: true; pendingApproval?: boolean }>(EP.DISPATCH_DELETE(id), { reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}
