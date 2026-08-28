import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post, put, del } from '../api/client';
import { EP } from '../api/endpoints';
import {
  VehicleListResponse,
  VehicleDetailResponse,
  VehiclePendingApproval,
  TransportDropdownResponse,
  FleetDashboardResponse,
  FleetIntelligenceResponse,
} from '../types/api';

// ─── List ─────────────────────────────────────────────────────────────────────

export function useVehicleList() {
  return useQuery<VehicleListResponse>({
    queryKey:  ['vehicles-list'],
    queryFn:   () => get<VehicleListResponse>(EP.VEHICLES_LIST),
    staleTime: 2 * 60_000,
  });
}

// Fleet & Equipment Phase 2 — executive dashboard (vehicles + machines).
export function useFleetDashboard() {
  return useQuery<FleetDashboardResponse>({
    queryKey:  ['fleet-dashboard'],
    queryFn:   () => get<FleetDashboardResponse>(EP.FLEET_DASHBOARD),
    staleTime: 60_000,
  });
}

// Fleet & Equipment Phase 3 — operational intelligence (trends, top lists,
// cross-department visibility).
export function useFleetIntelligence() {
  return useQuery<FleetIntelligenceResponse>({
    queryKey:  ['fleet-intelligence'],
    queryFn:   () => get<FleetIntelligenceResponse>(EP.FLEET_INTELLIGENCE),
    staleTime: 120_000,
  });
}

// ─── Detail (aggregate: vehicle + fuel logs + maintenance) ────────────────────

export function useVehicleDetail(vehicleId: number) {
  return useQuery<VehicleDetailResponse>({
    queryKey:  ['vehicle-detail', vehicleId],
    queryFn:   () => get<VehicleDetailResponse>(EP.VEHICLES_DETAIL(vehicleId)),
    staleTime: 30_000,
    enabled:   vehicleId > 0,
  });
}

// ─── Transport companies dropdown (for Third-Party owner picker) ──────────────

export function useTransportDropdown() {
  return useQuery<TransportDropdownResponse>({
    queryKey:  ['transport-dropdown'],
    queryFn:   () => get<TransportDropdownResponse>(EP.VEHICLES_TRANSPORT_DROPDOWN),
    staleTime: 5 * 60_000,
  });
}

// ─── Vehicle create / update / delete ─────────────────────────────────────────

interface VehiclePayload {
  registration:          string;
  ownership_type?:       string;
  vehicle_category?:     string;
  vehicle_type?:         string;
  make?:                 string;
  model?:                string;
  year?:                 number | null;
  fuel_type?:            string | null;
  chassis_vin?:          string;
  engine_number?:        string;
  odometer_reading?:     number | null;
  asset_code?:           string;
  purchase_date?:        string | null;
  purchase_cost?:        number | null;
  department?:           string;
  driver_assigned?:      string;
  status?:               string;
  insurance_expiry?:     string | null;
  road_license_expiry?:  string | null;
  inspection_expiry?:    string | null;
  notes?:                string;
  // Third-Party fields
  owner_name?:           string | null;
  owner_type?:           string | null;
  owner_id_number?:      string;
  owner_phone?:          string;
  owner_email?:          string;
  owner_address?:        string;
  contract_number?:      string;
  contract_start_date?:  string | null;
  contract_end_date?:    string | null;
  payment_rate?:         number | null;
  payment_method?:       string | null;
  assigned_project?:     string;
  driver_name?:          string;
  driver_phone?:         string;
  driver_license_number?: string;
  driver_license_expiry?: string | null;
}

export function useVehicleCreate() {
  const qc = useQueryClient();

  async function createVehicle(payload: VehiclePayload): Promise<void> {
    await post(EP.VEHICLES_CREATE, payload);
    await qc.invalidateQueries({ queryKey: ['vehicles-list'] });
  }

  return { createVehicle };
}

// Fleet & Equipment Phase 1 (Priority 5) — vehiclesUpdate/vehiclesDelete are
// now governed (can return a pendingApproval response instead of applying
// immediately), matching how useFuelLogDelete/useMaintenanceDelete already
// handle it below.
export function useVehicleUpdate() {
  const qc = useQueryClient();

  async function updateVehicle(id: number, payload: VehiclePayload): Promise<VehiclePendingApproval | void> {
    const result = await put<VehiclePendingApproval>(EP.VEHICLES_UPDATE(id), payload);
    if (result && (result as VehiclePendingApproval).pendingApproval) {
      return result as VehiclePendingApproval;
    }
    await qc.invalidateQueries({ queryKey: ['vehicles-list'] });
    await qc.invalidateQueries({ queryKey: ['vehicle-detail', id] });
  }

  return { updateVehicle };
}

export function useVehicleDelete() {
  const qc = useQueryClient();

  async function deleteVehicle(id: number, reason?: string): Promise<VehiclePendingApproval | void> {
    const result = await del<VehiclePendingApproval>(EP.VEHICLES_DELETE(id), { reason });
    if (result && (result as VehiclePendingApproval).pendingApproval) {
      return result as VehiclePendingApproval;
    }
    await qc.invalidateQueries({ queryKey: ['vehicles-list'] });
    qc.removeQueries({ queryKey: ['vehicle-detail', id] });
  }

  return { deleteVehicle };
}

// ─── Fuel logs ────────────────────────────────────────────────────────────────

interface FuelLogPayload {
  log_date:       string;
  liters:         number;
  cost_per_liter?: number | null;
  odometer?:      number | null;
  notes?:         string;
}

export function useFuelLogCreate() {
  const qc = useQueryClient();

  async function createFuelLog(vehicleId: number, payload: FuelLogPayload): Promise<void> {
    await post(EP.VEHICLES_FUEL_LOG_CREATE(vehicleId), payload);
    await qc.invalidateQueries({ queryKey: ['vehicle-detail', vehicleId] });
    await qc.invalidateQueries({ queryKey: ['vehicles-list'] });
  }

  return { createFuelLog };
}

export function useFuelLogDelete() {
  const qc = useQueryClient();

  async function deleteFuelLog(
    logId:     number,
    vehicleId: number,
    reason:    string,
  ): Promise<VehiclePendingApproval | void> {
    const result = await del<VehiclePendingApproval>(EP.VEHICLES_FUEL_LOG_DELETE(logId), { reason });
    if (result && (result as VehiclePendingApproval).pendingApproval) {
      return result as VehiclePendingApproval;
    }
    await qc.invalidateQueries({ queryKey: ['vehicle-detail', vehicleId] });
    await qc.invalidateQueries({ queryKey: ['vehicles-list'] });
  }

  return { deleteFuelLog };
}

// ─── Maintenance records ──────────────────────────────────────────────────────

interface MaintenancePayload {
  maintenance_date:  string;
  maintenance_type:  string;
  description:       string;
  cost?:             number | null;
  next_due_date?:    string | null;
  performed_by?:     string;
  notes?:            string;
}

export function useMaintenanceCreate() {
  const qc = useQueryClient();

  async function createMaintenance(vehicleId: number, payload: MaintenancePayload): Promise<void> {
    await post(EP.VEHICLES_MAINTENANCE_CREATE(vehicleId), payload);
    await qc.invalidateQueries({ queryKey: ['vehicle-detail', vehicleId] });
  }

  return { createMaintenance };
}

// Stabilization Phase 5 (F-16) — maintenanceUpdate had backend/IPC wiring
// (desktop) but no REST route or mobile UI at all.
export function useMaintenanceUpdate() {
  const qc = useQueryClient();

  async function updateMaintenance(
    recordId:  number,
    vehicleId: number,
    payload:   MaintenancePayload,
  ): Promise<VehiclePendingApproval | void> {
    const result = await put<VehiclePendingApproval>(EP.VEHICLES_MAINTENANCE_UPDATE(recordId), payload);
    if (result && (result as VehiclePendingApproval).pendingApproval) {
      return result as VehiclePendingApproval;
    }
    await qc.invalidateQueries({ queryKey: ['vehicle-detail', vehicleId] });
  }

  return { updateMaintenance };
}

export function useMaintenanceDelete() {
  const qc = useQueryClient();

  async function deleteMaintenance(
    recordId:  number,
    vehicleId: number,
    reason:    string,
  ): Promise<VehiclePendingApproval | void> {
    const result = await del<VehiclePendingApproval>(EP.VEHICLES_MAINTENANCE_DELETE(recordId), { reason });
    if (result && (result as VehiclePendingApproval).pendingApproval) {
      return result as VehiclePendingApproval;
    }
    await qc.invalidateQueries({ queryKey: ['vehicle-detail', vehicleId] });
  }

  return { deleteMaintenance };
}
