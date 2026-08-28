import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post, put, del } from '../api/client';
import { EP } from '../api/endpoints';
import { MachineLogListResponse } from '../types/api';

interface MachineLogPendingApproval {
  ok:              true;
  pendingApproval: true;
  level:           string;
  message:         string;
}

export function useMachineLogList(machineId?: number) {
  return useQuery<MachineLogListResponse>({
    queryKey:  ['machine-log-list', machineId ?? null],
    queryFn:   () => get<MachineLogListResponse>(
      machineId ? `${EP.MACHINE_LOG_LIST}?machineId=${machineId}` : EP.MACHINE_LOG_LIST
    ),
    staleTime: 2 * 60_000,
  });
}

interface FuelIssuedResponse { ok: true; issued: number }

export function useMachineFuelIssued(machineId: number | null, logDate: string) {
  return useQuery<FuelIssuedResponse>({
    queryKey:  ['machine-fuel-issued', machineId, logDate],
    queryFn:   () => get<FuelIssuedResponse>(
      `${EP.MACHINE_FUEL_ISSUED}?machineId=${machineId}&logDate=${logDate}`
    ),
    enabled:   machineId !== null && logDate.length === 10,
    staleTime: 60_000,
  });
}

interface CreateMachineLogPayload {
  machine_id:        number;
  log_date:          string;
  shift?:            string;
  hours_worked?:     number;
  downtime_hours?:   number;
  downtime_reason?:  string;
  fuel_consumed?:    number;
  daily_production?: number;
  capacity_per_day?: number;
  product_type?:     string;
  item_category?:    string;
  logs_loaded?:      number;
  logs_unloaded?:    number;
  loading_trips?:    number;
  remarks?:          string;
}

export function useMachineLogCreate() {
  const qc = useQueryClient();

  async function createLog(payload: CreateMachineLogPayload): Promise<void> {
    await post(EP.MACHINE_LOG_CREATE, payload);
    await qc.invalidateQueries({ queryKey: ['machine-log-list'] });
  }

  return { createLog };
}

// Remediation Phase 3 — machineLogsUpdate/Delete had desktop/IPC wiring
// with no REST route or mobile UI at all; entries could be created but
// never corrected or removed on mobile (desktop already had both).
export function useMachineLogUpdate() {
  const qc = useQueryClient();

  async function updateLog(id: number, payload: CreateMachineLogPayload): Promise<MachineLogPendingApproval | void> {
    const result = await put<MachineLogPendingApproval | { ok: true }>(EP.MACHINE_LOG_UPDATE(id), payload);
    if ('pendingApproval' in result && result.pendingApproval) {
      return result as MachineLogPendingApproval;
    }
    await qc.invalidateQueries({ queryKey: ['machine-log-list'] });
  }

  return { updateLog };
}

export function useMachineLogDelete() {
  const qc = useQueryClient();

  async function deleteLog(id: number, reason?: string): Promise<MachineLogPendingApproval | void> {
    const result = await del<MachineLogPendingApproval | { ok: true }>(EP.MACHINE_LOG_DELETE(id), { reason });
    if ('pendingApproval' in result && result.pendingApproval) {
      return result as MachineLogPendingApproval;
    }
    await qc.invalidateQueries({ queryKey: ['machine-log-list'] });
  }

  return { deleteLog };
}
