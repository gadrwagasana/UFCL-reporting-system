// ERP Enterprise Completion Phase 4 — Pending Edit / Deletion Request
// governance review (approve/reject side) on mobile. Mirrors
// useCasualLabour.ts's shape (list query + review mutation).
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../api/client';
import { EP } from '../api/endpoints';
import {
  PendingEditsListResponse, DeletionRequestsListResponse,
} from '../types/api';

export function usePendingEdits() {
  return useQuery<PendingEditsListResponse>({
    queryKey:  ['governance', 'pending-edits'],
    queryFn:   () => get<PendingEditsListResponse>(EP.GOVERNANCE_PENDING_EDITS_LIST),
    staleTime: 30_000,
  });
}

export function usePendingEditsReview() {
  const qc = useQueryClient();

  async function review(id: number, status: 'Approved' | 'Rejected', reviewNotes?: string): Promise<void> {
    await post(EP.GOVERNANCE_PENDING_EDITS_REVIEW(id), { status, reviewNotes: reviewNotes || undefined });
    await qc.invalidateQueries({ queryKey: ['governance', 'pending-edits'] });
  }

  return { review };
}

export function useDeletionRequests() {
  return useQuery<DeletionRequestsListResponse>({
    queryKey:  ['governance', 'deletion-requests'],
    queryFn:   () => get<DeletionRequestsListResponse>(EP.GOVERNANCE_DELETION_REQUESTS_LIST),
    staleTime: 30_000,
  });
}

export function useDeletionRequestReview() {
  const qc = useQueryClient();

  async function review(id: number, decision: 'Approved' | 'Rejected', notes?: string): Promise<void> {
    const endpoint = decision === 'Approved'
      ? EP.GOVERNANCE_DELETION_REQUESTS_APPROVE(id)
      : EP.GOVERNANCE_DELETION_REQUESTS_REJECT(id);
    await post(endpoint, { notes: notes || undefined });
    await qc.invalidateQueries({ queryKey: ['governance', 'deletion-requests'] });
  }

  return { review };
}
