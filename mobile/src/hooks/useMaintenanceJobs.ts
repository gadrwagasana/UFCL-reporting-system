import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../api/client';
import { EP } from '../api/endpoints';
import {
  MaintenanceJobsListResponse,
  MaintenanceJobDetailResponse,
  MaintenanceJobStatus,
  MaintenanceWaitingForPartsResponse,
  MaintenanceAssetSummaryResponse,
} from '../types/api';

// Mechanician Phase 3 — mirrors useMachines.ts's conventions exactly.

export function useMaintenanceJobsList(filters?: { status?: string; machineId?: number; assignedTo?: number }) {
  return useQuery<MaintenanceJobsListResponse>({
    queryKey:  ['maintenance-jobs', filters ?? {}],
    queryFn:   () => {
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.machineId) params.set('machineId', String(filters.machineId));
      if (filters?.assignedTo) params.set('assignedTo', String(filters.assignedTo));
      const qs = params.toString();
      return get<MaintenanceJobsListResponse>(EP.MAINTENANCE_JOBS_LIST + (qs ? `?${qs}` : ''));
    },
    staleTime: 30_000,
  });
}

export function useMaintenanceJobDetail(jobId: number) {
  return useQuery<MaintenanceJobDetailResponse>({
    queryKey:  ['maintenance-job-detail', jobId],
    queryFn:   () => get<MaintenanceJobDetailResponse>(EP.MAINTENANCE_JOB_DETAIL(jobId)),
    staleTime: 15_000,
    enabled:   jobId > 0,
  });
}

interface MaintenanceJobCreatePayload {
  machine_id:   number;
  title:        string;
  description?: string;
  priority?:    'normal' | 'high' | 'urgent';
  assigned_to?: number;
  schedule_id?: number;
}

export function useMaintenanceJobCreate() {
  const qc = useQueryClient();
  async function createJob(payload: MaintenanceJobCreatePayload): Promise<void> {
    await post(EP.MAINTENANCE_JOBS_CREATE, payload);
    await qc.invalidateQueries({ queryKey: ['maintenance-jobs'] });
  }
  return { createJob };
}

export function useMaintenanceJobAssign() {
  const qc = useQueryClient();
  async function assign(jobId: number, technicianId: number): Promise<void> {
    await post(EP.MAINTENANCE_JOB_ASSIGN(jobId), { technicianId });
    await qc.invalidateQueries({ queryKey: ['maintenance-jobs'] });
    await qc.invalidateQueries({ queryKey: ['maintenance-job-detail', jobId] });
  }
  return { assign };
}

export function useMaintenanceJobTransition() {
  const qc = useQueryClient();
  async function transition(jobId: number, action: string, payload?: Record<string, unknown>): Promise<void> {
    await post(EP.MAINTENANCE_JOB_TRANSITION(jobId), { action, ...payload });
    await qc.invalidateQueries({ queryKey: ['maintenance-jobs'] });
    await qc.invalidateQueries({ queryKey: ['maintenance-job-detail', jobId] });
    await qc.invalidateQueries({ queryKey: ['mechanician-dashboard'] });
  }
  return { transition };
}

export function useMaintenanceJobLabourAdd() {
  const qc = useQueryClient();
  async function addLabour(jobId: number, payload: { hours?: number; notes?: string; delayReason?: string }): Promise<void> {
    await post(EP.MAINTENANCE_JOB_LABOUR(jobId), payload);
    await qc.invalidateQueries({ queryKey: ['maintenance-job-detail', jobId] });
  }
  return { addLabour };
}

export function useMaintenanceProductionImpactAdd() {
  const qc = useQueryClient();
  async function addImpact(payload: { job_id: number; downtime_hours?: number; reason?: string; estimated_production_loss?: number; comments?: string }): Promise<void> {
    await post(EP.MAINTENANCE_PRODUCTION_IMPACT, payload);
    await qc.invalidateQueries({ queryKey: ['maintenance-job-detail', payload.job_id] });
  }
  return { addImpact };
}

// Mechanician Phase 4 — Priority 6 (Waiting for Parts dedicated view) and
// Priority 4 (Asset Summary card). Both are read-only composed reads already
// built on the backend this phase; these hooks just wire them up the same
// way every other list/detail hook above does.
export function useMaintenanceWaitingForParts() {
  return useQuery<MaintenanceWaitingForPartsResponse>({
    queryKey:  ['maintenance-waiting-for-parts'],
    queryFn:   () => get<MaintenanceWaitingForPartsResponse>(EP.MAINTENANCE_WAITING_FOR_PARTS),
    staleTime: 20_000,
  });
}

export function useMaintenanceAssetSummary(machineId: number) {
  return useQuery<MaintenanceAssetSummaryResponse>({
    queryKey:  ['maintenance-asset-summary', machineId],
    queryFn:   () => get<MaintenanceAssetSummaryResponse>(EP.MAINTENANCE_ASSET_SUMMARY(machineId)),
    staleTime: 20_000,
    enabled:   machineId > 0,
  });
}

export const MAINT_JOB_STATUS_LABEL: Record<MaintenanceJobStatus, string> = {
  inspection: 'Inspection',
  diagnosis: 'Diagnosis',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  waiting_parts: 'Waiting for Parts',
  external_repair: 'External Repair',
  testing: 'Testing',
  returned_to_service: 'Returned to Service',
  closed: 'Closed',
  cancelled: 'Cancelled',
};
