import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post, put, del } from '../api/client';
import { EP } from '../api/endpoints';
import { MachineFuelListResponse, MachineFuelTargetsResponse, MachinePendingApproval } from '../types/api';

export function useMachineFuelList() {
  return useQuery<MachineFuelListResponse>({
    queryKey:  ['machine-fuel-list'],
    queryFn:   () => get<MachineFuelListResponse>(EP.MACHINE_FUEL_LIST),
    staleTime: 2 * 60_000,
  });
}

// Combined machines + vehicles for the fuel create form
export function useMachineFuelTargets() {
  return useQuery<MachineFuelTargetsResponse>({
    queryKey:  ['meta-machine-fuel-targets'],
    queryFn:   () => get<MachineFuelTargetsResponse>(EP.META_MACHINE_FUEL_TARGETS),
    staleTime: 10 * 60_000,
  });
}

interface CreateMachineFuelPayload {
  log_date:   string;
  fuel_type:  string;
  quantity:   number;
  machine_id?: number;
  vehicle_id?: number;
  operator?:  string;
  unit?:      string;
  notes?:     string;
}

export function useMachineFuelCreate() {
  const qc = useQueryClient();

  async function createLog(payload: CreateMachineFuelPayload): Promise<void> {
    await post(EP.MACHINE_FUEL_CREATE, payload);
    await qc.invalidateQueries({ queryKey: ['machine-fuel-list'] });
    await qc.invalidateQueries({ queryKey: ['machine-log-list'] });  // fuel_issued shown in machine log list
  }

  return { createLog };
}

// Stabilization Phase 5 (F-21) — machineFuelLogsUpdate had backend/IPC wiring
// (desktop) with no REST route or mobile UI at all.
export function useMachineFuelUpdate() {
  const qc = useQueryClient();

  async function updateLog(id: number, payload: CreateMachineFuelPayload): Promise<MachinePendingApproval | void> {
    const result = await put<MachinePendingApproval | { ok: true }>(EP.MACHINE_FUEL_UPDATE(id), payload);
    if ('pendingApproval' in result && result.pendingApproval) {
      return result as MachinePendingApproval;
    }
    await qc.invalidateQueries({ queryKey: ['machine-fuel-list'] });
    await qc.invalidateQueries({ queryKey: ['machine-log-list'] });
  }

  return { updateLog };
}

// Remediation Phase 2 — machineFuelLogsDelete had backend/IPC wiring
// (desktop) with no REST route or mobile UI at all, same gap class as the
// Update fix above.
export function useMachineFuelDelete() {
  const qc = useQueryClient();

  async function deleteLog(id: number, reason?: string): Promise<MachinePendingApproval | void> {
    const result = await del<MachinePendingApproval | { ok: true }>(EP.MACHINE_FUEL_DELETE(id), { reason });
    if ('pendingApproval' in result && result.pendingApproval) {
      return result as MachinePendingApproval;
    }
    await qc.invalidateQueries({ queryKey: ['machine-fuel-list'] });
    await qc.invalidateQueries({ queryKey: ['machine-log-list'] });
  }

  return { deleteLog };
}
