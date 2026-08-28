# Changelog — Procurement Analytics & Forecasting, Phase 5A (Executive Procurement Dashboard)

## Added

### Backend
- `procurementExecutiveDashboard(userId)` — read-only, gated on `procurement-reports`. Returns:
  - `kpis`: `totalSpend`, `spendThisMonth`, `spendThisQuarter`, `spendThisYear`, `activeSuppliers`, `activeContracts`, `purchaseOrders`, `goodsReceipts`, `avgProcurementCycleDays`, `avgApprovalDays`, `budgetUtilization` (`estimatedBudget`/`actualSpend`/`utilizationPct`/`variance`), `planningSavings` (`total`/`matchedCount`), `negotiationSavings` (`total`/`rfqCount`).
  - `charts`: `monthlySpendTrend`, `supplierSpendDistribution`, `departmentSpend`, `workshopSpend`, `approvalTimeline`, `contractExpiryTimeline`, `procurementCycleTrend`.

### API
- `GET /api/procurement/requisitions/meta/executive-dashboard` (`mobile-api/routes/procurementRequisitions.js`).

### Electron
- `procurement-executive-dashboard:get` IPC channel + `window.UFCL.procurementExecutiveDashboard()` preload exposure.

### Desktop UI
- New "Procurement Analytics" section on the Procurement Dashboard page (13 KPI cards + 7 charts).
- New "Analytics" tab on the Procurement Reports page, with CSV export via `execExport()`.
- New shared `_procExecAnalyticsHtml()` renderer (used by both surfaces above).

### Mobile
- New types: `ProcurementExecutiveKpis`, `ProcurementExecutiveCharts`, `ProcurementExecutiveDashboard`.
- New hook: `useProcurementExecutiveDashboard()`.
- New "Procurement Analytics" section on `ProcurementDashboardScreen` (KPI tiles, budget/savings cards, `TrendMiniCard` trend charts, `HorizontalExpenseChart` spend breakdowns).
- New "Analytics" tab on `ProcurementReportsScreen`, with CSV export via `Share.share()`.

## Changed
- Desktop `renderProcurementReports()`: the pre-existing "Analytics" tab (cycle days/late deliveries/top products/supplier rankings) relabeled "Cycle & Products" — same tab key (`analytics`), same backend call (`procurementAnalytics`), label only.
- Mobile `ProcurementReportsScreen`: the pre-existing "Analytics" tab relabeled "Cycle & Products" for the same reason.

## Fixed
- `srmExecutiveDashboard()`'s `contractTimeline` produced malformed month labels (e.g. `"Sun Aug"` instead of `"2026-08"`) because `pg` returns `DATE` columns as JS `Date` objects and the code called `String(date).slice(0, 7)` (a `Date`'s default `.toString()` starts with the weekday/month name, not an ISO date). Added `_ymFromDate()` and fixed the one call site. Discovered via this phase's Contract Expiry Timeline chart, which reuses that field; fixed under the "unless a defect is discovered" exception for otherwise-frozen modules — no other SRM code was touched.

## Dependencies
- None added.

## Verification
- `node --check`: pass (all changed backend/desktop files).
- `tsc --noEmit`: pass, zero errors.
- Permission reuse confirmed (only `procurement-reports`, no new page-id).
- Composition-over-duplication confirmed (calls `procurementAnalytics`, `procurementReportSpendAnalysis`, `srmExecutiveDashboard` rather than re-deriving their logic).
- Live backend smoke test: 14/14 checks passed against real procurement data.

## Known issues
- Interactive Electron/Mobile UI walkthrough not yet performed — backend is fully verified live; see Completion Report §7.
