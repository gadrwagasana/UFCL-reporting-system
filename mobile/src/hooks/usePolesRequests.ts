import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../api/client';
import { EP } from '../api/endpoints';
import { PolesRequest, ListResponse } from '../types/api';

export function usePolesRequests() {
  return useQuery<ListResponse<PolesRequest>>({
    queryKey: ['ceo-poles-requests'],
    queryFn:  () => get<ListResponse<PolesRequest>>(EP.CEO_POLES_REQUESTS),
    staleTime: 2 * 60_000,
  });
}

export function usePolesApprove() {
  const qc = useQueryClient();

  async function approve(id: number): Promise<void> {
    await post(EP.CEO_POLES_APPROVE(id), { approve: true });
    qc.invalidateQueries({ queryKey: ['ceo-poles-requests'] });
    qc.invalidateQueries({ queryKey: ['ceo-overview'] });
  }

  async function reject(id: number, rejectionReason: string): Promise<void> {
    await post(EP.CEO_POLES_APPROVE(id), { approve: false, rejectionReason });
    qc.invalidateQueries({ queryKey: ['ceo-poles-requests'] });
    qc.invalidateQueries({ queryKey: ['ceo-overview'] });
  }

  return { approve, reject };
}
