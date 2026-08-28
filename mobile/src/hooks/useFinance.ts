import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post, put } from '../api/client';
import { EP } from '../api/endpoints';
import {
  FinanceDashboardResponse, FinanceApprovalQueueResponse,
  FinanceInventoryOverviewResponse, FinanceStockVarianceResponse,
  FinanceStockCountSessionListResponse, FinanceStockCountDetailResponse,
  FinanceExceptionCaseListResponse, FinanceExceptionCaseDetailResponse,
} from '../types/api';

// Finance Enterprise — mobile's exposure. Deliberately narrow: Dashboard,
// Approval Center, Inventory Overview, Stock Variance, Stock Count review
// (enter physical counts + submit for review — a natural fit for on-the-
// floor counting), and the Exception Center (view/comment/resolve).
// Initiating a count, submitting adjustments, Operations Center, Reports,
// Configuration, Sage Export, and the Production/Maintenance/Customer/
// Supplier drill-downs are desktop-only (large filterable tables / file
// generation / a more deliberate action than a phone screen suits) — see
// the Gap Register, not silently missing.

export function useFinanceDashboard(workshopId?: number) {
  return useQuery<FinanceDashboardResponse>({
    queryKey:  ['finance-dashboard', workshopId],
    queryFn:   () => get<FinanceDashboardResponse>(EP.FINANCE_DASHBOARD, { workshop_id: workshopId }),
    staleTime: 30_000,
  });
}

export function useFinanceApprovals() {
  return useQuery<FinanceApprovalQueueResponse>({
    queryKey:  ['finance-approvals'],
    queryFn:   () => get<FinanceApprovalQueueResponse>(EP.FINANCE_APPROVALS),
    staleTime: 15_000,
  });
}

// Thin pass-through to the shared multi-stage approval engine (same
// procurementApprovalAction every other governed-approval hook in this app
// already calls) — no new approval logic on the mobile side either.
export function useFinanceApprovalDecide() {
  const qc = useQueryClient();

  async function decide(
    entityType: string,
    entityId: number,
    decision: 'approved' | 'rejected',
    notes?: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const result = await post<{ ok: boolean; error?: string }>(
      EP.FINANCE_APPROVAL_DECIDE(entityType, entityId), { decision, notes },
    );
    await qc.invalidateQueries({ queryKey: ['finance-approvals'] });
    await qc.invalidateQueries({ queryKey: ['finance-dashboard'] });
    return result;
  }

  return { decide };
}

export function useFinanceInventoryOverview(workshopId?: number) {
  return useQuery<FinanceInventoryOverviewResponse>({
    queryKey:  ['finance-inventory-overview', workshopId],
    queryFn:   () => get<FinanceInventoryOverviewResponse>(EP.FINANCE_INVENTORY_OVERVIEW, { workshop_id: workshopId }),
    staleTime: 30_000,
  });
}

export function useFinanceStockVariance(workshopId?: number) {
  return useQuery<FinanceStockVarianceResponse>({
    queryKey:  ['finance-stock-variance', workshopId],
    queryFn:   () => get<FinanceStockVarianceResponse>(EP.FINANCE_STOCK_VARIANCE, { workshop_id: workshopId }),
    staleTime: 30_000,
  });
}

export function useFinanceStockCounts(workshopId?: number, status?: string) {
  return useQuery<FinanceStockCountSessionListResponse>({
    queryKey:  ['finance-stock-counts', workshopId, status],
    queryFn:   () => get<FinanceStockCountSessionListResponse>(EP.FINANCE_STOCK_COUNTS_LIST, { workshop_id: workshopId, status }),
    staleTime: 15_000,
  });
}

export function useFinanceStockCountDetail(sessionId: number) {
  return useQuery<FinanceStockCountDetailResponse>({
    queryKey:  ['finance-stock-count-detail', sessionId],
    queryFn:   () => get<FinanceStockCountDetailResponse>(EP.FINANCE_STOCK_COUNT_DETAIL(sessionId)),
    staleTime: 5_000,
    enabled:   !!sessionId,
  });
}

// Mobile can enter physical counts and submit a session for review — it
// cannot initiate a session or submit the resulting adjustments (both stay
// desktop-only, see the module header comment above).
export function useFinanceStockCountActions() {
  const qc = useQueryClient();

  async function enterCount(sessionId: number, lineId: number, physicalQty: number, notes?: string): Promise<{ ok: boolean; error?: string }> {
    const result = await put<{ ok: boolean; error?: string }>(EP.FINANCE_STOCK_COUNT_ENTER(sessionId, lineId), { physicalQty, notes });
    await qc.invalidateQueries({ queryKey: ['finance-stock-count-detail', sessionId] });
    return result;
  }

  async function submitForReview(sessionId: number): Promise<{ ok: boolean; error?: string }> {
    const result = await post<{ ok: boolean; error?: string }>(EP.FINANCE_STOCK_COUNT_SUBMIT_REVIEW(sessionId), {});
    await qc.invalidateQueries({ queryKey: ['finance-stock-count-detail', sessionId] });
    await qc.invalidateQueries({ queryKey: ['finance-stock-counts'] });
    return result;
  }

  return { enterCount, submitForReview };
}

export function useFinanceExceptions(status?: string) {
  return useQuery<FinanceExceptionCaseListResponse>({
    queryKey:  ['finance-exceptions', status],
    queryFn:   () => get<FinanceExceptionCaseListResponse>(EP.FINANCE_EXCEPTIONS_LIST, { status }),
    staleTime: 15_000,
  });
}

export function useFinanceExceptionDetail(caseId: number) {
  return useQuery<FinanceExceptionCaseDetailResponse>({
    queryKey:  ['finance-exception-detail', caseId],
    queryFn:   () => get<FinanceExceptionCaseDetailResponse>(EP.FINANCE_EXCEPTION_DETAIL(caseId)),
    staleTime: 5_000,
    enabled:   !!caseId,
  });
}

export function useFinanceExceptionActions() {
  const qc = useQueryClient();

  async function addComment(caseId: number, comment: string): Promise<{ ok: boolean; error?: string }> {
    const result = await post<{ ok: boolean; error?: string }>(EP.FINANCE_EXCEPTION_COMMENT(caseId), { comment });
    await qc.invalidateQueries({ queryKey: ['finance-exception-detail', caseId] });
    return result;
  }

  async function resolve(caseId: number, resolutionNotes: string): Promise<{ ok: boolean; error?: string }> {
    const result = await post<{ ok: boolean; error?: string }>(EP.FINANCE_EXCEPTION_RESOLVE(caseId), { resolutionNotes });
    await qc.invalidateQueries({ queryKey: ['finance-exception-detail', caseId] });
    await qc.invalidateQueries({ queryKey: ['finance-exceptions'] });
    return result;
  }

  return { addComment, resolve };
}
