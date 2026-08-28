import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post, put, del } from '../api/client';
import { EP } from '../api/endpoints';
import { DailyListResponse, MachinePendingApproval, SawmillDashboardResponse } from '../types/api';

// Sawmill Phase 3 (Workstream 1) — optional filters, additive/backward-
// compatible: calling useSawmillList() with no args keeps prior behavior.
export interface SawmillListFilters {
  date_from?: string; // YYYY-MM-DD
  date_to?:   string;
  search?:    string;
  limit?:     number;
  offset?:    number;
}

export function useSawmillList(filters: SawmillListFilters = {}) {
  return useQuery<DailyListResponse>({
    queryKey:  ['sawmill-list', filters],
    queryFn:   () => get<DailyListResponse>(EP.SAWMILL_LIST, filters as Record<string, unknown>),
    staleTime: 2 * 60_000,
  });
}

// Sawmill Phase 3 (Workstream 4) — Sawmill Manager Dashboard.
export function useSawmillDashboard() {
  return useQuery<SawmillDashboardResponse>({
    queryKey:  ['sawmill-dashboard'],
    queryFn:   () => get<SawmillDashboardResponse>(EP.SAWMILL_DASHBOARD),
    staleTime: 60_000,
  });
}

interface TimberSizeInput {
  width_mm:     number;
  thickness_mm: number;
  length_m:     number;
  quantity:     number;
}

interface CreateSawmillPayload {
  date:               string;    // YYYY-MM-DD — API field is `date`, not `log_date`
  supervisor?:        string;
  operators?:         string;
  machine?:           string;
  product_size?:      string;
  timber_kiln_dried?: number;
  timber_cca_treated?: number;
  timber_untreated?:  number;
  timber_waste?:      number;
  poles_units?:       number;
  poles_waste?:       number;
  logs_received?:     number;
  downtime_hours?:    number;
  downtime_reason?:   string;
  remarks?:           string;
  // Sawmill Timber Entry enhancement
  log_diameter_cm?:   number;
  start_time?:        string;   // 'HH:mm'
  end_time?:          string;   // 'HH:mm'
  timber_sizes?:      TimberSizeInput[];
}

interface CreateSawmillResult {
  ok: true;
  id?: number;
  actualVolumeM3?: number;
  expectedVolumeM3?: number;
  unmappedSizes?: string[];
}

export function useSawmillCreate() {
  const qc = useQueryClient();

  async function createEntry(payload: CreateSawmillPayload): Promise<CreateSawmillResult> {
    const result = await post<CreateSawmillResult>(EP.SAWMILL_CREATE, payload);
    await qc.invalidateQueries({ queryKey: ['sawmill-list'] });
    return result;
  }

  return { createEntry };
}

// Sawmill Phase 1 (Workstream 3) — mobile/desktop CRUD parity; reuses the
// exact same dailyUpdate/dailyDelete backend validation and business rules
// desktop already calls, nothing duplicated.
export function useSawmillUpdate() {
  const qc = useQueryClient();

  async function updateEntry(id: number, payload: CreateSawmillPayload): Promise<CreateSawmillResult | MachinePendingApproval> {
    const result = await put<CreateSawmillResult | MachinePendingApproval>(EP.SAWMILL_UPDATE(id), payload);
    if ('pendingApproval' in result && result.pendingApproval) {
      return result as MachinePendingApproval;
    }
    await qc.invalidateQueries({ queryKey: ['sawmill-list'] });
    return result as CreateSawmillResult;
  }

  return { updateEntry };
}

export function useSawmillDelete() {
  const qc = useQueryClient();

  async function deleteEntry(id: number, reason?: string): Promise<MachinePendingApproval | void> {
    const result = await del<MachinePendingApproval | { ok: true }>(EP.SAWMILL_DELETE(id), { reason });
    if ('pendingApproval' in result && result.pendingApproval) {
      return result as MachinePendingApproval;
    }
    await qc.invalidateQueries({ queryKey: ['sawmill-list'] });
  }

  return { deleteEntry };
}
