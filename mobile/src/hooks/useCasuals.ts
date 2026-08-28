import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post, put, del } from '../api/client';
import { EP } from '../api/endpoints';
import { CasualWorkerListResponse } from '../types/api';

// HR Enterprise Phase 1 — the Casuals registry existed only on desktop
// before this phase; mirrors useCustomers.ts's shape exactly.

export function useCasualsList() {
  return useQuery<CasualWorkerListResponse>({
    queryKey:  ['casuals-list'],
    queryFn:   () => get<CasualWorkerListResponse>(EP.CASUALS_LIST),
    staleTime: 60_000,
  });
}

interface CasualPayload {
  full_name:               string;
  national_id?:            string | null;
  phone?:                  string | null;
  gender?:                 string | null;
  date_of_birth?:          string | null;
  address?:                string | null;
  department?:             string | null;
  work_location?:          string | null;
  job_role?:               string | null;
  supervisor?:             string | null;
  start_date?:             string | null;
  end_date?:               string | null;
  emergency_name?:         string | null;
  emergency_relationship?: string | null;
  emergency_phone?:        string | null;
  salary_per_action?:      number | string | null;
  active?:                 boolean;
  workshop_id?:            number | string | null;
}

export function useCasualCreate() {
  const qc = useQueryClient();

  async function createCasual(payload: CasualPayload): Promise<void> {
    await post(EP.CASUALS_CREATE, payload);
    await qc.invalidateQueries({ queryKey: ['casuals-list'] });
  }

  return { createCasual };
}

export function useCasualUpdate() {
  const qc = useQueryClient();

  async function updateCasual(id: number, payload: CasualPayload): Promise<void> {
    await put(EP.CASUALS_UPDATE(id), payload);
    await qc.invalidateQueries({ queryKey: ['casuals-list'] });
  }

  return { updateCasual };
}

// casualsDelete is a hard delete in data.js (no soft deactivate-only path
// exists for this table) — matching desktop's confirmDelete flow exactly.
export function useCasualDelete() {
  const qc = useQueryClient();

  async function deleteCasual(id: number, reason?: string): Promise<void> {
    await del(EP.CASUALS_DELETE(id), reason ? { reason } : undefined);
    await qc.invalidateQueries({ queryKey: ['casuals-list'] });
  }

  return { deleteCasual };
}
