# Procurement Forecasting & Executive Reporting — Audit
## Phase 5C (Forecasting) + Phase 5D (Executive Reports), combined

**Scope:** read-only research + methodology design, documented per your instruction that this phase's spec arrives pre-approved (mirroring the SRM Phase 4 prompt's pattern) rather than a separate open-questions round. This document records what already exists, confirms zero new tables are needed, and fixes the exact forecasting methodology before any code is written.

---

## 1. What already exists (reusable as-is)

From Phase 5A (`procurementExecutiveDashboard`) and 5B (`procurementSpendBudgetAnalytics`), already computed and directly reusable as historical inputs to this phase's forecasts, and as report sources for Phase 5D:

| Existing data | Function |
|---|---|
| Monthly spend (12mo), quarterly/annual spend trend | 5A `charts.monthlySpendTrend`, 5B `trends.quarterly`/`trends.annual` |
| Contract expiry timeline, active contract list | SRM `srmExecutiveDashboard().contractTimeline`; `procurement_supplier_contracts` (status, end_date, contract_value) |
| Supplier spend (total, monthly, share) | 5B `supplierSpend` |
| Department/Workshop spend + variance | 5B `departmentSpend`/`workshopSpend` |
| Budget Utilization (estimated/actual/variance) | 5A `kpis.budgetUtilization` |
| Planning/Negotiation Savings | 5A `kpis.planningSavings`/`negotiationSavings` |
| Supplier performance (rating, reject rate) | pre-existing `procurementReportSupplierPerformance` |
| Contract Utilization (value vs. actual spend, over/under/on-track) | 5B `contractUtilization` |
| Chart primitive for historical+forecast dual-line rendering | `_svgForecast(hist, fcst, opts)` (`renderer/app.js:4409`) — **already built for exactly this use case**, confirmed unused until now |
| Generic sortable table, search/filter pattern, CSV export, drill-down idioms | `wireSortableTable`, existing filter-bar pattern, `execExport()`/`Share.share()`, `openSupplierManageOverlay()` |

**Zero new database tables are required.** Every forecast in this phase is a projection computed from the historical series above (or fresh minimal grouping queries over the same existing tables) — nothing here needs new storage.

## 2. The forecasting engine — methodology (fixed here, not an open question)

"No artificial values, no placeholder data" requires a real, explainable statistical method, not a copy of last period's number. The engine (internal to `db/services/data.js`, three pure functions, exported only via the aggregators that use them — this is the "one shared engine" the spec requires):

- **`_linearRegression(points)`** — ordinary least-squares fit (`y = slope·x + intercept`) over a time-indexed series. Standard, deterministic, fully derived from the input data.
- **`_forecastSeries(series, periodsAhead)`** — projects `periodsAhead` future points using the regression fit; if fewer than 2 historical points exist, flat-projects the last known real value (still real data, never an invented number) rather than fitting a meaningless line through one point.
- **`_backtestAccuracy(series, holdout)`** — the engine's honesty check: holds out the last `holdout` (default 3) real periods, fits on everything before them, forecasts those periods, and compares to what actually happened (Mean Absolute Percentage Error, inverted to a 0–100 "accuracy" score). This is what "Forecast Accuracy" means in this implementation — not a guess, a measured back-test against real held-out history. Returns `null` (surfaced as "Not enough history yet") when there isn't enough data to backtest honestly, rather than fabricating a number.

Every forecast KPI/chart in this phase (Monthly/Quarterly/Annual spend, Budget Projection, Procurement Volume, Supplier Demand, Procurement Capacity) calls `_forecastSeries` against a *different* real historical series — the engine itself is written once and reused for all of them, satisfying "Do NOT duplicate calculations."

## 3. Concepts with no direct precedent — methodology decisions

| Concept | Decision |
|---|---|
| **Budget Projection** | Forecast total spend forward (via the engine) and compare against the most recent known Estimated Budget total (5A) to project a future utilization % — same Estimated-vs-Actual concept as 5A/5B, just applied to a projected figure instead of an actual one. |
| **Procurement Volume Forecast / Procurement Capacity** | Both are the engine applied to a *count* series (purchase orders issued per month) rather than a *spend* series — "Volume" is the projected count itself; "Capacity" is presented as the same projected monthly throughput, framed as "how much procurement activity this trend implies per month." Deliberately the same underlying number in two KPI cards with different framing, not two different calculations. |
| **Supplier Demand Forecast / High Demand Suppliers** | The engine applied per-supplier to that supplier's own monthly spend series (top 10 suppliers by current total spend, reusing 5B's ordering). "High Demand Suppliers" = those whose forecasted next-month spend exceeds their historical average by a noticeable margin (>20%) — a real, computed filter, not a separate query. |
| **Contract Renewal Forecast / Upcoming Contract Renewals / Contract Renewal Timeline** | Not a statistical forecast — a real, derived list of `active` contracts whose `end_date` falls within the next 12 months, each with its own `contract_value` shown as the expected renewal value (the only real number available — no invented "predicted" value). This reuses the exact same contract/expiry query shape already established in SRM, just widened from 90 days (SRM's expiry-warning window) to 12 months (a forecasting/planning window). |
| **Seasonal Purchasing Trend** | Historical monthly spend grouped by calendar month-of-year (January across all available years, February across all available years, etc.) and averaged — reveals which calendar months historically run high/low, using only real historical averages, not a projection. |
| **Procurement Calendar** | A merged, real, chronological list of already-known upcoming dates: contract end dates (next 90 days) + PO expected delivery dates (next 30 days) — composed from existing columns, not a new concept or new table. |

## 4. Executive Reports (Phase 5D) — one dispatcher, thirteen types, zero new SQL beyond the forecast engine

Following the exact precedent already established by `srmReport(userId, reportType, filters)`: one new function, `procurementExecutiveReport(userId, reportType, filters)`, with a `switch` over 13 named types. Every branch either returns rows already computed by an existing function, or (for the one genuinely new type) calls the forecasting engine:

| Report type | Source (no new query) |
|---|---|
| `executive_summary` | `procurementExecutiveDashboard()` |
| `spend` | 5B `monthlySpendTrend`/`budgetByCode` |
| `budget_utilization` | 5B `budgetByCode` |
| `forecast` | **new** — `procurementForecastingDashboard()` |
| `supplier_performance` | existing `procurementReportSupplierPerformance()` |
| `supplier_spend` | 5B `supplierSpend` |
| `contract_performance` | 5B `contractUtilization` |
| `department_spend` | 5B `departmentSpend` |
| `workshop_spend` | 5B `workshopSpend` |
| `savings` | 5A `kpis.planningSavings`/`negotiationSavings` (aggregate summary — no per-transaction savings breakdown exists in any prior phase, so this report presents the same totals already computed, not a new detailed query) |
| `kpi_report` | 5A + `procurementForecastingDashboard()` KPIs combined into one flat summary |
| `trend_report` | 5A/5B trend series combined |
| `executive_dashboard_report` | **same function as `executive_summary`** (`procurementExecutiveDashboard()`) — the spec lists these as two distinct named reports, but they describe the same underlying data; giving them separate backend logic would directly violate "no duplicated business logic." The UI distinguishes them by presentation (one as a plain report table, the other framed for printing), not by computation. |

## 5. Placement & UI

One new tab, **"Forecasting & Executive Reports"**, on the existing Procurement Reports page (both platforms), gated on the existing `procurement-reports` permission — no new NAV entry, no new permission. The tab contains, top to bottom: the Forecasting Dashboard (9 KPI cards + 9 charts, all sourced from `procurementForecastingDashboard()`), then a report-type dropdown (13 options) + CSV export, mirroring the exact pattern already used by the SRM and Supplier Intelligence report tabs (generic dropdown + generic column table + export button).

"Print-friendly layout": reusing Electron's built-in `webContents.print()` (already used for PO PDF generation's underlying Chromium engine) via a plain "Print" button and a small `@media print` CSS rule that hides interactive chrome (buttons, sidebar, tab bar) — not a new export system, and not the same as CSV export.

## 6. Verification plan

Same checklist as Phase 5A/5B: `node --check`, `tsc --noEmit`, live backend smoke test (including a check that `_backtestAccuracy` returns `null` gracefully on short/synthetic-adjacent series rather than throwing), permission-reuse grep, composition-over-duplication grep, Electron/Mobile parity by construction.
