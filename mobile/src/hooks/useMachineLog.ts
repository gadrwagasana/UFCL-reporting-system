import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../api/client';
import { EP } from '../api/endpoints';
import { MachineLogListResponse } from '../types/api';

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
