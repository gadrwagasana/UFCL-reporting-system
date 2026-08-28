# Procurement Analytics & Forecasting — Phase 5A Audit
## Executive Procurement Dashboard

**Scope of this document:** read-only research. No code was written. This maps every Phase 5A requirement against what already exists in the codebase, and flags the handful of decisions that need your confirmation before implementation begins.

**Explicit non-goals confirmed:** Requisitions, RFQs, Quotations, Purchase Orders, Goods Receipts, Supplier Management, Supplier Governance, Supplier Intelligence, and Supplier Relationship Management are all read from, never modified. No new database tables are required for Phase 5A (confirmed below, table by table).

---

## 1. What already exists (reusable as-is)

### 1.1 Dashboard/report/analytics functions already in `db/services/data.js`

| Function | Gate | Returns |
|---|---|---|
| `procurementDashboard(userId)` | `procurement-dashboard` | requisitions/POs/invoices by status, 7-day receipts, recent activity, 6-month `monthlySpend`, supplier KPI row |
| `procurementAnalytics(userId)` | `procurement-reports` | `avgProcurementCycleDays` (PO created − requisition submitted), late deliveries, top products, supplier rankings |
| `procurementReportSpendAnalysis(userId)` | `procurement-reports` | spend by supplier |
| `procurementReportSupplierPerformance(userId)` | `procurement-reports` | rating/reject-rate by supplier |
| `procurementReportDeliveryPerformance(userId)` | `procurement-reports` | on-time delivery by PO |
| `procurementReportBudgetUtilization(userId)` | `procurement-reports` | requisitions grouped by free-text `budget_code` — **no target/ceiling value**, see §3.2 |
| `supplierIntelligenceDashboard(userId, filters)` | `procurement-reports` | supplier KPIs, top/high-risk performers, contract summary, **`spendDistribution`** (already the "Supplier Spend Distribution" chart data) |
| `srmExecutiveDashboard(userId)` | `procurement-suppliers` | contract/compliance KPIs, **`contractTimeline`** (already the "Contract Expiry Timeline" data) |

These already cover: Active Suppliers, Active Contracts, Purchase Orders, Goods Receipts, Average Procurement Cycle, Monthly Spend Trend (6mo), Supplier Spend Distribution, and Contract Expiry Timeline. **Phase 5A should call into/compose these, not recompute them.**

### 1.2 Chart primitives (both platforms proven, no new dependency needed)

- **Desktop** (`renderer/app.js`): `_svgLine`, `_svgBar`, `_svgDualBar`, `_svgSparkline`, `_svgGauge`, and — already built — **`_svgForecast(hist, fcst, opts)`** (historical line + dashed forecast line), plus `_fmtCur`/`_fmtN`/`_pbar` formatting helpers.
- **Mobile**: `HorizontalExpenseChart`, `SparklineChart` components; `LineChart` from `react-native-gifted-charts` used inline for trend/area charts (proven pattern: `mobile/src/screens/reports/ExecutiveScreen.tsx`'s `TrendCard`, lines 26–62 — area fill, curved, gradient). No dedicated trend-chart wrapper component exists yet; Phase 5A would extract one from that pattern rather than duplicating the inline config across new screens.

### 1.3 Export infrastructure (proven, reuse as-is)

- Desktop: `UFCL.execExport(userId, {csv, filename})` → native save dialog.
- Mobile: build CSV string client-side, `Share.share({message, title})`.

### 1.4 Permissions (no new page-id exists for analytics — see Open Decision 1)

`procurement-reports` is already granted to `admin, ceo, procurement-officer, procurement-manager, finance` — the same functions this phase would extend already gate on it. There is no separate `procurement-analytics` permission today; SRM (Phase 4) deliberately avoided creating one and instead reused `procurement-reports`/`procurement-suppliers`.

### 1.5 NAV / page structure

`renderProcurementDashboard()` (`renderer/app.js:15046–15187`) already has three sections in order: KPI cards → Supplier Intelligence → **Supplier Relationship Management (Phase 4)** → Recent Activity. `renderProcurementReports()` (`renderer/app.js:15189–15399`) already has 7 tabs: Spend, Suppliers, Delivery, Budget, Analytics, Intelligence, SRM.

---

## 2. Requirement-by-requirement mapping

| Phase 5A requirement | Status |
|---|---|
| Total / Month / Quarter / Year Spend | ✅ Derivable from `procurement_purchase_orders.total_amount + tax_amount` grouped by `issue_date` — new query, no new table |
| Active Suppliers | ✅ Already in `procurementDashboard().supplierKpis` |
| Active Contracts | ✅ Already in `srmExecutiveDashboard().kpis` |
| Purchase Orders / Goods Receipts (counts) | ✅ Trivial counts, existing tables |
| Average Procurement Cycle | ✅ Already exists (`procurementAnalytics().avgProcurementCycleDays`) — reuse, don't recompute |
| Average Approval Time | 🟡 New aggregation, existing data — `procurement_approval_steps.approved_at` has never been aggregated into a duration metric before. No schema change needed. |
| Budget Utilization | 🟡 **Needs a definition** — see Open Decision 2 |
| Procurement Savings | 🔴 **No existing concept at all** — see Open Decision 3 |
| Monthly Spend Trend | ✅ `procurementDashboard().monthlySpend` exists but is hardcoded to 6 months — extending the range is trivial |
| Procurement Category Breakdown | 🔴 **No category column exists on POs/requisitions/items** — see Open Decision 4 |
| Supplier Spend Distribution | ✅ Already exists (`supplierIntelligenceDashboard().spendDistribution`) |
| Department Spend | ✅ Derivable — `procurement_requisitions.department` joined through `requisition_id` to POs — new query, existing columns |
| Approval Timeline (chart) | 🟡 Same new-aggregation-on-existing-data situation as Average Approval Time |
| Contract Expiry Timeline | ✅ Already exists (`srmExecutiveDashboard().contractTimeline`) |
| Procurement Cycle Trend | 🟡 New — cycle-time-per-month trend (existing timestamps, grouped by month instead of averaged overall) |

**Bottom line: zero new tables required.** Two requirements (Savings, Category Breakdown) need a decision because the underlying data literally doesn't exist yet in a directly usable form; everything else is a new read-only query over existing columns, or a straight reuse of an existing function's output.

---

## 3. Open decisions

### Decision 1 — Where does this dashboard live?
SRM (Phase 4) deliberately avoided a new NAV entry/permission and instead added a KPI section to the existing Procurement Dashboard page plus a tab on the existing Procurement Reports page. Phase 5A could follow the identical pattern (a new "Executive Analytics" section + a new "Analytics"/"Executive" report tab, both gated on the existing `procurement-reports` permission — zero migration changes), **or** get its own dedicated NAV page (`procurement-analytics`) the way Requisitions/RFQ/Orders/etc. each have their own page (would need one new permission page-id, granted to the same roles that already have `procurement-reports`).

**Recommendation:** reuse the SRM pattern (dashboard section + report tab, no new NAV/permission) for consistency and to honor "no unnecessary" additions — but this is a genuine visual/IA choice worth confirming since 11 KPI cards + 7 charts is a lot to fit into an existing page's section versus a page of its own.

### Decision 2 — What does "Budget Utilization" mean here?
There is no procurement budget ceiling anywhere in the schema. `procurementReportBudgetUtilization` today just groups requisitions by a free-text `budget_code` with no target to compare against — it's really "spend by budget code," not a utilization percentage. The generic `kpi_budgets` table exists but is keyed to `expense_categories` for weekly/monthly company-wide cost tracking, with zero link to procurement — repurposing it would mean guessing a mapping between procurement budget codes and expense categories that doesn't exist today.

Options:
   - **(a)** Treat `procurement_requisitions.total_estimated_amount` (summed per `budget_code`) as the "budget," and actual PO spend against requisitions with that code as "actual" → utilization % = actual/estimated. No schema change; reuses existing free-text `budget_code` grouping already in `procurementReportBudgetUtilization`.
   - **(b)** Leave "Budget Utilization" as a placeholder/deferred KPI until a real procurement budget concept exists (e.g. a future `procurement_budgets` table — out of scope for this "analytics only" phase).

**Recommendation:** (a) — it's fully derivable from existing data with no schema change, and can be clearly labeled "Estimated vs. Actual by Budget Code" rather than implying a governed budget ceiling that doesn't exist.

### Decision 3 — What does "Procurement Savings" mean here?
No existing column, table, or computed value represents "savings" anywhere in the codebase. Two independent, non-schema-changing definitions are derivable from existing data:
   - **(a) Estimate vs. actual**: `requisition.total_estimated_amount` minus the eventual `PO.total_amount + tax_amount` for that requisition. Simple, always available once a requisition reaches PO stage.
   - **(b) Negotiated/RFQ savings**: for RFQs with multiple quotations, the selected quote's amount vs. the average (or highest) of the other quotes received — represents value captured through competitive quoting. Only available for requisitions that went through the RFQ/quotation flow (not every PO does).

**Recommendation:** implement both as separate, clearly-labeled figures (they answer different questions — "did we estimate well" vs. "did competitive bidding save money") rather than merging them into one ambiguous number. Confirm before implementation since this is the one KPI with zero precedent in the codebase to anchor against.

### Decision 4 — "Procurement Category Breakdown" — how to approximate without a real category?
No PO/PO-item/requisition table has a category column — only `procurement_suppliers.category` and `procurement_supplier_contracts.category` exist. Since modifying Purchase Orders/Requisitions schemas is explicitly out of scope for this phase, and adding a new column to an "already complete" module would cross the stated boundary, the only reuse-only option is:
   - Approximate spend-by-category as **spend-by-supplier-category** (join PO → supplier → `procurement_suppliers.category`, sum `total_amount+tax_amount`). This is an approximation — a single supplier's spend is attributed entirely to their one registered category even if they occasionally supply outside it — but requires no schema change and no touching of the frozen modules.

**Recommendation:** proceed with the supplier-category approximation, explicitly labeled "by Supplier Category" (not "by Product Category") in the UI so it's not misread as more precise than it is. Flagging for confirmation since it's a real accuracy tradeoff, not just an implementation detail.

---

## 4. Proposed implementation shape (pending your answers above)

- **Zero new tables.** Confirmed against every requirement in §2.
- **New `data.js` functions** (all read-only, all gated on `procurement-reports` unless Decision 1 says otherwise): one executive-dashboard aggregator (KPI cards + the charts that don't already exist elsewhere) that **calls into** `procurementDashboard`, `procurementAnalytics`, `srmExecutiveDashboard`, and `supplierIntelligenceDashboard` internally for anything already computed there, rather than re-querying — this is the "no duplicated logic" requirement made concrete.
- **New mobile-api routes**: one or two thin GET endpoints under `/api/procurement/analytics` (or reuse the existing `/api/procurement/requisitions/meta/*` mount pattern already used for dashboard/reports/config — see `endpoints.ts` `PROCUREMENT_DASHBOARD` etc.).
- **New Electron IPC + preload channels**: one per new function, following the existing `procurement-*:*` naming convention.
- **UI**: per Decision 1, either a new dashboard section + report tab (SRM pattern) or a new NAV page — charts built exclusively from the primitives in §1.2, no new chart library.
- **Audit logging**: not applicable — every new function is read-only (no `logAudit` calls needed, matching how `procurementDashboard`/`procurementAnalytics`/`srmExecutiveDashboard` etc. are also read-only today).

---

## 5. What I need from you before implementing

1. Dashboard placement — SRM-style (reuse existing page/permission) or a new dedicated `procurement-analytics` NAV page?
2. Budget Utilization — proceed with Option (a) (estimate vs. actual by budget code), or defer this KPI?
3. Procurement Savings — implement both estimate-vs-actual and RFQ-negotiated-savings as separate figures, or just one? If just one, which?
4. Category Breakdown — proceed with the supplier-category approximation (clearly labeled as such), or drop this chart from Phase 5A?

Once confirmed, I'll implement Phase 5A only (per your sequencing instruction), verify (`node --check`, `tsc --noEmit`, Electron, Mobile, permissions, charts, reports, exports, performance, no duplicated logic), and produce the completion report + changelog before stopping for approval to begin Phase 5B.
