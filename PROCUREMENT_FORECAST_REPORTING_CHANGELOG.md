# Changelog — Procurement Forecasting & Executive Reporting (Phase 5C + 5D)

## Added

### Backend (`db/services/data.js`)
- `_linearRegression(points)` — OLS linear regression helper.
- `_forecastSeries(series, periodsAhead)` — projects a time series forward using linear regression, clamped at zero, with a last-value fallback for series shorter than 2 points.
- `_backtestAccuracy(series, holdout=3)` — computes forecast accuracy as `100 - MAPE` against held-out real periods; returns `null` when there's insufficient history to backtest honestly.
- `procurementForecastingDashboard(userId)` — new aggregator returning forecasting KPIs (`expectedMonthlySpend/QuarterlySpend/AnnualSpend`, `budgetProjection`, `forecastAccuracy`, `upcomingContractRenewals`, `expectedProcurementVolume`, `highDemandSuppliersCount`, `procurementCapacity`), charts (`forecastVsActual`, `monthlyProjectionTrend`, `annualProjection`, `procurementDemand`, `supplierDemandTrend`, `seasonalTrend`), `contractRenewalForecast`, `highDemandSuppliers`, and a merged `calendar` of upcoming renewals/deliveries.
- `PROCUREMENT_EXEC_REPORT_TYPES` and `procurementExecutiveReport(userId, reportType, filters)` — 13-report dispatcher (`executive_summary`, `spend`, `budget_utilization`, `forecast`, `supplier_performance`, `supplier_spend`, `contract_performance`, `department_spend`, `workshop_spend`, `savings`, `kpi_report`, `trend_report`, `executive_dashboard_report`), each branch reusing an existing aggregator.

### API
- `GET /api/procurement/requisitions/meta/forecasting-dashboard`
- `GET /api/procurement/requisitions/meta/executive-reports/:reportType`
- Electron IPC: `procurement-forecasting-dashboard:get`, `procurement-executive-report:get` (+ preload exposures).

### Desktop (`renderer/app.js`, `renderer/styles.css`)
- New "Forecasting & Executive Reports" tab on the Procurement Reports page: 9 KPI cards, 7 chart/table sections, 13-report selector with CSV export and print button.
- Print-friendly `@media print` stylesheet block.

### Mobile
- New types: `ProcurementBudgetProjection`, `ProcurementForecastKpis`, `ProcurementSupplierDemand`, `ProcurementContractRenewalForecast`, `ProcurementCalendarEntry`, `ProcurementForecastingDashboard`, `ProcurementExecReportType`, `ProcurementExecReportResult`.
- New hooks: `useProcurementForecastingDashboard`, `useProcurementExecutiveReport`.
- New "Forecasting & Reports" tab on `ProcurementReportsScreen.tsx` mirroring the desktop tab's KPIs, charts, and report picker.

## Fixed
- Corrected a `styles.perfScore` reference (nonexistent) to `styles.intelScore` (the correct existing style) in the new mobile Budget & Spend tab JSX, caught via `tsc --noEmit`.

## Verification
- `node --check` passed on all touched backend/desktop files.
- `npx tsc --noEmit` passed cleanly on mobile.
- Live database smoke test: 30/30 checks passed (all forecasting KPIs/charts + all 13 report types + graceful rejection of an invalid report type).

## Notes
- No new database tables were introduced.
- No new permission page-id was introduced; all functionality gated behind the existing `procurement-reports` permission.
- Not committed — per standing release discipline, changes are left staged for user review and explicit commit approval.
