# Procurement Analytics & Forecasting — Phase 5B Audit
## Spend & Budget Analytics

**Scope:** read-only research + design review. No code written. Builds directly on Phase 5A's backend/infrastructure inventory (not repeated in full here — see `PROCUREMENT_ANALYTICS_PHASE5A_AUDIT.md`).

---

## 1. What Phase 5A already provides (reusable as-is)

`procurementExecutiveDashboard()` already computes, as a single all-time aggregate: Total/Month/Quarter/Year Spend, Department Spend (top 15), Workshop Spend (top 15), Supplier Spend Distribution (top 10, via `procurementReportSpendAnalysis`), Monthly Spend Trend (12 months), and Estimated Budget Utilization (Estimated vs. Actual vs. Variance, all-time).

Phase 5B's feature list overlaps heavily with this — "Department Spend," "Workshop Spend," "Supplier Spend," "Budget Utilization," "Monthly Spend" all already have a backend query. **Phase 5B is not about re-deriving these numbers — it's about exposing them as full interactive reports** (search/filter/sort/drill-down/export), which today's Phase 5A dashboard cards and charts deliberately don't do (they're glanceable KPIs, not worked tables), plus adding the genuinely new dimensions: quarterly/annual trend series, top-N rankings, variance analysis, and contract spend.

## 2. Reusable UI infrastructure for "Search / Filter / Sort / Drill-down"

- **Sort**: `wireSortableTable(tableEl, state, getRows, onChange)` (`renderer/app.js:13201`) — already proven on the Intelligence report tab (click a `<th data-sort-key>`, toggles asc/desc, re-renders via a caller-supplied `getRows`/`onChange` pair). Reuse directly — no new sorting code.
- **Search/Filter**: every existing list page (Suppliers, Contract Register, Compliance Center) uses the same pattern — an `<input>`/`<select>` wired to a `state` object, a `filtered()` function re-run on every keystroke/change, re-rendering the `<tbody>`. Reuse directly.
- **Drill-down**: the Contract Register / Compliance Center overlays already establish the idiom — a row's action button opens `openSupplierManageOverlay(supplierId, supplierName, tabKey)`, landing the user on a specific tab of the supplier profile. The natural Phase 5B equivalent: clicking a supplier row in a spend/ranking table opens that same supplier-profile overlay (Contracts or Intelligence tab, since spend history isn't its own tab); clicking a department/workshop row doesn't have an equivalent existing destination (no "department profile" or "workshop profile" screen exists anywhere in the app) — see Open Decision 2.
- **CSV Export**: `execExport()` (desktop) / `Share.share()` (mobile), exactly as used in Phase 5A's Analytics tab and every other report tab.

**Conclusion: zero new generic UI infrastructure needed.** Phase 5B is new data (queries) assembled with existing UI primitives.

## 3. What's genuinely new (backend)

| Requirement | Assessment |
|---|---|
| Budget vs Actual | Exists (5A), but only as one all-time total. 5B should show it **per budget code** (reusing `procurementReportBudgetUtilization`'s existing grouping, extended with the actual-spend join 5A already computes) — table, not a single card. |
| Department / Workshop / Supplier Spend | Exists (5A), capped at top 15/15/10 for dashboard-card use. 5B needs the **full, unpaginated, sortable/searchable list** — same queries, remove the `LIMIT`. |
| Contract Spend | 🔴 **No existing linkage** — see Open Decision 1. |
| Monthly / Quarterly / Annual Spend (as trends, not single totals) | Monthly exists (5A, 12 months). Quarterly/Annual as **trend series** (spend per quarter for the last N quarters, per year for the last N years) is new — same date-bucketing pattern, different `date_trunc` granularity. |
| Variance Analysis | Exists at the whole-company level (5A's Budget Utilization variance). 5B implies **per-dimension** variance (e.g., which departments/budget codes are over/under) — new: variance = estimated vs. actual, grouped by budget code (the only dimension with an "estimate" to compare against — departments/suppliers have no estimate of their own, only requisitions do, and requisitions carry a budget code, not a department-level budget). |
| Top Spending Departments / Top Spending Suppliers | Trivial — same queries as above, just explicitly presented as ranked top-N lists (already true of Supplier Spend Distribution; Department Spend needs the same treatment). |
| Budget Utilization | Already covered above (per budget code, not just the single aggregate). |
| Procurement Cost Trends | Same as Monthly/Quarterly/Annual Spend trends above — no separate meaning found beyond "spend over time," so treating it as one thing, not a fourth trend query. |

**Zero new tables.** Every item above is derivable from `procurement_purchase_orders`, `procurement_requisitions`, `procurement_supplier_contracts`, `procurement_suppliers`, and `warehouses` — the same tables Phase 5A already reads.

## 4. Open decisions

### Decision 1 — What is "Contract Spend"?
There is no FK from `procurement_purchase_orders` (or `procurement_requisitions`) to `procurement_supplier_contracts` — a PO is linked to a supplier, and a contract is separately linked to that same supplier, but nothing ties a specific PO to a specific contract. Three ways to define "Contract Spend" without a schema change:
   - **(a) Spend-under-contract vs. spend-without**: sum PO spend for suppliers who currently have at least one `active` contract, vs. suppliers who don't. Answers "how much of our spend is with contracted suppliers."
   - **(b) Per-contract comparison**: for each contract, show its `contract_value` (the committed/planned figure) next to that supplier's actual total PO spend (all of it, not scoped to the contract period) — same shape as Budget Utilization, but at the contract level instead of the budget-code level.
   - **(c) Both (a) and (b)** as two separate small tables/sections.

**Recommendation:** (c) — they answer different questions ("are we buying from contracted suppliers" vs. "is this specific contract's value tracking actual spend") and both are cheap to compute from existing columns. Please confirm or pick one.

### Decision 2 — Drill-down target for Department/Workshop rows
Suppliers have a natural drill-down target (the existing supplier profile overlay). Departments and workshops don't — there's no "department profile" or "workshop profile" screen anywhere in this app. Options:
   - **(a)** No drill-down for department/workshop rows in this phase — sortable/searchable/exportable table only, consistent with every other Phase 5B dimension that lacks a natural detail screen.
   - **(b)** Clicking a department/workshop row opens a filtered list of that department's/workshop's requisitions or POs (would reuse the existing Requisitions/Orders list screens with a filter param, rather than building a new detail page).

**Recommendation:** (b) for workshops (Purchase Orders already have a `workshop_id` column and the existing Orders list page could accept a workshop filter), but (a) for departments (department lives only on `procurement_requisitions`, one join away from POs, and building a full new filter path into two different existing list screens for one drill-down is disproportionate for an analytics-only phase). Please confirm.

### Decision 3 — Where does this live?
Following the same reasoning as Phase 5A (and SRM before it): reuse the existing Procurement Reports page rather than a new NAV entry. Proposed: a new **"Budget & Spend"** tab (distinct from 5A's "Analytics" tab, which is dashboard/chart-style) containing the interactive tables described above, still gated on `procurement-reports`.

**Recommendation:** proceed as proposed unless you'd rather fold this into the existing "Analytics" tab (would make that tab very long) or the existing "Budget" tab (would need renaming/repurposing, similar to how 5A relabeled the old "Analytics" tab).

## 5. Proposed implementation shape (pending your answers above)

- **Zero new tables.**
- **New `data.js` function(s)**: one aggregator, e.g. `procurementSpendBudgetAnalytics(userId, filters)`, read-only, gated on `procurement-reports`, returning: full (unpaginated) department/workshop/supplier spend lists, budget-code-level variance table, quarterly and annual spend trend series, contract spend per Decision 1's answer. Composes 5A's/existing queries where the shape already matches; new queries only for quarterly/annual trends and contract spend.
- **New mobile-api route**: one GET endpoint, same mount pattern as 5A's.
- **New Electron IPC + preload channel.**
- **UI**: new "Budget & Spend" report tab (desktop + mobile), tables built from `wireSortableTable` + the existing search-input/filter pattern, CSV export via the existing mechanism, drill-down per Decision 2.

## 6. What I need from you before implementing

1. Contract Spend — (a), (b), or (c) (both)?
2. Department/Workshop drill-down — as I recommended (workshop → filtered Orders list, department → no drill-down), or different?
3. Placement — new "Budget & Spend" tab, or fold into an existing tab?

Once confirmed, I'll implement, verify, and produce the completion report + changelog before stopping for approval to begin Phase 5C.
