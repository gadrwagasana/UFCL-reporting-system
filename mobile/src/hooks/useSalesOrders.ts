import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post, patch, del } from '../api/client';
import { EP } from '../api/endpoints';
import type { SalesListResponse, SalesOrderDetailResponse, SalesDashboardResponse, SalesReportResponse } from '../types/api';

const QK = ['sales-orders'] as const;

// Master Professionalization Phase C1 (Gap Register PR-01) — useSalesOrdersList
// used to accept no params at all, matching the old backend contract that
// only ever took a workshop id and hard-capped at 50 rows. Same
// filters-object-in-queryKey pattern as usePayrollPeriods.
export interface SalesOrdersFilters {
  search?:        string;
  status?:        string;
  paymentStatus?: string;
  dateFrom?:      string;
  dateTo?:        string;
  sortBy?:        string;
  sortDir?:       'asc' | 'desc';
  page?:          number;
  pageSize?:      number;
}

export function useSalesOrdersList(filters: SalesOrdersFilters = {}) {
  const { search, status, paymentStatus, dateFrom, dateTo, sortBy, sortDir, page, pageSize } = filters;
  return useQuery<SalesListResponse>({
    queryKey:  [...QK, search, status, paymentStatus, dateFrom, dateTo, sortBy, sortDir, page, pageSize],
    queryFn:   () => get<SalesListResponse>(EP.SALES_LIST, {
      search, status, payment_status: paymentStatus, date_from: dateFrom, date_to: dateTo,
      sort_by: sortBy, sort_dir: sortDir, page, page_size: pageSize,
    }),
    staleTime: 30_000,
  });
}

// Master Professionalization Phase C1 — no single-record detail fetch
// existed at all; every screen re-derived a row from the already-fetched
// list (Gap Register — "Sales Orders had no detail/drill-down view
// anywhere").
export function useSalesOrderDetail(id: number) {
  return useQuery<SalesOrderDetailResponse>({
    queryKey:  [...QK, 'detail', id],
    queryFn:   () => get<SalesOrderDetailResponse>(EP.SALES_DETAIL(id)),
    staleTime: 0,
    enabled:   !!id,
  });
}

// ERP Final Enterprise Completion Gate — confirmed no Sales Dashboard existed
// on either platform; real status-count/revenue aggregate, not a slice of
// SALES_LIST's own 50-row-capped rows.
export function useSalesDashboard(workshopId?: number | null) {
  return useQuery<SalesDashboardResponse>({
    queryKey:  ['sales-dashboard', workshopId ?? null],
    queryFn:   () => get<SalesDashboardResponse>(EP.SALES_DASHBOARD, workshopId ? { workshopId } : undefined),
    staleTime: 30_000,
  });
}

export interface SalesReportFilters { dateFrom?: string; dateTo?: string; workshopId?: number; }

export function useSalesReport(filters: SalesReportFilters) {
  return useQuery<SalesReportResponse>({
    queryKey:  ['sales-report', filters],
    queryFn:   () => get<SalesReportResponse>(EP.SALES_REPORT, filters as Record<string, unknown>),
    staleTime: 30_000,
  });
}

export function useSalesOrderCreate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      order_number:     string;
      customer_id?:     number;
      customer_name:    string;
      product_type:     string;
      product_sub_type?: string;
      product_size:     string;
      quantity:         number;
      unit_price:       number;
      currency:         string;
      price_tax_type:   string;
      payment_due_date?: string;
      notes?:           string;
      reason:           string;
    }) => post<{ ok: true }>(EP.SALES_CREATE, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useSalesOrderUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: {
      id:               number;
      order_number:     string;
      customer_id?:     number;
      customer_name:    string;
      product_type:     string;
      product_sub_type?: string;
      product_size:     string;
      quantity:         number;
      unit_price:       number;
      currency:         string;
      price_tax_type:   string;
      payment_due_date?: string;
      notes?:           string;
    }) => patch<{ ok: true }>(EP.SALES_UPDATE(id), payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useSalesOrderPay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, paymentStatus }: { id: number; paymentStatus: 'Paid' | 'Unpaid' }) =>
      patch<{ ok: true }>(EP.SALES_PAY(id), { paymentStatus }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useSalesOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      patch<{ ok: true }>(EP.SALES_STATUS(id), { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useSalesOrderCloseShort() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => post<{ ok: true }>(EP.SALES_CLOSE_SHORT(id), {}),
    onSuccess:  () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useSalesOrderDelete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
      del<{ ok: true }>(EP.SALES_DELETE(id), { reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useSalesOrderDeliver() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: {
      id:           number;
      driver_name:  string;
      vehicle_id?:  number;
      delivery_date?: string;
      route?:       string;
      notes?:       string;
      qty_dispatched?: number;
    }) => post<{ ok: true }>(EP.SALES_DELIVER(id), payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}
