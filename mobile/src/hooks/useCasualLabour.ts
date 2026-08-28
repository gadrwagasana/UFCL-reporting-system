import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post, del } from '../api/client';
import { EP } from '../api/endpoints';
import { CasualLabourListResponse } from '../types/api';

interface CasualLabourPendingApproval {
  ok:              true;
  pendingApproval: true;
  level:           string;
  message:         string;
}

export function useCasualLabour() {
  return useQuery<CasualLabourListResponse>({
    queryKey:  ['casual-labour'],
    queryFn:   () => get<CasualLabourListResponse>(EP.LABOUR_LIST),
    staleTime: 2 * 60_000,
  });
}

interface LabourItem { role: string; quantity: number }

interface CreateCasualLabourPayload {
  start_date:    string;
  end_date:      string;
  task:          string;
  num_casuals:   number;
  labour_items?: LabourItem[];
  description?:  string;
  comments?:     string;
}

export function useCasualLabourCreate() {
  const qc = useQueryClient();

  async function createRequest(payload: CreateCasualLabourPayload): Promise<void> {
    await post(EP.LABOUR_CREATE, payload);
    await qc.invalidateQueries({ queryKey: ['casual-labour'] });
    await qc.invalidateQueries({ queryKey: ['my-requests'] });
  }

  return { createRequest };
}

// ERP Enterprise Completion Phase 3 (Workstream 11) — the backend
// (casualLabourRequestsReview) and mobile-api route (POST /api/casual-labour/
// :id/review) already existed; only the mobile screen action was missing —
// CasualLabourDetailScreen could display a past review result but never let
// the current user record one. Mirrors useCasualLabourCreate's shape exactly.
export function useCasualLabourReview() {
  const qc = useQueryClient();

  async function review(id: number, status: 'Approved' | 'Rejected'): Promise<void> {
    await post(EP.LABOUR_REVIEW(id), { status });
    await qc.invalidateQueries({ queryKey: ['casual-labour'] });
  }

  return { review };
}

// Remediation Phase 2 — casualLabourRequestsDelete had desktop/IPC wiring
// with no REST route/mobile UI; a submitted request could never be
// withdrawn on mobile.
export function useCasualLabourDelete() {
  const qc = useQueryClient();

  async function deleteRequest(id: number, reason?: string): Promise<CasualLabourPendingApproval | void> {
    const result = await del<CasualLabourPendingApproval | { ok: true }>(EP.LABOUR_DELETE(id), { reason });
    if ('pendingApproval' in result && result.pendingApproval) {
      return result as CasualLabourPendingApproval;
    }
    await qc.invalidateQueries({ queryKey: ['casual-labour'] });
    await qc.invalidateQueries({ queryKey: ['my-requests'] });
  }

  return { deleteRequest };
}
