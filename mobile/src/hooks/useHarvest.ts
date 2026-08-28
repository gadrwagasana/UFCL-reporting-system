import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post, put, del } from '../api/client';
import { EP } from '../api/endpoints';
import {
  HarvestListResponse, HarvestDashboardResponse, HarvestPlanListResponse, CompartmentListResponse,
  HarvestOperationsResponse, HarvestPerformanceResponse, HarvestDelayListResponse,
  HarvestDecisionSupportResponse, HarvestExecutiveExtrasResponse, MachinePendingApproval,
} from '../types/api';

export function useHarvestList() {
  return useQuery<HarvestListResponse>({
    queryKey:  ['harvest-list'],
    queryFn:   () => get<HarvestListResponse>(EP.HARVEST_LIST),
    staleTime: 2 * 60_000,
  });
}

// Harvesting Phase 1 (Workstream 2)
export function useHarvestDashboard() {
  return useQuery<HarvestDashboardResponse>({
    queryKey:  ['harvest-dashboard'],
    queryFn:   () => get<HarvestDashboardResponse>(EP.HARVEST_DASHBOARD),
    staleTime: 60_000,
  });
}

export function useCompartments() {
  return useQuery<CompartmentListResponse>({
    queryKey:  ['meta-compartments'],
    queryFn:   () => get<CompartmentListResponse>(EP.META_COMPARTMENTS),
    staleTime: 10 * 60_000,
  });
}

interface CreateHarvestPayload {
  harvest_date:    string;
  species:         string;
  quantity:        number;
  uom?:            string;
  compt_id?:       number;
  sub_name?:       string;
  location?:       string;
  logs_crosscut?:  number;
  logs_handrolled?: number;
  notes?:          string;
  // Harvesting Phase 2 (Workstream 1) — optional link to the plan this
  // execution fulfils ("Planning feeds Harvest Records").
  plan_id?:        number;
}

export function useHarvestCreate() {
  const qc = useQueryClient();

  async function createEntry(payload: CreateHarvestPayload): Promise<void> {
    await post(EP.HARVEST_CREATE, payload);
    await qc.invalidateQueries({ queryKey: ['harvest-list'] });
    if (payload.plan_id) await qc.invalidateQueries({ queryKey: ['harvest-plans'] });
  }

  return { createEntry };
}

// Harvesting Phase 1 (Workstream 1) — harvestUpdate/Delete had backend/IPC
// wiring (desktop) with no REST route or mobile UI at all.
export function useHarvestUpdate() {
  const qc = useQueryClient();

  async function updateEntry(id: number, payload: CreateHarvestPayload): Promise<MachinePendingApproval | void> {
    const result = await put<MachinePendingApproval | { ok: true }>(EP.HARVEST_UPDATE(id), payload);
    if ('pendingApproval' in result && result.pendingApproval) {
      return result as MachinePendingApproval;
    }
    await qc.invalidateQueries({ queryKey: ['harvest-list'] });
  }

  return { updateEntry };
}

export function useHarvestDelete() {
  const qc = useQueryClient();

  async function deleteEntry(id: number, reason?: string): Promise<MachinePendingApproval | void> {
    const result = await del<MachinePendingApproval | { ok: true }>(EP.HARVEST_DELETE(id), { reason });
    if ('pendingApproval' in result && result.pendingApproval) {
      return result as MachinePendingApproval;
    }
    await qc.invalidateQueries({ queryKey: ['harvest-list'] });
  }

  return { deleteEntry };
}

// ─── Harvest Planning (Harvesting Phase 2, Workstream 1) ──────────────────────

export function useHarvestPlans() {
  return useQuery<HarvestPlanListResponse>({
    queryKey:  ['harvest-plans'],
    queryFn:   () => get<HarvestPlanListResponse>(EP.HARVEST_PLAN_LIST),
    staleTime: 60_000,
  });
}

interface HarvestPlanPayload {
  planned_date:      string;
  species:           string;
  compt_id?:         number;
  sub_name?:         string;
  priority?:         string;
  target_volume_m3?: number;
  target_logs?:      number;
  notes?:            string;
  status?:           string;
}

export function useHarvestPlanCreate() {
  const qc = useQueryClient();

  async function createPlan(payload: HarvestPlanPayload): Promise<void> {
    await post(EP.HARVEST_PLAN_CREATE, payload);
    await qc.invalidateQueries({ queryKey: ['harvest-plans'] });
    await qc.invalidateQueries({ queryKey: ['harvest-dashboard'] });
  }

  return { createPlan };
}

export function useHarvestPlanUpdate() {
  const qc = useQueryClient();

  async function updatePlan(id: number, payload: HarvestPlanPayload): Promise<MachinePendingApproval | void> {
    const result = await put<MachinePendingApproval | { ok: true }>(EP.HARVEST_PLAN_UPDATE(id), payload);
    if ('pendingApproval' in result && result.pendingApproval) {
      return result as MachinePendingApproval;
    }
    await qc.invalidateQueries({ queryKey: ['harvest-plans'] });
    await qc.invalidateQueries({ queryKey: ['harvest-dashboard'] });
  }

  return { updatePlan };
}

export function useHarvestPlanDelete() {
  const qc = useQueryClient();

  async function deletePlan(id: number, reason?: string): Promise<MachinePendingApproval | void> {
    const result = await del<MachinePendingApproval | { ok: true }>(EP.HARVEST_PLAN_DELETE(id), { reason });
    if ('pendingApproval' in result && result.pendingApproval) {
      return result as MachinePendingApproval;
    }
    await qc.invalidateQueries({ queryKey: ['harvest-plans'] });
    await qc.invalidateQueries({ queryKey: ['harvest-dashboard'] });
  }

  return { deletePlan };
}

// ─── Active Harvest Operations / Production Performance / Delays
//     (Harvesting Phase 3) ─────────────────────────────────────────────────────

export function useHarvestOperations() {
  return useQuery<HarvestOperationsResponse>({
    queryKey:  ['harvest-operations'],
    queryFn:   () => get<HarvestOperationsResponse>(EP.HARVEST_OPERATIONS),
    staleTime: 60_000,
  });
}

export function useHarvestPerformance() {
  return useQuery<HarvestPerformanceResponse>({
    queryKey:  ['harvest-performance'],
    queryFn:   () => get<HarvestPerformanceResponse>(EP.HARVEST_PERFORMANCE),
    staleTime: 60_000,
  });
}

export function useHarvestDelays() {
  return useQuery<HarvestDelayListResponse>({
    queryKey:  ['harvest-delays'],
    queryFn:   () => get<HarvestDelayListResponse>(EP.HARVEST_DELAY_LIST),
    staleTime: 60_000,
  });
}

interface HarvestDelayPayload {
  category:           string;
  compt_id?:          number;
  duration_hours?:    number;
  production_impact?: string;
}

export function useHarvestDelayCreate() {
  const qc = useQueryClient();

  async function createDelay(payload: HarvestDelayPayload): Promise<void> {
    await post(EP.HARVEST_DELAY_CREATE, payload);
    await qc.invalidateQueries({ queryKey: ['harvest-delays'] });
  }

  return { createDelay };
}

// ─── Decision Support / Executive Reporting Extras (Harvesting Phase 4) ──────

export function useHarvestDecisionSupport() {
  return useQuery<HarvestDecisionSupportResponse>({
    queryKey:  ['harvest-decision-support'],
    queryFn:   () => get<HarvestDecisionSupportResponse>(EP.HARVEST_DECISION_SUPPORT),
    staleTime: 5 * 60_000,
  });
}

export function useHarvestExecutiveExtras() {
  return useQuery<HarvestExecutiveExtrasResponse>({
    queryKey:  ['harvest-executive-extras'],
    queryFn:   () => get<HarvestExecutiveExtrasResponse>(EP.HARVEST_EXECUTIVE_EXTRAS),
    staleTime: 5 * 60_000,
  });
}
