# Supplier Intelligence — Phase 3C Audit

**This is an audit only — no code was written to produce this document.** Every claim below is grounded in a specific file and line number in the codebase at `c:\Users\hp\OneDrive\Desktop\UFCL 12`, verified directly. Where something does not exist, that is stated explicitly rather than omitted, matching the standard set by `SUPPLIER_VENDOR_PHASE3_AUDIT.md`.

**Headline finding**: aside from the static, never-written `rating` column and the lifecycle work done in Phase 3B (status/blacklist/governance), there is **no scoring, risk, compliance, trend, or comparison machinery anywhere in this codebase** touching suppliers. Phase 3C is net-new computation and net-new UI, not an extension of a partial implementation. The good news is that every raw ingredient the scoring/analytics engine needs (POs, receipts, rejects, invoices, contracts, delivery dates) already exists in the schema and is already queried in fragments across 5 different report functions — the work is consolidation and computation, not new data collection.

---

## 1. Existing Supplier Data

`procurement_suppliers` — 18 columns total (`db/migrate.js`), across two rounds of additions:

**Original set** (lines 1128–1148): `id, name, category, tax_number, bank_name, bank_account, phone, email, address, rating, preferred, blacklisted, blacklist_reason, notes, active, created_by, created_at`.

**Phase 3B lifecycle additions** (lines 1158–1161): `status` (text, default `'active'`, the authoritative field — draft/pending_approval/active/suspended/blacklisted/archived), `status_reason`, `status_changed_by`, `status_changed_at`. `active`/`blacklisted`/`blacklist_reason` are kept as synced mirrors by `procurementSupplierSetStatus`.

Related tables: `procurement_supplier_contacts` (FK cascade), `procurement_supplier_contracts` (FK cascade, has `contract_ref, start_date, end_date, terms, status`).

**`rating numeric(3,2)` is confirmed dead** — read in exactly 2 places (`procurementQuotationsCompare` line ~11592, `procurementReportSupplierPerformance` line 12037), written nowhere. No UI on either platform has a rating input. Any supplier score this phase builds must be **computed**, not sourced from this column.

---

## 2. Existing Reports

Five report functions in `db/services/data.js`, all gated on `mustRole(user, 'procurement-reports')`, all reachable via `GET /api/procurement/requisitions/meta/reports/*`:

| Function | Lines | Computes | Supplier-scoped? |
|---|---|---|---|
| `procurementReportSpendAnalysis` | 12020–12031 | PO count + total spend per supplier, top 50 | Yes (name only, no id) |
| `procurementReportSupplierPerformance` | 12033–12048 | Static rating/preferred/blacklisted + raw PO/received/rejected totals, all suppliers | Yes |
| `procurementReportDeliveryPerformance` | 12050–12065 | Row-level on-time/late boolean, last 100 POs with an expected date | Per-PO, not aggregated per supplier |
| `procurementReportBudgetUtilization` | 12067–12076 | Requisition count/spend per budget code | **No** — no supplier linkage at all |
| `procurementAnalytics` | 12078–12109 | Avg cycle days, late-delivery count, top 10 products, top 10 suppliers by spend | Partially (rankings by spend only) |

None of these compute a percentage/rate beyond the single-supplier `procurementSupplierPerformance`'s reject-rate (see §7). None join invoices to suppliers for accuracy/variance. None compute delivery *duration* (only a same/late boolean). None produce a trend over time (monthly/quarterly buckets) for any supplier metric.

---

## 3. Existing Statistics

Only one function computes anything genuinely *per-supplier* beyond a raw pass-through: `procurementSupplierPerformance` (`data.js:11239–11258`) — `totalPos`, `totalReceipts`, `rejectRatePct`. That's the entire current statistics surface for a single supplier. No spend total, no delivery timing, no invoice/payment stats, no trend, in that function.

---

## 4. Existing Dashboard Data

`procurementDashboard` (`data.js:11979–12018`) returns, alongside the pre-existing requisition/PO/invoice/receipt counts, a `supplierKpis` object added in Phase 3B (lines 11995–12005): `active, preferred, suspended, blacklisted, new_this_month, contracts_expiring_soon` — all lifecycle/status **counts**, no spend, no score, no risk. Both desktop (`renderProcurementDashboard`, `app.js:14441–14491`) and mobile (`ProcurementDashboardScreen.tsx`, 124 lines) already render these 6 as KPI tiles in a "Supplier Overview" section — this is the exact section Phase 3C's KPI cards would extend or sit alongside.

---

## 5. Existing Procurement History

Fully linked, supplier-scoped history exists and is queryable today, just never aggregated into a single "supplier history" view:
- **Purchase Orders**: `procurement_purchase_orders.supplier_id` — direct FK.
- **RFQ invitations**: `procurement_rfq_suppliers.supplier_id` — direct FK.
- **Quotations**: `procurement_quotations.supplier_id` — direct FK.
- **Goods Receipts**: `procurement_goods_receipts` has no `supplier_id` — reached only via `po_id → procurement_purchase_orders.supplier_id` (confirmed pattern already used in Phase 3B's delete-guard query).
- **Invoices**: `procurement_invoices.supplier_id` — direct FK (also `po_id`).
- **Payments**: `procurement_payments` → `invoice_id` → `procurement_invoices.supplier_id` (two hops).
- **Contracts**: `procurement_supplier_contracts.supplier_id` — direct FK.

Every one of these is already exercised individually by existing functions (Phase 3B's delete guard touches all six categories in one query — a directly reusable pattern for a "purchase history" aggregate).

---

## 6. Existing Supplier KPIs

The 6 lifecycle KPIs from Phase 3B (§4 above) are the entire current KPI surface. Phase 3C's requested 8 executive KPI cards (Total Suppliers, Active, Preferred, Blacklisted, High Risk, Contracts Expiring, Total Procurement Spend, Average Supplier Score) overlap 4-of-8 with what already exists (Active, Preferred, Blacklisted, Contracts Expiring) and need 4 new ones (Total Suppliers — trivial `count(*)`, Total Procurement Spend — trivial `sum` already computed in `procurementReportSpendAnalysis`/`procurementAnalytics`, High Risk — **new**, requires the scoring engine, Average Supplier Score — **new**, requires the scoring engine).

---

## 7. Existing Performance Calculations

Exhaustive list of every computed (not raw-column) supplier metric that exists anywhere in the codebase today:

| Metric | Where | Formula |
|---|---|---|
| Reject rate % | `procurementSupplierPerformance`, `data.js:11256` | `rejected / (received + rejected) * 100`, rounded to 2dp |
| On-time/late (boolean, per-PO) | `procurementReportDeliveryPerformance`, `data.js:12057` | `first_received_at::date <= expected_delivery_date` |
| Avg procurement cycle days (fleet-wide, not per-supplier) | `procurementAnalytics`, `data.js:12084` | `avg(po.created_at − requisition.submitted_at)` in days |

That is the complete list. **Not found anywhere**: average delivery time (a duration, not a boolean), late-delivery *count/rate per supplier* (only a fleet-wide count exists), invoice accuracy/variance, contract compliance, RFQ/quotation response time, "last purchase date," and any composite/weighted score. All of these are genuinely new calculations for Phase 3C.

---

## 8. Existing Contracts

`procurement_supplier_contracts` — full CRUD exists on both platforms since Phase 3A (List/Create/Update; no Delete anywhere by design, confirmed still true). Fields: `contract_ref, start_date, end_date, terms, status` (free text, no enum). The only aggregate ever computed over this table is the Phase 3B dashboard's `contracts_expiring_soon` (end_date within 30 days). No contract-compliance metric (e.g., "delivered within contract terms") exists — `terms` is unstructured free text, so any "Contract Compliance" score in §C of the objective will need to be defined loosely (e.g., presence of an active, non-expired contract) rather than computed against structured terms, since no structured terms data exists to compute against.

---

## 9. Existing Purchase History

Per-supplier purchase history (a chronological list of POs/invoices/receipts for one supplier) **does not exist as a UI or backend function anywhere**. `openSupplierManageOverlay` (desktop) and `SupplierDetailScreen.tsx` (mobile) both show only the 3-number performance summary (POs/Receipts/Reject Rate) — no list of the actual POs, no dates, no line items, no "last purchase date." This is a genuinely missing capability, not a UI-only gap — no backend function returns a supplier's PO/invoice list today (`procurementPoList`/`procurementInvoiceList` both exist but are not supplier-filterable — confirmed no `supplierId` filter param in either route's query handling based on the route tables in the companion research).

---

## 10. Existing Charts

**Desktop** (`renderer/app.js`): 6 reusable, self-contained SVG-string chart helpers already exist — `_svgLine` (3911, filled line/area), `_svgBar` (3929, simple bar), `_svgDualBar` (3943, grouped/paired bar), `_svgSparkline` (4369, minimal polyline), `_svgGauge` (4385, 0–100 semi-circular score gauge with color bands and status text — **directly usable for the supplier score**), `_svgForecast` (4404, historical+dashed-forecast dual line). All are used today only on the Executive Analytics and Business Intelligence pages — **zero chart calls exist anywhere in the Procurement module currently** (confirmed: no `_svg` occurrences inside `renderProcurementDashboard`, `renderProcurementReports`, `renderProcurementSuppliers`, or `openSupplierManageOverlay`). Every current Procurement visual is a KPI-card number or a plain `.tbl`/`.dt` table.

**Mobile** (`mobile/src/components/`): `BarChart.tsx` exports `StackedProductionChart` and `HorizontalExpenseChart` (wrapping the installed `react-native-gifted-charts` dependency, package.json confirms `^1.4.77`); `HorizontalExpenseChart` is **already wired** into `ProcurementReportsScreen.tsx`'s Spend tab, fed directly from `procurementReportSpendAnalysis`. `SparklineChart.tsx` is a raw `react-native-svg` polyline component, used today only on the BI screen. No gauge component and no supplier-scoped chart exists on mobile yet, but the wiring pattern (`HorizontalExpenseChart` fed straight from a report's `.rows`) is a proven, reusable template.

---

## 11. Existing APIs

Complete current procurement/supplier/report API surface (all routes already exist and are already the same functions Electron's IPC layer calls — confirmed no drift):

- **`procurementSuppliers.js`**: 14 routes — full supplier/contact/contract CRUD + blacklist + status + performance (`GET /:id/performance`).
- **`procurementRequisitions.js`**: hosts all dashboard/report/analytics/config endpoints (`/meta/dashboard`, `/meta/reports/spend-analysis`, `/meta/reports/supplier-performance`, `/meta/reports/delivery-performance`, `/meta/reports/budget-utilization`, `/meta/analytics`, `/meta/config`) plus requisition CRUD.
- **`procurementRfq.js`**: includes `GET /:id/compare` → `procurementQuotationsCompare` — **an existing "compare" endpoint that is entirely unrelated to supplier intelligence** (it compares quotations within one RFQ, not suppliers against each other) and is confirmed **unused by the mobile UI** (the hook `useProcurementQuotationsCompare` is exported but never imported by any screen — dead code, flagged for awareness, not part of this phase's scope to fix).
- **`procurementOrders.js`**, **`procurementInvoices.js`**: PO/receipt/invoice/payment CRUD, no supplier-filtering param on any list route.

No API for: supplier score, supplier comparison, supplier purchase-history timeline, or any trend-over-time endpoint. All new.

---

## 12. Existing Mobile Screens

18 screens under `mobile/src/screens/procurement/`, 2,896 lines total, 19-entry `ProcurementStackParamList` (`navigation/types.ts:396–416`) matching a matching 18-screen `ProcurementStack.tsx`. Relevant to this phase:
- `ProcurementDashboardScreen.tsx` (124 lines) — has the 6-tile Supplier Overview KPI section (§4/§6).
- `ProcurementReportsScreen.tsx` (178 lines) — 5 local tabs (spend/suppliers/delivery/budget/analytics), one chart (`HorizontalExpenseChart`, Spend tab only), everything else plain label/value rows or ranked lists.
- `SupplierDetailScreen.tsx` (539 lines, by far the largest procurement screen) — full governance/contacts/contracts CRUD from Phases 3A/3B, plus a 3-tile performance row. No purchase-history list, no score, no trend chart, no risk indicator.
- No supplier-comparison screen exists; no route for one exists in the param list.

---

## 13. Existing Electron Screens

9 Procurement nav pages (`app.js:189–197`): Dashboard, Suppliers, Requisitions, RFQ/Quotations, Purchase Orders, Goods Receipt, Invoices & Payments, Reports, Settings. Relevant to this phase:
- `renderProcurementDashboard()` (`app.js:14441–14491`) — matches mobile's KPI structure exactly (same 6 supplier tiles).
- `renderProcurementReports()` (`app.js:14493–14561`) — same 5 tabs as mobile, **zero charts** (mobile's Spend tab has one chart; desktop's equivalent tab does not — a pre-existing, pre-Phase-3C parity gap worth noting).
- `renderProcurementSuppliers()` (`app.js:13618–13860`) + `openSupplierManageOverlay()` (`app.js:13483–13616`) — list + single-supplier modal, same 3-number performance summary as mobile, no history list, no score, no comparison, no multi-select.
- The only "comparison" precedent anywhere in the app is `openRfqDetailOverlay`'s "Quotation Comparison" table (`app.js:13914–13922`) — a plain stacked table of quotations for one RFQ, not a side-by-side supplier comparison. No reusable comparison *layout* pattern (columnar/side-by-side) exists anywhere in the codebase.

---

## Reusable Backend Functions

These can be called as-is (read-only) by new intelligence functions, or their query patterns directly lifted:
- `procurementSupplierPerformance` — reject-rate math, directly reusable as one input to the scoring engine.
- `procurementReportSpendAnalysis` / `procurementAnalytics`'s `supplierRankings` — spend-per-supplier query pattern.
- `procurementReportDeliveryPerformance` — on-time/late boolean pattern; needs extending from row-level to a per-supplier aggregate (avg days late, on-time %).
- The Phase 3B delete-guard's 6-way UNION-style history query (`procurementSupplierDelete`) — the exact pattern for a "purchase history" aggregate across POs/RFQs/quotations/invoices/contracts/receipts.
- Desktop's `_svgGauge`/`_svgBar`/`_svgDualBar`/`_svgSparkline`/`_svgLine`/`_svgForecast` and mobile's `HorizontalExpenseChart`/`SparklineChart` — all directly reusable, zero new charting dependency needed on either platform.
- `procStatusBadge()`/`PROC_STATUS_META` (desktop) and `StatusBadge` (mobile) — both already extensible (proven in Phase 3B) for new risk-tier badges (Excellent/Good/Average/High Risk).

## Missing Calculations

Average delivery time (duration, not boolean), per-supplier late-delivery rate (only fleet-wide count exists), invoice accuracy/variance (PO amount vs. invoice amount vs. received quantity — no such comparison exists anywhere), contract compliance (no structured contract terms to compute against — will need a loosely-defined proxy metric), RFQ/quotation response time (no timestamp-delta calculation exists between invite and quote submission — both `sent_at` and `received_at`/`created_at` columns exist so the raw data is present, just never subtracted), last purchase date (trivial `max(po.issue_date)`, just never selected), the weighted 0–100 composite score itself, and any month-over-month/quarter-over-quarter trend series for spend, score, quality, or delivery.

## Duplicated Logic Risk (to avoid introducing)

`procurementReportSupplierPerformance` (fleet-wide) and `procurementSupplierPerformance` (single-supplier) already compute overlapping-but-inconsistent reject-rate logic (one returns raw totals, the other a computed percentage) — Phase 3C's new performance/score function should **consolidate** these rather than add a third variant. Any new "supplier history" function must reuse the Phase 3B delete-guard's exact 6-table join pattern rather than re-deriving it. Any new chart must call the existing `_svg*`/`HorizontalExpenseChart` helpers, not introduce a new charting approach on either platform (both explicitly requested to "reuse the existing chart library").

## Missing APIs

Supplier score/scorecard endpoint, supplier comparison endpoint (multi-id), supplier purchase-history endpoint, supplier performance-trend endpoint (time-bucketed), and executive-report endpoints for: Top/Worst/Inactive suppliers, Supplier Ranking, Supplier Risk, Preferred Supplier Usage. None exist; all can be new functions in `data.js` reusing the query patterns above, exposed via the existing `procurementSuppliers.js`/`procurementRequisitions.js` route files (new sub-paths, no new route *files* needed) and matching new Electron IPC channels.

## Missing UI

Both platforms: supplier score display (no gauge/badge anywhere), risk badge (no risk concept exists at all), purchase-history list/timeline (no timeline UI exists in Procurement on either platform — desktop's `.bi-timeline` CSS exists but is BI-only and unused by Procurement; mobile has no timeline component at all), performance-trend chart (zero trend charts exist for suppliers on either platform), side-by-side comparison screen (no layout precedent exists anywhere in the app), and the 4 net-new executive KPI cards (Total Suppliers, High Risk, Total Spend, Average Score — Total Suppliers/Total Spend are trivial once the queries exist; High Risk/Average Score depend on the scoring engine).

## Missing CSS

Desktop: no comparison/columnar-layout class, no risk-badge color variants (badge system is easily extensible per Phase 3B precedent — `.br`/`.ba`/`.bg`/`.bn` already cover red/amber/green/neutral, sufficient for Excellent/Good/Average/High Risk without new colors), no timeline component reusable outside BI (`.bi-timeline` is scoped/named for BI; either reuse it generically or add a thin Procurement-scoped alias — a design decision for Step 2, not this audit). Mobile: no gauge component exists at all (would need either a new lightweight SVG gauge matching `SparklineChart.tsx`'s raw-`react-native-svg` pattern, or a `react-native-gifted-charts` gauge variant if one exists in the already-installed library — to be confirmed in Step 2), no comparison-layout styling precedent, no risk-badge colors beyond what `StatusBadge`'s existing `resolveColors()` map already provides (reusable as-is, same reasoning as desktop).

## Missing Navigation

Desktop: no NAV entry for a Supplier Intelligence/Comparison page; would need one new `NAV` array entry + `showPage()` case (or, alternatively, fold intelligence content into the existing Suppliers/Reports/Dashboard pages rather than adding a 10th top-level nav item — a scope decision for Step 2). Mobile: no `ProcurementStackParamList` entry or `Stack.Screen` registration for comparison/score-detail views exists; the natural integration point is extending `SupplierDetailScreen` (already the largest screen, already has room for new cards) plus possibly one new `SupplierComparisonScreen` route reachable from `SuppliersListScreen` (which has no multi-select today — that would be new UI, not just new navigation).

---

## Summary for Step 2 Planning (informational — not a proposal to act on without approval)

The audit surfaces a clean split: **read-only aggregation work** (spend totals, delivery duration, response time, last-purchase-date, purchase-history list — all straightforward SQL over already-linked tables, zero schema changes needed) versus **one genuinely new piece of business logic**, the weighted 0–100 scoring engine, which per the objective's own instruction must live entirely inside `data.js` as a single function every report/comparison/dashboard call site reuses rather than recomputes. No PostgreSQL schema change appears necessary for any of the 7 features (A–G) described in the objective — every input (POs, receipts, rejects, invoices, contracts, dates) already exists as a column today. This matches the phase's own instruction that schema changes are allowed "only if absolutely necessary," and per this audit, none are.
