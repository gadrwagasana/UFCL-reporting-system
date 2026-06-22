import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../api/client';
import { EP } from '../api/endpoints';
import { MachineFuelListResponse, MachineFuelTargetsResponse } from '../types/api';

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
