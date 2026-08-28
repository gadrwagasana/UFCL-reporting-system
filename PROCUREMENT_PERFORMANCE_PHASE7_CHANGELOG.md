# Changelog — Procurement Performance Management (Phase 7)

## Added

### Backend (`db/services/data.js`)
- Performance engine core: `_monthBounds`, `_procPerfTrend`, `_procPerfKpi`, `_weightedComposite`, `PROC_PERF_TARGETS`.
- Period-scoped metric helpers: `_procPerfSlaCompliance`, `_procPerfAutomationSuccess`, `_procPerfSpendAccuracy`, `_procPerfBudgetUtilization`, `_procPerfOnTime`, `_procPerfLeadTime`, `_procPerfApprovalDays`, `_procPerfCycleDays`, `_procPerfSavings`.
- `procurementPerformanceScorecard(userId)` — 15 KPIs with current/previous/target/variance/trend.
- `procurementBuyerPerformance(userId)` — per-officer metrics + ranking (new: buyer/officer attribution didn't exist before Phase 7).
- `procurementDepartmentPerformance(userId)`, `procurementWorkshopPerformance(userId)`.
- `procurementRiskMonitor(userId)`.
- `procurementExecutivePerformanceDashboard(userId)` — CEO-level 10 KPIs + 10 charts.
- `procurementBenchmark(userId, { dimension, a, b })` — month/quarter/year/department/workshop/buyer/supplier comparisons.
- `PROCUREMENT_EXEC_REPORT_TYPES` extended from 13 to 22 entries; `procurementExecutiveReport` switch extended with `performance_report`, `buyer_performance_report`, `department_performance_report`, `workshop_performance_report`, `executive_performance_report`, `performance_kpi_report`, `benchmark_report`, `risk_report`, `health_report`.

### API / IPC
- `mobile-api/routes/procurementRequisitions.js`: `GET /meta/performance/scorecard`, `/buyers`, `/departments`, `/workshops`, `/executive-dashboard`, `/benchmark`, `/risk`.
- `electron/main.js` / `preload.js`: matching `procurement-performance-*` IPC channels.

### Desktop (`renderer/app.js`)
- New "Performance" tab on Procurement Reports: 6 sub-views (Scorecard, Buyers, Departments, Workshops, Executive, Risk), workshop rows reuse the existing `drillIntoOrdersByWorkshop` drill-down.

### Mobile
- New types: `ProcurementPerfKpi`, `ProcurementPerformanceScorecard`, `ProcurementBuyerPerformance`, `ProcurementDepartmentPerformance`, `ProcurementWorkshopPerformance`, `ProcurementExecutivePerformanceDashboard`, `ProcurementRiskMonitor`, `ProcurementBenchmarkResult`.
- New hooks: `useProcurementPerformanceScorecard`, `useProcurementBuyerPerformance`, `useProcurementDepartmentPerformance`, `useProcurementWorkshopPerformance`, `useProcurementExecutivePerformance`, `useProcurementRiskMonitor`, `useProcurementBenchmark`.
- New "Performance" tab on `ProcurementReportsScreen.tsx` mirroring the desktop tab, workshop rows navigate to `PurchaseOrdersList` with the existing `workshopId`/`workshopName` params.

## Fixed
- `procurementBuyerPerformance`'s buyer-fetch query referenced `app_users.full_name`, a column that doesn't exist on `app_users` (`name` is correct) — caught by the live smoke test, fixed before sign-off.
- Same function's supplier-satisfaction sub-query double-dereferenced a `pg` result (`rej.rows[0]` instead of `rej[0]` after destructuring `{ rows: rej }`) — caught by the same smoke test run, fixed before sign-off.

## Verification
- `node --check` passed on all touched backend/desktop files.
- `npx tsc --noEmit` passed cleanly on mobile.
- Live database smoke test: 32/32 checks passed (15-KPI scorecard, buyer/department/workshop performance, risk monitor, executive dashboard, all 7 benchmark dimensions, all 9 new report types, role-based access-denial check).

## Notes
- No new database tables — pure composition/aggregation layer over Phases 1–6.
- No new permission page-id — every new function/route/tab gates on the existing `procurement-reports` permission.
- Confirmed via grep: 35 call sites into the existing Analytics/Forecasting/Supplier Intelligence/Automation engines; no duplicated SQL beyond genuinely new metrics (buyer attribution, period-scoped variants of a few snapshot-only metrics).
- This closes out the Procurement Department per the Phase 7 mandate — the module is now considered feature-complete.
- Not committed — per standing release discipline, changes are left staged for user review and explicit commit approval.
