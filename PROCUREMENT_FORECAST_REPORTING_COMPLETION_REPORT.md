# Procurement Forecasting & Executive Reporting (Phase 5C + 5D) — Completion Report

## Executive Summary

Phase 5C (Procurement Forecasting) and Phase 5D (Executive Reporting) were implemented together per the user's combined spec, on top of the completed Phase 5A (Executive Dashboard) and Phase 5B (Spend & Budget Analytics). Both sub-phases share a single backend forecasting engine and a single report dispatcher, with zero duplicated business logic and zero new database tables. All work is gated behind the existing `procurement-reports` permission — no new permission page-id was introduced anywhere in Phase 5.

Delivered:
- A real statistical forecasting engine (linear regression + series projection + backtested accuracy) driving 9 forecast types and 9 forecasting KPI/chart groups.
- 13 Executive Reports served by one dispatcher function, each reusing an existing aggregator rather than re-deriving data.
- Desktop UI: new "Forecasting & Executive Reports" tab on the Procurement Reports page (9 KPI cards, 7 charts/tables, a report-type selector, CSV export, print-friendly layout).
- Mobile UI: matching "Forecasting & Reports" tab on `ProcurementReportsScreen.tsx` with the same KPIs, charts, and report picker.
- Full verification: static checks, permission/composition greps, and a live database smoke test (30/30 checks passed).

## Architecture Decisions

- **Single shared engine, not per-report logic.** Three small pure functions — `_linearRegression`, `_forecastSeries`, `_backtestAccuracy` — are the only new math in the system. Every forecast-derived KPI and chart (monthly/quarterly/annual projection, volume forecast, supplier demand, budget projection, procurement capacity) calls `_forecastSeries` on its own series rather than each having a bespoke projection method.
- **One dispatcher for 13 reports.** `procurementExecutiveReport(userId, reportType, filters)` mirrors the existing `srmReport` switch-dispatcher pattern. Every branch delegates to an existing aggregator (`procurementExecutiveDashboard`, `procurementSpendBudgetAnalytics`, `procurementReportSupplierPerformance`, `procurementForecastingDashboard`) — the only genuinely new query path is the `forecast` case itself.
- **No new tables.** All forecasting is computed on the fly from existing `requisitions`, `purchase_orders`, `procurement_supplier_contracts`-equivalent contract data, and goods-receipt/delivery dates already in the schema.
- **No permission sprawl.** Both new tabs (desktop and mobile) reuse the pre-existing `procurement-reports` gate used by every other Phase 5 sub-phase.
- **Print-friendly layout via CSS only.** A `@media print` block hides interactive chrome (sidebar, tabs, filter bar, overlay) and normalizes table/card colors for print — no new export system, no headless-print dependency beyond the existing native `window.print()`.

## Forecast Methodology

- **Regression**: ordinary least-squares linear regression (`_linearRegression`) fit over an indexed time series (`x = 0..n-1`, `y = period value`).
- **Projection**: `_forecastSeries(series, periodsAhead)` extrapolates the fitted line forward, clamped at zero (no negative spend/volume forecasts). If fewer than 2 historical points exist, it falls back to repeating the last known value — an explicit, documented graceful degradation, not a fabricated trend.
- **Accuracy**: `_backtestAccuracy(series, holdout=3)` withholds the most recent `holdout` periods, forecasts them from the remaining history, and computes accuracy as `100 - MAPE` (Mean Absolute Percentage Error), rounded to 1 decimal. Returns `null` (not a placeholder number) when there isn't enough history (`< holdout + 2` points) to backtest honestly — confirmed by the live smoke test, which returned `forecastAccuracy: null` against the current single-month dataset rather than inventing a score.
- **Forecast vs Actual chart** is a genuine backtest visualization (`{actual, predicted}` for the most recently held-out real periods) — deliberately distinct from the forward-looking `monthlyProjectionTrend` chart, which shows historical values plus the next-3-month projection. These were caught as accidentally identical during implementation and redesigned before any UI was written.
- **Seasonal Trend** groups historical monthly spend by calendar month-of-year (Jan–Dec) and averages, using real spend data only — no synthetic seasonality curve.
- **Contract Renewal Forecast** uses each contract's own actual `contract_value` as `expectedRenewalValue` — never an invented or estimated number.
- **Supplier Demand Forecast** runs `_forecastSeries` independently per top-10 supplier on that supplier's own monthly spend history; "high demand" suppliers are those whose forecasted next month exceeds their historical average by >20%.

## Business Logic Reused

- `procurementExecutiveDashboard` (5A) — reused wholesale for the `executive_summary`/`executive_dashboard_report` cases, and its `kpis` merged into `kpi_report`/`trend_report`.
- `procurementSpendBudgetAnalytics` (5B) — reused for `spend`/`budget_utilization`/`supplier_spend`/`contract_performance`/`department_spend`/`workshop_spend` report cases.
- `procurementReportSupplierPerformance` (pre-existing) — reused as-is for `supplier_performance`.
- `procurementForecastingDashboard` (new, this phase) — the only new aggregator; consumed by both the `forecast` report case and the desktop/mobile Forecasting tabs directly.
- Desktop chart primitives reused without modification: `_svgDualBar`, `_svgForecast`, `_svgBar`, `_pbar`.
- Mobile chart primitives reused without modification: `HorizontalExpenseChart`, an inline `LineChart` area-trend pattern (mirrored from `ExecutiveScreen.tsx`'s `TrendCard`).
- Export reused: desktop `UFCL.execExport`, mobile `Share.share`. No new export mechanism.

## Files Modified

- `db/services/data.js` — added `_linearRegression`, `_forecastSeries`, `_backtestAccuracy`, `procurementForecastingDashboard`, `PROCUREMENT_EXEC_REPORT_TYPES`, `procurementExecutiveReport`; exports updated.
- `mobile-api/routes/procurementRequisitions.js` — added `/meta/forecasting-dashboard` and `/meta/executive-reports/:reportType` routes.
- `electron/main.js` — added `procurement-forecasting-dashboard:get` and `procurement-executive-report:get` IPC handlers.
- `electron/preload.js` — exposed `procurementForecastingDashboard` and `procurementExecutiveReport`.
- `renderer/app.js` — added the `forecasting` tab to `renderProcurementReports()`'s `TAB_META`, `PROC_EXEC_REPORT_META`, and the tab's full render/export/print logic.
- `renderer/styles.css` — added the `@media print` block.
- `mobile/src/types/api.ts` — added `ProcurementBudgetProjection`, `ProcurementForecastKpis`, `ProcurementSupplierDemand`, `ProcurementContractRenewalForecast`, `ProcurementCalendarEntry`, `ProcurementForecastingDashboard`, `ProcurementExecReportType`, `ProcurementExecReportResult`.
- `mobile/src/api/endpoints.ts` — added `PROCUREMENT_FORECASTING_DASHBOARD`, `PROCUREMENT_EXECUTIVE_REPORT`.
- `mobile/src/hooks/useProcurementDashboard.ts` — added `useProcurementForecastingDashboard`, `useProcurementExecutiveReport`.
- `mobile/src/screens/procurement/ProcurementReportsScreen.tsx` — added the `forecasting` tab, `PROC_EXEC_REPORT_OPTIONS`, `exportPfxCsv`, and the full render logic.

## UI/CSS Improvements

- New "Forecasting & Executive Reports" tab (desktop) / "Forecasting & Reports" tab (mobile), placed as the final tab per the approved tab order: Standard Reports, Analytics, Budget & Spend, Forecasting & Executive Reports.
- 9 forecasting KPI cards, 9 charts/visualizations (Forecast vs Actual, Monthly/Annual Projection, Procurement Demand, Budget Projection bar, Supplier Demand Trend, Seasonal Trend, Contract Renewal Timeline, Procurement Calendar table).
- 13-option report-type selector with generic row-table or key/value summary rendering depending on report shape.
- CSV export (disabled with a toast explanation for summary-style reports, since those have no tabular rows to export).
- Print button (desktop) invoking `window.print()` against the new print stylesheet.

## Verification Results

- `node --check` passed on all 5 touched backend/desktop files.
- `npx tsc --noEmit` passed cleanly on the mobile project (after fixing one `styles.perfScore` → `styles.intelScore` typo).
- Grep-confirmed `procurementForecastingDashboard` gates only on `mustRole(user, 'procurement-reports')`.
- Grep-confirmed all 13 branches of `procurementExecutiveReport` call an existing aggregator function — no duplicated SQL.
- Live database smoke test: **30/30 checks passed**, covering all forecasting KPIs/charts and all 13 report types (including a deliberately-invalid report type, which was rejected gracefully with `ok: false`).

## Known Limitations

- The current dataset has only one month of historical spend, so `forecastAccuracy` correctly returns `null` (insufficient history to backtest) and `seasonalTrend` currently shows a single month. Both will populate meaningfully as more months of real data accumulate — this is expected, honest behavior, not a bug.
- `procurementCapacity` and `expectedProcurementVolume` are currently the same projected monthly PO count viewed under two framings, per the approved spec (no separate capacity-constraint model exists in the data).
- Procurement Calendar is rendered as a plain sorted table rather than a calendar-grid visualization — a deliberate pragmatic choice given the underlying data is a flat list of dated events (renewals + deliveries), not a scheduling primitive.

## Recommendations

- Revisit `forecastAccuracy` and `seasonalTrend` once at least 6–12 months of real procurement activity exist, to confirm the backtest stabilizes as expected.
- No action needed before this can be considered feature-complete for Phase 5C/5D; ready for user review.
