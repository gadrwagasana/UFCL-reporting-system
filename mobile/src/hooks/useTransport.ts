import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post, put, patch, del } from '../api/client';
import { EP } from '../api/endpoints';
import type { TransportCompaniesListResponse, TransportJobsListResponse } from '../types/api';

// Phase 1 Logistics fix — Transport Carriers and Transport Jobs had full CRUD
// on desktop but no mobile hook at all until now.

const CO_QK  = ['transport-companies'] as const;
const JOB_QK = ['transport-jobs'] as const;

// ── Transport Carriers ───────────────────────────────────────────────────────

export function useTransportCompaniesList() {
  return useQuery<TransportCompaniesListResponse>({
    queryKey:  CO_QK,
    queryFn:   () => get<TransportCompaniesListResponse>(EP.TRANSPORT_COMPANIES_LIST),
    staleTime: 60_000,
  });
}

export interface TransportCompanyPayload {
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  rate_per_km?: number;
  notes?: string;
  active?: boolean;
}

export function useTransportCompanyCreate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: TransportCompanyPayload) =>
      post<{ ok: true }>(EP.TRANSPORT_COMPANIES_CREATE, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: CO_QK }),
  });
}

export function useTransportCompanyUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: TransportCompanyPayload & { id: number }) =>
      put<{ ok: true }>(EP.TRANSPORT_COMPANIES_UPDATE(id), payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: CO_QK }),
  });
}

export function useTransportCompanyDelete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
      del<{ ok: true }>(EP.TRANSPORT_COMPANIES_DELETE(id), { reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: CO_QK }),
  });
}

// ── Transport Jobs ───────────────────────────────────────────────────────────

export function useTransportJobsList() {
  return useQuery<TransportJobsListResponse>({
    queryKey:  JOB_QK,
    queryFn:   () => get<TransportJobsListResponse>(EP.TRANSPORT_JOBS_LIST),
    staleTime: 30_000,
  });
}

export interface TransportJobPayload {
  carrier_type: 'Third-party' | 'Own Vehicle';
  transport_company_id?: number;
  vehicle_id?: number;
  sales_order_id?: number;
  job_type?: string;
  origin?: string;
  destination?: string;
  job_date: string;
  quantity?: number;
  uom?: string;
  cost?: number;
  waybill_ref?: string;
  notes?: string;
}

export function useTransportJobCreate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: TransportJobPayload) =>
      post<{ ok: true }>(EP.TRANSPORT_JOBS_CREATE, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: JOB_QK }),
  });
}

export function useTransportJobUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: TransportJobPayload & { id: number }) =>
      put<{ ok: true; pendingApproval?: boolean; message?: string }>(EP.TRANSPORT_JOBS_UPDATE(id), payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: JOB_QK }),
  });
}

export function useTransportJobStatusUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      patch<{ ok: true }>(EP.TRANSPORT_JOBS_STATUS(id), { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: JOB_QK }),
  });
}

export function useTransportJobDelete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
      del<{ ok: true; pendingApproval?: boolean; message?: string }>(EP.TRANSPORT_JOBS_DELETE(id), { reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: JOB_QK }),
  });
}
