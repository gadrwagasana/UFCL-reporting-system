# Procurement Performance Management (Phase 7) — Completion Report

## Executive Summary

Phase 7 — the final phase of the Procurement Department — adds a Procurement Performance Engine that measures and evaluates everything built in Phases 1–6, without introducing any new procurement workflow. It composes exclusively from five already-existing engines (Executive Dashboard, Spend & Budget Analytics, Forecasting, Supplier Intelligence, Automation), adding only the genuinely new analysis those engines don't already provide: a 15-KPI scorecard with period-over-period trend, per-buyer performance ranking (a dimension nothing in Phases 1–6 tracks), department/workshop performance, a CEO-level executive dashboard, 7-dimension benchmarking, and risk monitoring. No new database table was created, no new permission was introduced (everything reuses `procurement-reports`), and the existing 22-report `procurementExecutiveReport` dispatcher was extended with 9 new report types rather than building a parallel reporting system.

Live verification against the real database (32/32 checks, after fixing two genuine bugs caught by the smoke test — see Known Limitations) confirmed every function returns real, correctly-shaped data — including honest `null`s where the underlying data genuinely doesn't support a metric (e.g., no buyers ranked yet because no `procurement-officer`/`procurement-manager` account has authored an RFQ/PO in this dataset), rather than fabricated values.

## Performance Engine Architecture

```
procurementPerformanceScorecard(userId)          ← 15 KPIs, composes all 5 engines
        │
        ├── procurementExecutiveDashboard()        (Phase 5A — spend/budget/savings/cycle)
        ├── procurementSpendBudgetAnalytics()       (Phase 5B — contracts/departments/workshops)
        ├── procurementForecastingDashboard()       (Phase 5C — forecast accuracy)
        ├── supplierIntelligenceDashboard()         (Phase 3C — supplier scores/risk)
        ├── procurementAutomationDashboard()        (Phase 6 — tasks/escalations/scheduler health)
        └── a small set of period-scoped SQL helpers for the handful of metrics
            those engines only expose as current-snapshot values (SLA compliance,
            automation success rate, spend accuracy, on-time %, lead time, etc.)

procurementBuyerPerformance(userId)                ← genuinely new: groups by created_by
procurementDepartmentPerformance(userId)           ← reuses spend.departmentSpend + one new cycle-time query
procurementWorkshopPerformance(userId)             ← reuses spend.workshopSpend + one new ops query
procurementRiskMonitor(userId)                     ← pure composition, zero new SQL beyond one failed-tick count
procurementBenchmark(userId, {dimension})          ← diffs two already-computed rows/series, no new SQL
procurementExecutivePerformanceDashboard(userId)   ← composes ALL of the above into one CEO view
```

Every function gates on the existing `procurement-reports` permission — confirmed via grep, zero new permission page-ids anywhere in Phase 7.

## KPI Definitions

**Scorecard (15 KPIs).** Each returns `{ current, previous, target, unit, variance, trend, changePct }`.

| KPI | Formula | Target |
|---|---|---|
| Procurement Health Score | Weighted composite (0–100): Budget Utilization proximity to 100% (15%), SLA Compliance (15%), Automation Success Rate (10%), Forecast Accuracy (10%), Avg Supplier Score (15%), On-Time Procurement (15%), inverted Risk Score (20%) — nulls dropped, remaining weights renormalized | 80 |
| Procurement Efficiency | `min(100, targetCycleDays / actualCycleDays × 100)` | 90% |
| Procurement Cycle Time | `avg(po.created_at − requisition.submitted_at)` in days (same formula `procurementAnalytics` already uses, period-scoped) | 14 days |
| Procurement Lead Time | `avg(first_goods_receipt.received_at − po.issue_date)` in days | 7 days |
| Approval Performance | Same `lag(approved_at)`/`submitted_at` per-stage average `procurementExecutiveDashboard` already computes, period-scoped | 3 days |
| Supplier Performance | `supplierIntelligenceDashboard().kpis.averageSupplierScore`, reused as-is | 75 |
| Contract Utilization | `avg(contractUtilization[].utilizationPct)` from Phase 5B | 85% |
| Budget Utilization | `actual PO spend / estimated requisition spend`, period-scoped version of the Phase 5A formula | 100% |
| Spend Accuracy | `100 − avg(|estimated−actual| / estimated × 100)` across budget codes | 90% |
| Forecast Accuracy | `procurementForecastingDashboard().kpis.forecastAccuracy`, reused as-is (nullable — see below) | 80% |
| Automation Success Rate | % of `scheduler_runs` in the period with zero errors | 95% |
| SLA Compliance | % of approval steps resolved within the `procurement_requisition_escalation` rule's `threshold.hours` (read live from `automation_rules`, not hardcoded) | 90% |
| Procurement Savings | Planning Savings + Negotiation Savings (Phase 5A formulas), period-scoped | none (growth-tracked via trend, not a fixed target) |
| On-Time Procurement | % of POs with a goods receipt on/before `expected_delivery_date` | 90% |
| Procurement Risk Score | Weighted composite (0–100, higher = worse): High-Risk Supplier % (25%), Budget-Over-100% Code % (20%), Overdue Task Ratio (20%), Active Escalation Pressure (15%), Expiring Contract/Compliance Ratio (20%) | 20 (ceiling) |

**Buyer Performance** — "Buyer" = any active `procurement-officer`/`procurement-manager` who created at least one RFQ or PO (`procurement_rfqs.created_by` / `procurement_purchase_orders.created_by` — confirmed via audit these are the only officer-attribution columns anywhere in the schema). Overall score is a weighted composite of Budget Compliance (25%), Contract Compliance (20%), Cycle-Time-vs-target (25%), Volume (10%), and Escalation-free record (20%). See Known Limitations for the two buyer fields that cannot be precisely attributed per-individual.

**Department/Workshop Performance** — directly reuses `procurementSpendBudgetAnalytics().departmentSpend/.workshopSpend` for spend/budget/trend, adding only cycle-time (department) and lead-time/outstanding-deliveries (workshop) via one small new aggregate query each. Workshop drill-down reuses the exact Phase 5B mechanism (`drillIntoOrdersByWorkshop` on desktop, `PurchaseOrdersList` route params on mobile) — no new detail screen.

**Executive Dashboard** — 10 KPI cards + 10 charts, entirely composed from the scorecard, the five engines, and the buyer/department/workshop functions above; the only field computed fresh is the 12-month savings trend (parametrized by month, same formula as the existing Phase 5A savings query).

## Benchmark Methodology

`procurementBenchmark(userId, { dimension, a, b })` supports 7 dimensions:
- **Time dimensions** (`month`/`quarter`/`year`): compares the two most recent points of the already-existing spend trend series (`monthlySpendTrend`/`trends.quarterly`/`trends.annual`) — no new SQL.
- **Entity dimensions** (`department`/`workshop`/`buyer`/`supplier`): diffs two named rows drawn from the already-computed performance lists above (`filters.a`/`filters.b` select which two; defaults to the first two if unspecified).

Every comparison returns `{ current, previous, absolute, pct, trend }` — `absolute`/`pct` are `null` when either side is missing data (never fabricated as zero).

## Business Logic Reused

Confirmed via grep (35 call sites): `procurementExecutiveDashboard`, `procurementSpendBudgetAnalytics`, `procurementForecastingDashboard` (including its `_forecastSeries` engine, reused for nothing new here since Phase 7 doesn't forecast — only reads its accuracy figure), `supplierIntelligenceDashboard`, `procurementAutomationDashboard`, and the Phase 5D `procurementExecutiveReport` dispatcher (extended, not duplicated). The only genuinely new SQL is: buyer grouping (never existed before Phase 7), a handful of period-scoped variants of metrics the existing engines only expose as current-snapshot values, and two small ops-metric queries (workshop lead time, department cycle time).

## Files Modified

- `db/services/data.js` — `_monthBounds`, `_procPerfTrend`, `_procPerfKpi`, `_weightedComposite`, `PROC_PERF_TARGETS`, 9 period-scoped metric helpers, `procurementPerformanceScorecard`, `procurementBuyerPerformance`, `procurementDepartmentPerformance`, `procurementWorkshopPerformance`, `procurementRiskMonitor`, `procurementExecutivePerformanceDashboard`, `procurementBenchmark`; `PROCUREMENT_EXEC_REPORT_TYPES` extended to 22 entries; `procurementExecutiveReport` switch extended with 9 cases; exports updated.
- `mobile-api/routes/procurementRequisitions.js` — 7 new `/meta/performance/*` routes.
- `electron/main.js` / `electron/preload.js` — matching IPC handlers/exposures.
- `renderer/app.js` — new "Performance" tab on Procurement Reports with 6 sub-views (Scorecard/Buyers/Departments/Workshops/Executive/Risk), reusing the workshop drill-down.
- `mobile/src/types/api.ts`, `mobile/src/api/endpoints.ts`, `mobile/src/hooks/useProcurementDashboard.ts`, `mobile/src/screens/procurement/ProcurementReportsScreen.tsx` — matching mobile tab.

## UI/CSS Improvements

Both platforms reuse 100% existing design tokens — KPI cards, badges, sticky filters/table headers, skeleton loading, existing SVG chart helpers (`_svgLine`/`_svgBar`) on desktop, `StatusBadge`/stat-tile patterns on mobile. Placement follows the exact Phase 5/6 precedent: one more tab on the existing Procurement Reports page/screen, not a new NAV entry — zero new plumbing beyond what `procurement-reports` already provides.

## Verification Results

- `node --check` passed on all 5 touched backend/desktop files.
- `npx tsc --noEmit` passed cleanly on the mobile project.
- Grep-confirmed: all 7 new top-level functions gate on `procurement-reports` only; no new `CREATE TABLE` in `db/migrate.js` beyond what Phase 6 already added; 35 call sites confirm engine reuse.
- Live database smoke test: **32/32 checks passed**, covering the full 15-KPI scorecard, buyer/department/workshop performance, risk monitor, executive dashboard, all 7 benchmark dimensions (including graceful handling of an unknown dimension and of insufficient data for a two-way comparison), all 9 new report types, and a role-based access-denial spot check.
- Two real bugs were caught and fixed by the smoke test before sign-off: (1) a query referenced `app_users.full_name`, a column that doesn't exist on that table (`app_users.name` is correct — `full_name` exists only on the unrelated `casuals` table); (2) a `pg` result was destructured as `{ rows: rej }` and then incorrectly accessed as `rej.rows[0]` instead of `rej[0]` in the buyer-satisfaction calculation. Both are fixed in the code delivered here.

## Known Limitations

- **Buyer "Overdue Tasks" and "Escalations Received" are not precisely attributable per individual.** The Task Center (`procurement_automation_tasks`) and escalation engine (`escalations`) both own records by *role*, not by individual user — confirmed during the Phase 6 audit and unchanged since (Phase 7 must not modify completed modules). `overdueTasks` is reported as `null` per buyer rather than fabricated; `escalationsReceived` is approximated from escalations on RFQs/invoices the buyer personally created, which is real and attributable but not a complete picture of every escalation that role-level automation ever routed to them.
- **"Average Approval Time" per buyer is `null`.** Approval steps are assigned to a role (`assigned_role`), not a specific user, so there is no per-buyer approval-time figure that wouldn't be fabricated.
- **Health Score, Risk Score, Supplier Performance, Contract Utilization, and Forecast Accuracy have no "previous period" value** (`previous: null`, `trend: 'flat'`) — these are point-in-time composites (current supplier risk tier, current active-escalation count, etc.) that nothing in this codebase snapshots historically; computing a "previous month" value for them would mean fabricating history that was never recorded. The other 10 scorecard KPIs have real month-over-month comparisons.
- **"Automation Failures" in the Risk Monitor is a shared-infrastructure signal, not procurement-exclusive** — the 15-minute scheduler tick records one error count per tick, not per task within the tick, so a non-procurement task failing would also show up here. This is the most honest signal actually available rather than a fabricated procurement-only failure count.
- **Contract Utilization can show extreme values** (e.g. one contract with a very small `contract_value` against a much larger actual supplier spend produces a triple-digit utilization %) — this is Phase 5B's pre-existing `utilizationPct` calculation working exactly as designed on real outlier data; Phase 7 averages it as-is rather than clamping or "fixing" a completed module's math without a confirmed defect.
- **Buyer ranking is currently empty in this dataset** — no active `procurement-officer`/`procurement-manager` account has authored an RFQ or PO yet in this environment (test data was created under an admin account). This is expected, honest behavior, not a bug — the ranking will populate as real officers begin using the module.

## Recommendations

- Once officers begin actually creating RFQs/POs under their own accounts (rather than admin), revisit the buyer ranking to confirm the weighting feels right in practice.
- If precise per-user task/escalation ownership becomes valuable, that would require adding an `owner_user_id` alongside the existing `owner_role` on `procurement_automation_tasks` — a schema change to a completed Phase 6 module, deliberately out of scope here and left for a future phase if requested.
- With this phase, the Procurement Department is feature-complete per the original mandate: requisition-to-payment operations, supplier lifecycle management, executive analytics, forecasting, automation, and now performance measurement are all in place and cross-consistent.
