# Changelog — Procurement Analytics & Forecasting, Phase 5B (Spend & Budget Analytics)

## Added

### Backend
- `procurementSpendBudgetAnalytics(userId)` — read-only, gated on `procurement-reports`. Reuses `procurementExecutiveDashboard()`'s `kpis` wholesale; adds:
  - `budgetByCode`: full Budget-vs-Actual per budget code (estimated, actual, variance, utilization %).
  - `departmentSpend` / `workshopSpend`: full spend + estimated budget + variance + 6-month trend, per department/workshop.
  - `supplierSpend`: total spend, this-month spend, PO count, average order value, procurement share %, per supplier.
  - `contractSpendSplit`: spend under active contract vs. outside contract.
  - `contractUtilization`: per contract — value, actual (supplier total) spend, utilization %, over/under/on-track indicator.
  - `trends.quarterly` / `trends.annual`: spend trend series.

### API
- `GET /api/procurement/requisitions/meta/spend-budget-analytics`.

### Electron
- `procurement-spend-budget-analytics:get` IPC channel + `window.UFCL.procurementSpendBudgetAnalytics()` preload exposure.
- `drillIntoOrdersByWorkshop(workshopId, workshopName)` — one-shot preset consumed by `renderProcurementOrders()`.

### Desktop UI
- New "Budget & Spend" tab on the Procurement Reports page: KPI cards, Quarterly/Annual trend charts, Budget-vs-Actual table, Department Analysis table (with trend sparkline), Workshop Analysis table (with trend sparkline + drill-down to Purchase Orders), Supplier Spend table (searchable, with drill-down to supplier profile), Contract Spend split + Contract Utilization table (with drill-down), Supplier Spend Distribution + Contract Utilization charts. CSV export via `execExport()`.
- `renderProcurementOrders()`: optional workshop pre-filter (dismissible banner), consumed once from the new drill-down entry point.

### Mobile
- New types: `ProcurementBudgetByCode`, `ProcurementDepartmentSpend`, `ProcurementWorkshopSpend`, `ProcurementSupplierSpend`, `ProcurementContractUtilization`, `ProcurementSpendBudgetAnalytics`.
- New hook: `useProcurementSpendBudgetAnalytics()`.
- New "Budget & Spend" tab on `ProcurementReportsScreen` (KPI tiles, trend charts, all 5 sections as card lists, searchable Supplier Spend, drill-downs), with CSV export via `Share.share()`.
- `PurchaseOrdersListScreen`: accepts an optional `{ workshopId, workshopName }` route param (from `ProcurementStackParamList`), applies it as a client-side filter with a dismissible banner.

## Dependencies
- None added.

## Verification
- `node --check`: pass (all changed backend/desktop files).
- `tsc --noEmit`: pass, zero errors.
- Permission reuse confirmed (only `procurement-reports`, no new page-id).
- Composition-over-duplication confirmed (`procurementSpendBudgetAnalytics` calls `procurementExecutiveDashboard` for all KPIs rather than re-deriving them).
- Live backend smoke test: 12/12 checks passed against real data, including a live 1000%-utilization contract case validating the indicator thresholds.

## Known issues
- Interactive Electron/Mobile UI walkthrough not yet performed — backend is fully verified live; see Completion Report §7.
- Over/under-utilization thresholds (100%/70%) were not specified in the approved design; chosen as reasonable defaults pending confirmation.
