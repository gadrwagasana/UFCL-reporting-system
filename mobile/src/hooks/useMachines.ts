import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post, put } from '../api/client';
import { EP } from '../api/endpoints';
import {
  MachineListResponse,
  MachineDetailResponse,
  MachineCategoryListResponse,
  MachinePendingApproval,
} from '../types/api';

// ── List (registry + categories + workshops + metrics) ────────────────────────

export function useMachineList() {
  return useQuery<MachineListResponse>({
    queryKey:  ['machine-list'],
    queryFn:   () => get<MachineListResponse>(EP.MACHINES_LIST),
    staleTime: 2 * 60_000,
  });
}

// ── Detail (machine row + maintenance schedules) ───────────────────────────────

export function useMachineDetail(machineId: number) {
  return useQuery<MachineDetailResponse>({
    queryKey:  ['machine-detail', machineId],
    queryFn:   () => get<MachineDetailResponse>(EP.MACHINES_DETAIL(machineId)),
    staleTime: 2 * 60_000,
    enabled:   machineId > 0,
  });
}

// ── Categories ────────────────────────────────────────────────────────────────

export function useMachineCategories() {
  return useQuery<MachineCategoryListResponse>({
    queryKey:  ['machine-categories'],
    queryFn:   () => get<MachineCategoryListResponse>(EP.MACHINES_CATEGORIES),
    staleTime: 5 * 60_000,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

interface MachineCreatePayload {
  machine_code:          string;
  name:                  string;
  category_id:           number;
  workshop_id?:          number | null;
  status:                string;
  plate_number?:         string | null;
  production_capacity?:  number;
  capacity_unit?:        string;
  fuel_consumption_rate?: number;
  fuel_type?:            string | null;
  manufacturer?:         string | null;
  model_number?:         string | null;
  serial_number?:        string | null;
  year_manufactured?:    number | null;
  date_acquired?:        string | null;
  notes?:                string | null;
}

export function useMachineCreate() {
  const qc = useQueryClient();
  async function createMachine(payload: MachineCreatePayload): Promise<void> {
    await post(EP.MACHINES_CREATE, payload);
    await qc.invalidateQueries({ queryKey: ['machine-list'] });
  }
  return { createMachine };
}

export function useMachineUpdate() {
  const qc = useQueryClient();
  async function updateMachine(
    machineId: number,
    payload: Partial<MachineCreatePayload>
  ): Promise<MachinePendingApproval | void> {
    const result = await put<MachinePendingApproval | { ok: true }>(EP.MACHINES_UPDATE(machineId), payload);
    if ('pendingApproval' in result && result.pendingApproval) {
      return result as MachinePendingApproval;
    }
    await qc.invalidateQueries({ queryKey: ['machine-list'] });
    await qc.invalidateQueries({ queryKey: ['machine-detail', machineId] });
  }
  return { updateMachine };
}

// ── Category mutations ────────────────────────────────────────────────────────

interface CategoryPayload { name: string; description?: string | null }

export function useMachineCategoryCreate() {
  const qc = useQueryClient();
  async function createCategory(payload: CategoryPayload): Promise<void> {
    await post(EP.MACHINES_CATEGORIES, payload);
    await qc.invalidateQueries({ queryKey: ['machine-categories'] });
    await qc.invalidateQueries({ queryKey: ['machine-list'] });
  }
  return { createCategory };
}

export function useMachineCategoryUpdate() {
  const qc = useQueryClient();
  async function updateCategory(catId: number, payload: CategoryPayload): Promise<void> {
    await put(EP.MACHINES_CATEGORY_UPDATE(catId), payload);
    await qc.invalidateQueries({ queryKey: ['machine-categories'] });
    await qc.invalidateQueries({ queryKey: ['machine-list'] });
  }
  return { updateCategory };
}

export function useMachineCategoryDelete() {
  const qc = useQueryClient();
  async function deleteCategory(catId: number): Promise<void> {
    const { del } = await import('../api/client');
    await del(EP.MACHINES_CATEGORY_DELETE(catId));
    await qc.invalidateQueries({ queryKey: ['machine-categories'] });
    await qc.invalidateQueries({ queryKey: ['machine-list'] });
  }
  return { deleteCategory };
}

// ── Maintenance schedule ───────────────────────────────────────────────────────

interface MaintSchedulePayload {
  maintenance_type:  string;
  frequency_days?:   number;
  last_performed?:   string | null;
  next_due?:         string | null;
  estimated_hours?:  number;
  notes?:            string | null;
}

export function useMaintScheduleCreate() {
  const qc = useQueryClient();
  async function createSchedule(machineId: number, payload: MaintSchedulePayload): Promise<void> {
    await post(EP.MACHINES_MAINT_SCHEDULE_CREATE(machineId), payload);
    await qc.invalidateQueries({ queryKey: ['machine-detail', machineId] });
    await qc.invalidateQueries({ queryKey: ['machine-list'] });
  }
  return { createSchedule };
}
