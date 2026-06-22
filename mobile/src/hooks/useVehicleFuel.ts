import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../api/client';
import { EP } from '../api/endpoints';
import { FuelLogListResponse } from '../types/api';

// vehicleId is required by the API — list is per-vehicle
export function useVehicleFuelList(vehicleId: number | null) {
  return useQuery<FuelLogListResponse>({
    queryKey:  ['vehicle-fuel', vehicleId],
    queryFn:   () => get<FuelLogListResponse>(`${EP.VEHICLE_FUEL_LIST}?vehicleId=${vehicleId}`),
    enabled:   vehicleId !== null,
    staleTime: 2 * 60_000,
  });
}

interface CreateFuelLogPayload {
  vehicle_id:      number;
  log_date:        string;
  liters:          number;
  cost_per_liter?: number;
  total_cost?:     number;
  odometer?:       number;
  notes?:          string;
}

export function useVehicleFuelCreate() {
  const qc = useQueryClient();

  async function createLog(payload: CreateFuelLogPayload): Promise<void> {
    await post(EP.VEHICLE_FUEL_CREATE, payload);
    await qc.invalidateQueries({ queryKey: ['vehicle-fuel', payload.vehicle_id] });
  }

  return { createLog };
}
