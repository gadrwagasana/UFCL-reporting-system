// ERP Enterprise Completion Phase 5 (Workstream 4) — centralized notification
// routing registry, mirroring the exact pattern already established and
// shipped by Global Search's DIRECT_NAV_MODULE (constants/searchModules.ts):
// a bare `navigation.navigate(screen, params)` for id-based detail screens
// that already self-fetch through their own authorized hook, with no
// authorization logic here at all — the destination screen's own existing
// data-fetch call (already gated by the backend) is the only thing that
// decides whether the record is actually shown. This registry is pure
// navigation, never authorization, per Workstream 14.
//
// Reachability caveat (same one Global Search's own file documents): if the
// current user's role navigator doesn't include the target screen at all
// (e.g. a 'sales' user has no MaintenanceJobsStack), `navigation.navigate()`
// cannot find it anywhere in the currently-mounted tree. This is handled by
// wrapping the call and falling back to the same "no linked page available"
// message used for genuinely unmapped modules — never a crash, never a wrong
// screen (Workstream 5/10).
//
// Modules with no confirmed id-based detail screen (rejection_holds,
// resolution_records, harvest_waste, showroom_damage_reports — all
// inline-action list/dashboard screens on mobile per the Phase 3 UI audit,
// not per-record detail screens) and 'material-requests' (MaterialRequestDetailScreen
// needs the full fetched object, not just an id — no dedicated single-record
// fetch hook exists to build one cheaply) are intentionally absent here,
// same reasoning as desktop's registry — documented in the Phase 5
// completion report, not silently dropped.
//
// ERP UI/UX Completion Phase 8 (Workstream 12) — audited the full set of
// relatedModule values data.js actually emits against this registry.
// 'sales'/'deliveries' were left out entirely at the time (no per-record
// open function existed, matching material-requests' own reasoning) — but
// unlike a per-record open, a page-only entry costs nothing and the desktop
// registry has carried the equivalent page-only entries since the ERP
// Final Enterprise Hardening Phase; added here too for parity (still no
// per-record `open`/id-based navigation — that remains new feature work).
export const NOTIFICATION_ROUTES: Partial<Record<string, (relatedId: number) => { screen: string; params: Record<string, unknown> }>> = {
  stock_transfers:            (id) => ({ screen: 'StockTransferDetail',  params: { transferId: id } }),
  maintenance_jobs:           (id) => ({ screen: 'MaintenanceJobDetail', params: { jobId: id } }),
  'procurement-requisitions': (id) => ({ screen: 'RequisitionDetail',    params: { requisitionId: id } }),
  'procurement-orders':       (id) => ({ screen: 'PurchaseOrderDetail',  params: { poId: id } }),
  'procurement-invoices':     (id) => ({ screen: 'InvoiceDetail',        params: { invoiceId: id } }),
  'procurement-rfq':          (id) => ({ screen: 'RfqDetail',            params: { rfqId: id } }),
  'procurement-suppliers':    (id) => ({ screen: 'SupplierDetail',       params: { supplierId: id } }),
  // Pole Production Phase 2 — page-only in spirit (the pending-QC queue is
  // the whole screen, no per-record param needed), but the resolver shape
  // requires an (id) => {screen,params} function; relatedId is simply
  // unused here rather than added as a special case.
  'purchased_pole_qc':        () => ({ screen: 'PurchasedPoleQC', params: {} }),
  // ERP Enterprise Cross-Department Verification — maintenance-overdue
  // escalations route here (relatedId is a machine id, unused — same
  // page-only shape as purchased_pole_qc above; no per-machine detail
  // screen exists, only the list).
  'machines':                 () => ({ screen: 'MachinesList', params: {} }),
  // ERP Final Enterprise Completion Gate — dispatchCreate's notification was
  // malformed at the source (no relatedModule/relatedId at all) until this
  // phase's fix; page-only, same shape as purchased_pole_qc/machines above.
  'dispatch':                 () => ({ screen: 'DispatchList', params: {} }),
  // HR Enterprise Phase 1 — casualLabourRequestsReview's new approval/
  // rejection notification; page-only (the list is the whole screen), same
  // shape as purchased_pole_qc/machines/dispatch above.
  'casual-requests':          () => ({ screen: 'CasualLabourList', params: {} }),
  // Master Professionalization Phase C1 — upgraded from page-only to a real
  // per-record deep link now that SalesOrderDetailScreen exists (it didn't
  // when this was first added as page-only — see the ERP Final Enterprise
  // Hardening Phase comment this replaces). Same reachability caveat as
  // everything else here (falls back to "no linked page" if the current
  // role's navigator doesn't mount SalesOrdersStack).
  'sales':                    (id) => ({ screen: 'SalesOrderDetail', params: { orderId: id } }),
  'deliveries':               () => ({ screen: 'DeliveriesList',  params: {} }),
  'audit':                    () => ({ screen: 'Audit',           params: {} }),
  // ERP Final Enterprise Hardening Phase (Priority 5) — parity with the same
  // 3 desktop entries added this phase for the stock_low/fuel_anomaly/
  // harvest_behind automation rules (data.js); page-only, same reasoning.
  'stock':                    () => ({ screen: 'StockCatalogList', params: {} }),
  'fuel':                     () => ({ screen: 'VehiclesList',     params: {} }),
  'harvest':                  () => ({ screen: 'CompartmentsList', params: {} }),
  // Payroll Enterprise Phase 2 — notifyPayrollEvent's relatedModule for every
  // event; page-only, same class as everything above (a payroll period has
  // no per-record detail screen reachable from a bare id on mobile either —
  // PayrollPeriodsList is the entry point, matching desktop exactly).
  'payroll':                  () => ({ screen: 'PayrollPeriodsList', params: {} }),
};

// 'governance' has its own case (root-level screen, no per-record id — Phase
// 4's GovernanceScreen is a list, not addressable per-row) rather than a
// NOTIFICATION_ROUTES entry, since it doesn't fit the (id) => {screen,params}
// shape (no id needed at all).
export function resolveNotificationRoute(relatedModule: string | null, relatedId: string | number | null):
  { kind: 'root'; screen: 'Governance' } | { kind: 'nested'; screen: string; params: Record<string, unknown> } | { kind: 'none' } {
  if (!relatedModule) return { kind: 'none' };
  if (relatedModule === 'governance') return { kind: 'root', screen: 'Governance' };
  const resolver = NOTIFICATION_ROUTES[relatedModule];
  if (!resolver || relatedId == null) return { kind: 'none' };
  const idNum = Number(relatedId);
  if (!Number.isFinite(idNum)) return { kind: 'none' };
  const { screen, params } = resolver(idNum);
  return { kind: 'nested', screen, params };
}
