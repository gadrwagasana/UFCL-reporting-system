import * as Sharing from 'expo-sharing';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post, downloadFile } from '../api/client';
import { EP } from '../api/endpoints';
import {
  PayrollPeriodListResponse, PayrollPeriodDetailResponse, PayrollLineDetailResponse,
  PayrollAdjustmentListResponse,
} from '../types/api';

// Payroll Enterprise Phase 2/3 — mobile's exposure. Deliberately narrow:
// review/approve/inspect/search/filter/sort/export only (no rate setting,
// period create/calculate, or adjustment creation — see PayrollStack
// comment in navigation/types.ts).

export interface PayrollPeriodFilters {
  workshopId?: number;
  status?: string;
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export function usePayrollPeriods(filters: PayrollPeriodFilters = {}) {
  const { workshopId, status, search, sortBy, sortDir } = filters;
  return useQuery<PayrollPeriodListResponse>({
    queryKey:  ['payroll-periods', workshopId, status, search, sortBy, sortDir],
    queryFn:   () => get<PayrollPeriodListResponse>(EP.PAYROLL_PERIODS_LIST, {
      workshop_id: workshopId, status, search, sort_by: sortBy, sort_dir: sortDir,
    }),
    staleTime: 30_000,
  });
}

export function usePayrollPeriodDetail(periodId: number) {
  return useQuery<PayrollPeriodDetailResponse>({
    queryKey:  ['payroll-period-detail', periodId],
    queryFn:   () => get<PayrollPeriodDetailResponse>(EP.PAYROLL_PERIOD_DETAIL(periodId)),
    staleTime: 15_000,
    enabled:   !!periodId,
  });
}

export function usePayrollLineDetail(lineId: number) {
  return useQuery<PayrollLineDetailResponse>({
    queryKey:  ['payroll-line-detail', lineId],
    queryFn:   () => get<PayrollLineDetailResponse>(EP.PAYROLL_LINE_DETAIL(lineId)),
    staleTime: 15_000,
    enabled:   !!lineId,
  });
}

export function usePayrollLineAdjustments(lineId: number) {
  return useQuery<PayrollAdjustmentListResponse>({
    queryKey:  ['payroll-line-adjustments', lineId],
    queryFn:   () => get<PayrollAdjustmentListResponse>(EP.PAYROLL_LINE_ADJUSTMENTS(lineId)),
    staleTime: 15_000,
    enabled:   !!lineId,
  });
}

// Reuses the same shared multi-stage approval engine every governed-approval
// hook in this app already calls (procurementApprovalAction on desktop);
// here it's the REST route that hardcodes entityType='payroll_period'
// server-side (see mobile-api/routes/payroll.js).
export function usePayrollPeriodApprove() {
  const qc = useQueryClient();

  async function decide(
    periodId: number,
    decision: 'approved' | 'rejected' | 'returned_for_revision',
    notes?: string,
  ): Promise<{ ok: boolean; status?: string; nextStage?: string; error?: string }> {
    const result = await post<{ ok: boolean; status?: string; nextStage?: string; error?: string }>(
      EP.PAYROLL_PERIOD_APPROVE(periodId), { decision, notes },
    );
    await qc.invalidateQueries({ queryKey: ['payroll-periods'] });
    await qc.invalidateQueries({ queryKey: ['payroll-period-detail', periodId] });
    return result;
  }

  return { decide };
}

// Phase 3 — Excel export. Reuses the exact same "write, then share" pattern
// SageScreen.tsx/useSrm.ts already established for binary file downloads
// (downloadFile() + expo-sharing), not a new download mechanism. The export
// always reflects whatever filters the caller currently has applied on
// screen (Priority 6) — the caller passes the same params it's already
// querying with.
export function usePayrollExportExcel() {
  async function exportExcel(
    reportType: 'periods' | 'lines' | 'summary' | 'adjustments' | 'approval' | 'workshop',
    params: Record<string, string | number | undefined> = {},
  ): Promise<void> {
    const query = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    const url = EP.PAYROLL_EXPORT_EXCEL(reportType) + (query ? `?${query}` : '');
    const filename = `payroll_${reportType}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    const localUri = await downloadFile(url, filename);
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(localUri);
  }

  return { exportExcel };
}
