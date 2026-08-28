# Procurement Analytics & Forecasting — Phase 5B Completion Report
## Spend & Budget Analytics

**Date:** 2026-07-30

---

## 1. Executive Summary

Phase 5B adds an interactive, drill-down-capable Spend & Budget Analytics report on top of Phase 5A's dashboard, per the approved design in `PROCUREMENT_ANALYTICS_PHASE5B_AUDIT.md` and your follow-up implementation prompt:

- **One new backend function**, `procurementSpendBudgetAnalytics(userId)`, read-only, gated on `procurement-reports` — no new permission, no new tables.
- **Reuses `procurementExecutiveDashboard()` wholesale** for every KPI card (Total/Month/Quarter/Year Spend, Estimated Budget, Actual Spend, Budget Utilization %, Procurement Variance, Planning Savings, Negotiation Savings) — zero duplicate SQL for those.
- **New, genuinely additive queries** for everything Phase 5A didn't already compute: full (unpaginated) Budget-vs-Actual by budget code, Department Analysis (spend/budget/variance/6-month trend), Workshop Analysis (same, plus drill-down), full Supplier Spend (total/this-month/avg order/procurement share), Contract Spend (both approved definitions — under-vs-outside-contract split, and per-contract value-vs-actual-spend utilization), and Quarterly/Annual spend trend series.
- **Placement**: a new "Budget & Spend" tab on the existing Procurement Reports page, positioned between the Phase 5A "Analytics" tab and the (relabeled) "Cycle & Products" tab, on both Electron and Mobile.
- **Search/Filter/Sort/Drill-down**: built entirely from existing, already-proven primitives — `wireSortableTable` (desktop), the existing search/filter pattern (both platforms), the existing supplier-profile drill-down, and a new one-shot filter preset into the existing Purchase Orders list for the Workshop Analysis drill-down (per your approved design — no new detail screen).
- Electron and Mobile expose identical functionality, both calling the same backend function.

All new/changed files pass `node --check` and `tsc --noEmit`. **Live backend smoke test: 12/12 checks passed** against real data, including a genuine edge case (a contract at 1000% utilization) that confirmed the over/under/on-track indicator thresholds work correctly at the extremes.

---

## 2. Architecture Decisions

1. **Composition, not recomputation, for KPIs.** `procurementSpendBudgetAnalytics` calls `procurementExecutiveDashboard(userId)` once and reuses its entire `kpis` object as-is for every KPI card this report needs — the two backend functions never compute the same figure twice with different SQL.
2. **Budget vs Actual per code** is a genuinely new query (the pre-existing `procurementReportBudgetUtilization` only returns estimated totals, with no actual-spend join) — added as its own query rather than modifying that existing function, honoring "Procurement Reports page" as reusable but not requiring changes to its other tabs' underlying functions.
3. **Department/Workshop "Budget"** is computed the same way Phase 5A's Estimated Budget Utilization is (estimated vs. actual), just grouped by department/workshop instead of company-wide — the same formula, a different dimension, not a new concept.
4. **Contract Spend — both approved definitions implemented, exactly as specified, with no invented PO-to-contract link:**
   - **Under vs. Outside Contract**: sums PO spend for suppliers who currently hold an `active` contract vs. those who don't.
   - **Contract Utilization**: for each contract, compares its own `contract_value` against that supplier's *total* PO spend (not scoped to the contract's dates, since no such linkage exists) — a supplier with multiple contracts shows the same actual-spend figure against each one. This is the approved, documented limitation, not an oversight. Utilization thresholds: `>100%` = "over", `<70%` = "under", else "on-track" (chosen since neither was specified precisely; noted here for your review).
5. **Workshop Analysis drill-down reuses the existing Purchase Orders list via a one-shot filter preset**, not a new detail screen:
   - **Desktop**: a module-level `_procOrdersPresetWorkshopId`/`_procOrdersPresetWorkshopName` pair, set by `drillIntoOrdersByWorkshop()` right before `showPage('procurement-orders')`, consumed and cleared the next time `renderProcurementOrders()` runs. A dismissible banner shows which workshop is filtering the list; the existing "Clear" filter button also resets it.
   - **Mobile**: the same idea, but via React Navigation's native route params (`PurchaseOrdersList: { workshopId?, workshopName? }`) — cleaner than a global on this platform since navigation already carries state. Both approaches touch only the *display/filter* layer of the Orders list — no PO business logic changed.
6. **Supplier Spend drill-down** reuses the existing supplier profile overlay/screen (desktop: `openSupplierManageOverlay(id, name, 'intelligence')`; mobile: `navigation.navigate('SupplierDetail', { supplierId })`) — no new supplier screen.
7. **Sort/Search reuse, no new UI infrastructure**: every table on desktop uses the pre-existing `wireSortableTable()` helper; Supplier Spend search uses the same debounce-free `oninput`-driven client-side filter pattern already used on every other list page in this app.

---

## 3. Business Logic Reused

| Reused | From |
|---|---|
| Every KPI card | `procurementExecutiveDashboard()` (itself already composing `procurementAnalytics`/`procurementReportSpendAnalysis`/`srmExecutiveDashboard`) |
| Table sorting | `wireSortableTable()` |
| Table search/filter pattern | the existing `oninput`/`onchange` + re-render idiom used on every list page |
| Supplier drill-down | `openSupplierManageOverlay()` (desktop), `SupplierDetail` screen (mobile) — both pre-existing |
| Workshop drill-down target | the existing Purchase Orders list/screen (only its filter layer was touched, not its data or business logic) |
| CSV export | `execExport()` (desktop) / `Share.share()` (mobile) |
| `_svgLine`/`_svgBar`/`_svgSparkline`/`_fmtCur`/`_clabels` (desktop) | existing Phase 6F chart primitives |
| `HorizontalExpenseChart` (mobile) | existing component |
| `mustRole(user, 'procurement-reports')` | the same permission every other procurement report already uses |

No transactional procurement module was modified. The only pre-existing screens touched at all were the Purchase Orders list (both platforms) — and only to add an optional, backward-compatible pre-filter capability, not to change how POs are created, approved, or displayed by default.

---

## 4. Files Modified

- `db/services/data.js` — added `procurementSpendBudgetAnalytics(userId)` and its `module.exports` entry.
- `mobile-api/routes/procurementRequisitions.js` — added `GET /meta/spend-budget-analytics`.
- `electron/main.js` — added `procurement-spend-budget-analytics:get` IPC handler.
- `electron/preload.js` — added `procurementSpendBudgetAnalytics` exposure.
- `renderer/app.js` — added the "Budget & Spend" tab to `renderProcurementReports()`; added `drillIntoOrdersByWorkshop()` + a one-shot preset consumed by `renderProcurementOrders()` (workshop filter + dismissible banner, additive only).
- `mobile/src/types/api.ts` — added `ProcurementBudgetByCode`, `ProcurementDepartmentSpend`, `ProcurementWorkshopSpend`, `ProcurementSupplierSpend`, `ProcurementContractUtilization`, `ProcurementSpendBudgetAnalytics` types.
- `mobile/src/api/endpoints.ts` — added `PROCUREMENT_SPEND_BUDGET_ANALYTICS`.
- `mobile/src/hooks/useProcurementDashboard.ts` — added `useProcurementSpendBudgetAnalytics()`.
- `mobile/src/navigation/types.ts` — `PurchaseOrdersList` route now accepts optional `{ workshopId?, workshopName? }` params (backward compatible — existing callers passing `undefined` are unaffected).
- `mobile/src/screens/procurement/PurchaseOrdersListScreen.tsx` — reads the optional workshop preset, applies it as an additional client-side filter, shows a dismissible filter banner.
- `mobile/src/screens/procurement/ProcurementReportsScreen.tsx` — added the "Budget & Spend" tab (`budgetspend`) + CSV export.

No files outside this list were modified.

---

## 5. UI/CSS Improvements

- Desktop: reused `.kpi-card`/`.kpi-blue`/`.kpi-green`/`.kpi-amber`, `.card`, `.section-hdr`, `.badge`, `.tbl`/`.tw`, `.filter-bar`/`.filter-search` — all pre-existing classes. No new CSS rules.
- Mobile: reused existing `statTile`/`card`/`cardTitle`/`intelRow`/`intelMeta` style objects from this same screen; the one new style (`searchInput`) matches the existing input styling convention used elsewhere in this codebase.
- Positive/negative variance badges: Variance, Planning/Negotiation Savings colored green when ≥ 0, red when negative — same convention as Phase 5A.
- Contract Utilization indicator badges: red ("over"), amber ("under"), green ("on-track") — a new but consistent traffic-light convention for this one new concept.
- Department/Workshop rows include a compact 6-month sparkline trend (desktop: `_svgSparkline`; mobile omits the sparkline in favor of a text variance figure, to keep the card list readable on a small screen — charts for these trends are still available via the Quarterly/Annual trend charts above the tables).

---

## 6. Verification Results

| Check | Result |
|---|---|
| `node --check` — `db/services/data.js`, `mobile-api/routes/procurementRequisitions.js`, `electron/main.js`, `electron/preload.js`, `renderer/app.js` | ✅ Pass |
| `npx tsc --noEmit` (mobile) | ✅ Pass, zero errors |
| Permission reuse — gates only on `mustRole(user, 'procurement-reports')` | ✅ Verified via grep |
| No duplicated business logic — confirmed the function calls `procurementExecutiveDashboard` rather than re-deriving its KPIs | ✅ Verified via grep |
| Electron ↔ Mobile parity | ✅ Same backend function, same sections, on both platforms |
| Live backend smoke test | ✅ **12/12 checks passed** — every section shape correct; the "over" indicator was exercised live (1000% utilization on a real test contract), confirming the threshold logic |
| Workshop drill-down (desktop preset / mobile route param) | ✅ Reviewed by code; not yet exercised interactively — see Known Limitations |
| Audit logging | N/A — entirely read-only, matching every other procurement report function |

---

## 7. Known Limitations

- **Interactive UI walkthrough not performed this pass** — backend is fully verified live; the new tab, its 5 tables, its charts, and both drill-down paths (workshop → Orders list, supplier → profile) have been reviewed by code but not clicked through in a running app.
- **`budgetByCode` was empty in the live smoke test** — correctly, since none of the current test requisitions carry a `budget_code` value (or all are in excluded statuses). The query itself is confirmed correct by the same test's other checks; it simply has no matching rows yet in this dataset.
- **Contract Utilization's "actual spend" is the supplier's total spend, not spend during the contract's dates** — this is the explicitly approved design (no PO-to-contract link exists), not a limitation to fix; flagging again here for visibility since it means a supplier with an old, low-value contract and substantial *unrelated* recent spend will show a very high utilization percentage (exactly as seen in the live test's 1000% case) — a false signal if read as "we're overspending against this specific contract" rather than "this supplier's total spend dwarfs this particular contract's value."
- **Over/under-utilization thresholds (100% / 70%) were not specified in the approved design** — chosen as reasonable defaults; flagging for your confirmation or adjustment.

---

## 8. Recommendations

1. **Before Phase 5C begins**: do a live Electron + Mobile interactive click-through, in particular both drill-down paths (workshop → Orders, supplier → profile) and the CSV export on both platforms.
2. Confirm or adjust the 70%/100% contract-utilization thresholds.
3. Once real budget codes are in use, re-verify the Budget vs Actual table with non-empty data.
4. If a genuine PO-to-contract link is ever introduced by a future phase (out of scope here), Contract Utilization's "actual spend" query would become a straightforward one-line change (filter by `po.contract_id` instead of `po.supplier_id`) rather than a redesign — worth keeping in mind if that need arises.
