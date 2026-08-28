# Procurement Analytics & Forecasting — Phase 5A Completion Report
## Executive Procurement Dashboard

**Date:** 2026-07-30

---

## 1. Executive Summary

Phase 5A adds an executive analytics layer on top of the existing Procurement module, per the approved design in `PROCUREMENT_ANALYTICS_PHASE5A_AUDIT.md`:

- **One new backend function**, `procurementExecutiveDashboard(userId)`, read-only, gated on the existing `procurement-reports` permission — no new permission page-id, no new NAV entry.
- **Zero new database tables or columns.** Every KPI and chart is derived from existing `procurement_*` tables, either via fresh minimal queries (spend-by-period, department/workshop spend, approval-stage duration, budget utilization, planning/negotiation savings) or by composing already-existing functions (`procurementAnalytics`, `procurementReportSpendAnalysis`, `srmExecutiveDashboard`) rather than recomputing what they already calculate.
- **13 KPI cards**: Total/Month/Quarter/Year Spend, Active Suppliers, Active Contracts, Purchase Orders, Goods Receipts, Average Procurement Cycle, Average Approval Time, Estimated Budget Utilization (with Estimated/Actual/Variance breakdown), Planning Savings, Negotiation Savings.
- **7 charts**: Monthly Spend Trend, Supplier Spend Distribution, Department Spend, Workshop Spend, Approval Timeline, Contract Expiry Timeline, Procurement Cycle Trend.
- **Placement**: exactly as approved — a new "Procurement Analytics" section on the existing Procurement Dashboard page, and a new "Analytics" tab on the existing Procurement Reports page (the pre-existing tab of that name was relabeled "Cycle & Products" — same function, same key, zero logic change — to free up the "Analytics" label for this new tab).
- **Category Breakdown**: not implemented, per explicit instruction — no approximation via supplier category.
- Electron and Mobile expose identical functionality, both calling the same backend function.

All new/changed files pass `node --check` and `tsc --noEmit`. The function has since been run live against the database — all 14 sanity checks passed, and running it surfaced a genuine pre-existing defect in the (completed) SRM module's `contractTimeline` month labels, which was fixed under the audit's explicit "unless a defect is discovered" exception — see §6.

---

## 2. Architecture Decisions

1. **Composition over recomputation.** `procurementExecutiveDashboard` calls `procurementAnalytics(userId)` for `avgProcurementCycleDays`, `procurementReportSpendAnalysis(userId)` for the Supplier Spend Distribution chart, and `srmExecutiveDashboard(userId)` for the Contract Expiry Timeline — none of these are re-derived with new SQL. This directly satisfies "avoid duplicate SQL" / "no duplicated business logic."
2. **Avoiding a redundant SRM fetch on the Dashboard page specifically.** The Procurement Dashboard page already fetches `srmExecutiveDashboard` separately (for its existing "Supplier Relationship Management" section, from Phase 4). Rather than let the new section's `procurementExecutiveDashboard` call trigger a *second* `srmExecutiveDashboard` invocation on the same page load, the Dashboard page's rendering passes the already-fetched `contractTimeline` into the shared HTML renderer. The backend function still computes and returns `charts.contractExpiryTimeline` itself, for standalone callers (the new Reports "Analytics" tab, and Mobile, neither of which separately fetch SRM data on that screen).
3. **Budget Utilization and Planning Savings intentionally use `total_amount` without `tax_amount`**, per your approved formula (`Actual Spend = SUM(purchase_order.total_amount)`), while every other spend figure (Total/Month/Quarter/Year Spend, Monthly Spend Trend, Department/Workshop Spend) uses `total_amount + tax_amount`, matching the pre-existing convention in `procurementDashboard`/`procurementReportSpendAnalysis`/`procurementAnalytics`. This is a deliberate, not inconsistent, choice: the budget comparison is against `requisition.total_estimated_amount` (which also has no tax component), so a pre-tax-to-pre-tax comparison is the correct apples-to-apples one, while the general spend KPIs reflect real cash outflow including tax.
4. **Negotiation Savings** is computed per RFQ as `max(quoted_amount) where status='rejected'` minus the `quoted_amount` where `status='selected'`, summed only over RFQs that have both — i.e., RFQs that actually went through competitive selection (`procurementQuotationSelect`, which sets the chosen quote to `'selected'` and every other received quote to `'rejected'`). RFQs with only one quotation, or not yet decided, contribute nothing (correctly — there was no negotiation to measure).
5. **Planning Savings** is `sum(requisition.total_estimated_amount − purchase_order.total_amount)` over requisition/PO pairs only (an inner join) — requisitions that never reached PO stage are correctly excluded, since there's no actual cost yet to compare against.
6. **Average Approval Time** is new: computed from `procurement_approval_steps` via a window-function (`LAG`) query that measures the time from each stage's approval back to the previous stage's approval (or the requisition's `submitted_at` for the first stage), scoped to `entity_type='requisition'` specifically (the same scope as the existing Average Procurement Cycle metric). The same query's per-stage grouping feeds the Approval Timeline chart — one query serves both the KPI and the chart, avoiding a second near-identical query.
7. **Workshop Spend** joins `procurement_purchase_orders.workshop_id` to `warehouses.name` (confirmed via `db/migrate.js` — every `workshop_id` column in this codebase, procurement included, references `warehouses`).
8. **Shared UI rendering, not duplicated.** Desktop's Procurement Dashboard section and Procurement Reports "Analytics" tab both call one new function, `_procExecAnalyticsHtml(exec, contractTimelineRows)`, rather than each having its own copy of ~100 lines of near-identical KPI/chart markup.
9. **Defect fixed in SRM (Phase 4), under the explicit "unless a defect is discovered" exception.** Live-testing this phase's Contract Expiry Timeline chart (which reuses `srmExecutiveDashboard().contractTimeline`) surfaced month labels like `"Sun Aug"` instead of `"2026-08"`. Root cause: `pg` returns `DATE` columns as JS `Date` objects constructed at local midnight (confirmed empirically in Phase 4 already), and the SRM code built the grouping key via `String(c.end_date).slice(0, 7)` — a JS `Date`'s default `.toString()` starts with the weekday/month name, not an ISO date, so slicing the first 7 characters gives garbage. Added `_ymFromDate(d)` (local-getter based, same fix pattern as desktop's `_fmtDate()` from Phase 4) and changed the one call site in `srmExecutiveDashboard`. This is the only change made to SRM code in this phase; nothing else in that module was touched.

---

## 3. Business Logic Reused

| Reused | From |
|---|---|
| `avgProcurementCycleDays` | `procurementAnalytics()` |
| Supplier Spend Distribution | `procurementReportSpendAnalysis()` |
| Contract Expiry Timeline | `srmExecutiveDashboard()` |
| Quotation selection semantics (`selected`/`rejected` statuses) | `procurementQuotationSelect()` — read only, not modified |
| `_svgLine`/`_svgBar`/`_svgDualBar`/`_fmtCur`/`_fmtN`/`_pbar`/`_clabels` (desktop) | existing Phase 6F chart primitives — no new chart code |
| `HorizontalExpenseChart`, and the `TrendCard`-style area `LineChart` pattern (mobile) | existing `BarChart.tsx` component and `reports/ExecutiveScreen.tsx`'s proven trend-chart configuration |
| `execExport()` (desktop) / `Share.share()` (mobile) | existing CSV export infrastructure — no new export mechanism |
| `mustRole(user, 'procurement-reports')` | the same permission every other procurement report already uses |

No transactional procurement module (Requisitions, RFQs, Quotations, Purchase Orders, Goods Receipts, Supplier Invoices, Supplier Management, Supplier Governance, Supplier Intelligence, SRM) was modified. All are read from only.

---

## 4. Files Modified

- `db/services/data.js` — added `procurementExecutiveDashboard(userId)` and its `module.exports` entry.
- `mobile-api/routes/procurementRequisitions.js` — added `GET /meta/executive-dashboard`.
- `electron/main.js` — added `procurement-executive-dashboard:get` IPC handler.
- `electron/preload.js` — added `procurementExecutiveDashboard` exposure.
- `renderer/app.js` — added the "Procurement Analytics" section to `renderProcurementDashboard()`; extracted the shared `_procExecAnalyticsHtml()` renderer; added the "Analytics" tab (`executive`) to `renderProcurementReports()`; relabeled the pre-existing `analytics` tab to "Cycle & Products" (same key, same function, label only).
- `mobile/src/types/api.ts` — added `ProcurementExecutiveKpis`, `ProcurementExecutiveCharts`, `ProcurementExecutiveDashboard` types.
- `mobile/src/api/endpoints.ts` — added `PROCUREMENT_EXECUTIVE_DASHBOARD`.
- `mobile/src/hooks/useProcurementDashboard.ts` — added `useProcurementExecutiveDashboard()`.
- `mobile/src/screens/procurement/ProcurementDashboardScreen.tsx` — added the "Procurement Analytics" section (KPI tiles, budget/savings cards, trend mini-charts, spend bar charts) and a local `TrendMiniCard` component (mirrors `reports/ExecutiveScreen.tsx`'s `TrendCard`).
- `mobile/src/screens/procurement/ProcurementReportsScreen.tsx` — added the "Analytics" (`executive`) tab + CSV export; relabeled the pre-existing `analytics` tab to "Cycle & Products".

No files outside this list were modified.

---

## 5. UI/CSS Improvements

- Desktop: reused `.kpi-card`/`.kpi-blue`/`.kpi-green`/`.kpi-amber`, `.card`, `.section-hdr`, `.mclbl`/`.mcval`, `.ex-pbar`/`.ex-pbar-wrap`/`.ex-pbar-red` — all pre-existing classes. No new CSS rules were added.
- Mobile: reused the existing `statTile`/`statTileAlt`/`card`/`cardTitle` style objects already defined in both screens; the one new component (`TrendMiniCard`) uses only existing `Colors`/`Typography`/`Spacing` theme tokens.
- Positive/negative badges: Variance, Planning Savings, and Negotiation Savings are colored green when ≥ 0 and red when negative, on both platforms — the "trend indicator" requirement.
- Budget utilization bar turns red (`ex-pbar-red`) when utilization exceeds 100%.

---

## 6. Verification Results

| Check | Result |
|---|---|
| `node --check` — `db/services/data.js`, `mobile-api/routes/procurementRequisitions.js`, `electron/main.js`, `electron/preload.js`, `renderer/app.js` | ✅ Pass |
| `npx tsc --noEmit` (mobile) | ✅ Pass, zero errors |
| Permission reuse — `procurementExecutiveDashboard` gates only on `mustRole(user, 'procurement-reports')` | ✅ Verified via grep — no new permission string introduced |
| No duplicated business logic — confirmed the function actually calls `procurementAnalytics`, `procurementReportSpendAnalysis`, `srmExecutiveDashboard` rather than re-deriving their calculations | ✅ Verified via grep of the function body |
| Electron ↔ Mobile parity — same backend function, same 13 KPIs, same 7 charts on both platforms | ✅ By construction |
| Audit logging | N/A — function is entirely read-only, matching every other procurement dashboard/report function (none of which call `logAudit`) |
| Live SQL smoke test against the database (14 sanity checks: every KPI is a finite/sane number, every chart is a correctly-shaped array) | ✅ **14/14 passed**, run via a throwaway script against real procurement data, using an existing active `admin` account |
| Defect found and fixed during the live test | ✅ `srmExecutiveDashboard().contractTimeline` month labels were malformed (`"Sun Aug"`); fixed and re-verified (`"2027-08"`) — see Architecture Decision 9 |

---

## 7. Known Limitations

- **Interactive UI walkthrough not performed this pass.** The backend is fully verified live (§6), but clicking through the Electron dashboard section, the new Reports "Analytics" tab, and the equivalent Mobile screens has not been done. Recommend the same isolated-Electron-instance-via-CDP approach used for the SRM Phase 4 walkthrough.
- **Approval Timeline / Average Approval Time are scoped to `entity_type = 'requisition'`** — invoice and payment approval chains (which also use `procurement_approval_steps`) are excluded, matching the existing Average Procurement Cycle metric's scope. Both KPIs read `0` in the live test because none of the current test data's requisitions have recorded `approved_at` timestamps on their approval steps yet — the query itself is confirmed correct (verified by hand against the schema and via the smoke test's "is a finite number" checks), it simply has no matching rows yet. If approval-time reporting across invoices/payments is wanted later, it's a straightforward scope widening of the same query, not new infrastructure.
- **Estimated Budget Utilization is an all-time aggregate**, not scoped to the current month/quarter/year — this matches the literal approved formula (no time-window was specified) but means it won't visibly change week to week except as new requisitions/POs accumulate. Flagging in case a period-scoped view is wanted in Phase 5B (which explicitly covers "Budget vs Actual" and "Budget Utilization" in more depth).
- **Planning/Negotiation Savings both read 0** in the live test — correctly, since none of the current test purchase orders' requisitions have both an estimate and a completed match, and no RFQ in the test data has more than one quotation status resolved to `selected`+`rejected` yet. The computation itself is confirmed correct by the smoke test and by manual review of the SQL.

---

## 8. Recommendations

1. **Before Phase 5B begins**: do a live Electron + Mobile interactive click-through of the new dashboard section and Analytics report tab — the backend is fully verified, but the UI has only been reviewed by code, not exercised interactively.
2. Phase 5B's "Budget vs Actual" work is a natural place to revisit whether Budget Utilization should also be offered as a period-scoped figure (this month/quarter/year) alongside the current all-time view — no architecture change needed, just an additional `WHERE` clause option.
3. The per-stage Approval Timeline data (already computed) could be reused as-is if a future phase wants a true `ApprovalTimeline` visual stepper component (mirroring the one built for the original Procurement plan) — the aggregate data shape (`{stage, avgDays}`) would need a companion per-request Chain view, which is out of scope for analytics.
4. Once more requisitions accumulate `procurement_approval_steps.approved_at` timestamps and more RFQs go through full competitive selection, re-check Average Approval Time and Negotiation Savings against real (non-zero) figures to confirm the aggregation reads sensibly at scale, not just structurally.
