import { useQuery } from '@tanstack/react-query';
import { get, post } from '../api/client';
import { EP } from '../api/endpoints';
import type { SupplierIntelligenceDashboard, SupplierIntelligenceProfile, SupplierIntelligence } from '../types/api';

// Phase 3C — every hook here is a thin fetch wrapper around one of the four
// Supplier Intelligence Engine functions in db/services/data.js. No score,
// tier, or metric is computed client-side anywhere in this file.

interface DashboardResponse extends SupplierIntelligenceDashboard { ok: true }
interface ProfileResponse extends SupplierIntelligenceProfile { ok: true }
interface CompareResponse { ok: true; suppliers: SupplierIntelligence[] }
interface ReportResponse { ok: true; reportType: string; rows: SupplierIntelligence[] }

export function useSupplierIntelligenceDashboard(filters: { status?: string; category?: string; search?: string } = {}) {
  return useQuery<DashboardResponse>({
    queryKey: ['supplier-intel-dashboard', filters],
    queryFn:  () => get<DashboardResponse>(EP.SUPPLIER_INTEL_DASHBOARD, filters as Record<string, unknown>),
    staleTime: 60_000,
  });
}

export function useSupplierIntelligenceProfile(supplierId: number) {
  return useQuery<ProfileResponse>({
    queryKey: ['supplier-intel-profile', supplierId],
    queryFn:  () => get<ProfileResponse>(EP.SUPPLIER_INTEL_PROFILE(supplierId)),
    enabled:  !!supplierId,
    staleTime: 60_000,
  });
}

export async function fetchSupplierComparison(supplierIds: number[]): Promise<CompareResponse> {
  return post<CompareResponse>(EP.SUPPLIER_INTEL_COMPARE, { supplierIds });
}

export function useSupplierIntelligenceReport(reportType: string, filters: { status?: string; category?: string; search?: string } = {}) {
  return useQuery<ReportResponse>({
    queryKey: ['supplier-intel-report', reportType, filters],
    queryFn:  () => get<ReportResponse>(EP.SUPPLIER_INTEL_REPORT(reportType), filters as Record<string, unknown>),
    enabled:  !!reportType,
    staleTime: 60_000,
  });
}
