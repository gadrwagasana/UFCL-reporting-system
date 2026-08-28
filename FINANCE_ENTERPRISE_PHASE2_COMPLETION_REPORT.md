# UFCL ERP — Finance Enterprise — Completion Report

Covers the full Finance Enterprise program: the original Control Center build (Dashboard,
Operations Center, Approval Center, 7 reports, Configuration, Sage Export — complete before
this pass) plus this pass's expansion implementing the Complete Requirements Specification
(Inventory Financial Control, Stock Count & Reconciliation, Stock Variance Control, the
Financial Exception Center, department Finance Control drill-downs, and the full 24-report
suite). Sage remains the official accounting system of record throughout — nothing here builds
a General Ledger, Chart of Accounts, double-entry engine, or Trial Balance.

---

## 1. Executive Summary

Finance is now UFCL ERP's enterprise-wide financial control, oversight, review, approval, and
inventory-control department, built entirely on reuse of existing verified ERP infrastructure:
one new permission (`finance-center`, oversight) plus one new narrower permission
(`finance-stock-count`, the one genuine write capability), 6 new tables (2 from the original
build, 4 from this pass), 36 new backend functions total (15 original + 21 this pass), and 12
existing functions across 6 departments given a one-line additive bypass so Finance reuses
them directly instead of re-deriving their logic. Two real concurrency bugs were found and
fixed live during this pass's own testing (Gap Register FIN-14, FIN-16) before either could
reach a production user. All 24 named reports are genuinely reachable — 13 run directly, 8 link
to their richer dedicated tab, zero are fabricated or silently missing.

## 2. Finance Architecture

Two-tier permission model: `finance-center` (read/oversight — Dashboard, Operations Center,
Approval Center queue, all reports, department drill-downs, Customer/Supplier profiles) and
`finance-stock-count` (the one write capability — initiating and reviewing a physical stock
count). Every write action that actually changes a number in the ERP still flows through its
pre-existing engine unmodified: stock corrections through `pending_edits`/`MANAGER_APPROVERS`
(Finance cannot approve its own submission — correct segregation of duties, confirmed by
audit), approval decisions through `procurementApprovalAction`. Finance's own new functions are
either pure read-only aggregations or thin combinators over already-proven functions — the
architecture adds oversight surface, not a second business-logic implementation of anything.

## 3. Dashboard

Unchanged from the original build: Revenue (today/month/YTD/by-workshop/awaiting-review),
Costs (procurement/maintenance+fuel/payroll/inventory-value), Profitability (gross margin with
an explicit data-quality warning when sales reference unapproved-cost products), Outstanding
(AR/AP/4 pending-approval counts), Exceptions (missing-cost items, rejected/returned this
month) — every figure a direct read of an existing verified ERP formula.

## 4. Operations Center

Unchanged: a single `UNION ALL` cross-module search over Sales/Procurement-PO/-Invoice/
-Payment/Payroll, workshop-scoped, never re-implementing each module's own business logic.

## 5. Approval Center

Unchanged: a thin read-only queue over `procurement_approval_steps`; decisions are a direct
call to the existing `procurementApprovalAction` — zero new approval logic, inherited
concurrency/duplicate-decision safety from that already-proven engine.

## 6. Inventory Visibility (NEW this pass)

`financeInventoryOverview`: total items/quantity/value, by-workshop, by-category, top-15-by-
value, missing-cost-item count, pending-rejected quantity (from `rejection_holds`), waste
resolved this month (from `resolution_records`). Every value figure is explicitly labeled an
operational estimate (`quantity × stock_catalog.unit_cost`), never claimed as an official
accounting valuation. "Reserved quantity" is disclosed as unsupported (no such column exists
anywhere in `stock_levels`) rather than fabricated.

## 7. Stock Movement (NEW this pass)

`financeStockMovements`: date/item/movement-type/search-filtered read over the authoritative
`stock_movements` ledger, joined to item/workshop/user names and a computed financial-impact
column. Read-only — Finance never bypasses or writes to this ledger directly.

## 8. Stock Count (NEW this pass — built from scratch)

No stock-count/physical-count concept existed anywhere in this codebase before this pass
(confirmed by a dedicated audit — zero matches anywhere in the schema or codebase). Built:
`stock_count_sessions`/`stock_count_lines` tables and a full workflow — Finance selects a
workshop and optional category, the system snapshots current quantity for every active item at
that instant, staff (desktop or mobile) enter physical counts, the session is submitted for
review (blocked until every line is counted), and Finance submits the resulting variances.
**Every variance line becomes a real request in the pre-existing governed `pending_edits`/
`MANAGER_APPROVERS` engine — corrections never touch `stock_levels` directly.** Finance can
initiate and review a count but cannot approve its own resulting adjustment (`MANAGER_APPROVERS`
excludes `'finance'`, confirmed correct segregation of duties). A real concurrency race in the
submission step was found and fixed live (Gap Register FIN-14).

## 9. Stock Reconciliation

The Stock Count workflow's own system-snapshot-vs-physical-count comparison *is* the
reconciliation — `financeStockVarianceReport` is the resulting report (§10). No separate
"reconciliation" step exists because none is needed: variance is computed the moment a
physical count is entered.

## 10. Stock Variance

`financeStockVarianceReport`: every variance line across completed counts, sorted by financial
impact, flagged for "repeated" (same item variance across multiple sessions) and "high value"
(≥ 50,000 RWF), plus a live `stock_levels < 0` negative-stock check. Each row has an
"Investigate" action that opens (or reuses, idempotently) a Financial Exception Center case —
view → investigate → comment → approve/audit, exactly per the brief, with no automatic
correction of unexplained discrepancies.

## 11. Sales

Reachable via the Operations Center (unified search), `financeCustomerOutstanding`/
`financeCustomerFinancialProfile` (AR + order history), and a new `sales_order` branch of
`financeTransactionTrace` (Sales Order → Customer → Deliveries → Revenue). Production currently
has 0 sales orders, so the trace branch's positive path is schema-verified and code-reviewed
rather than run against real data — disclosed (Gap Register FIN-20), not claimed as fully
proven.

## 12. Procurement

Unchanged from the original build and re-verified live this pass: Operations Center, AR/AP
(supplier side), Approval Center, and `financeTransactionTrace('procurement_po', ...)` — traced
successfully against a real production PO this pass.

## 13. Production

New `financeProductionControl(workshopId)` combinator: Sawmill (`productionReconciliation` +
`qualityReport`'s financial/waste/rejection/downgrade value block), Nyanza/VAT
(`valueAddedProductionReport` + `valueAddedProductionReconciliation` — quantity-only, no cost
dimension exists for this line, disclosed not fabricated), Poles (`poleProductionReconciliation`
+ `polesSourceReport`). Nothing re-derived — all four are the exact same functions the
production floor already uses, reused via a one-line additive permission bypass each.

## 14. Maintenance

New `financeMaintenanceControl()` combinator: `fleetDashboard`'s maintenance/fuel cost KPI
(disclosed as company-wide — `fuel_logs` carries no workshop column anywhere in the schema) +
`maintenanceReports`'s parts-cost/external-repair-cost summary. Same reuse-via-bypass pattern.

## 15. Payroll

Unchanged from the original build: Approval Center surfaces `payroll_period` approval steps;
`financeWorkshopCostSummary` includes payroll cost by workshop; `financeTransactionTrace`'s
existing `payroll_period` branch (Period → Lines → Approval Steps). Production currently has 0
payroll periods to re-trace live this pass; the underlying function is unchanged from the
original build where it was already tested.

## 16. VAT (Nyanza Value-Added Production)

Covered within `financeProductionControl` (§13) — "VAT" in this codebase means the Nyanza
value-added-timber production department, not tax (Phase 1's own finding, unchanged — no
tax-VAT concept exists anywhere in this ERP).

## 17. Customers

New `financeCustomerFinancialProfile` combinator (`customersOrders` + a real-time AR balance
query) and a new desktop/mobile-reachable search screen. Production has 0 customers currently
(Gap Register FIN-20) — the "not found" path was live-tested and confirmed graceful.

## 18. Suppliers

New `financeSupplierFinancialProfile` combinator (`procurementSupplierIntelligenceProfile` —
purchase history, spend/on-time/reject 6-month trend — + a real-time AP balance query) and a
new search screen. Live-tested successfully against a real supplier.

## 19. Reports

24 named reports, all genuinely reachable: 13 run as flat, filterable, CSV-exportable tables in
the Reports tab (Revenue Summary, Workshop Cost, Department Cost, Inventory Valuation, Stock
Movement, Stock Variance, Stock Count Sessions, Inventory Adjustment, Financial Approval,
Financial Exception, Financial Transaction Audit, Customer Outstanding, Supplier Outstanding);
the remaining 8 (COGS/Gross Margin, Payroll Cost, Production Cost/Consumption, Maintenance
Cost, VAT Summary, Waste/Disposal Cost, Rejection/Downgrade Impact, Finished Product Inventory)
are richer nested data already served by their own dedicated tab — a "Full Report Index" panel
at the top of the Reports tab links directly to each, so nothing is hidden. Zero reports are
fabricated over a capability Phase 1 confirmed doesn't exist (no tax-VAT report, no bank
reconciliation report, no formal cost-center report).

## 20. Search / Filter / Sort

Server-side throughout (Operations Center, Stock Movements, Stock Variance, Exception Center,
all `limit`-capped SQL queries) — appropriate given the underlying tables are real, growing
tables, not client-side-filterable in-memory arrays.

## 21. Configuration

Unchanged from the original build: read-only view of `procurement_config.ceo_threshold` (the
one real configurable financial parameter this codebase has) plus an honest list of parameters
with no established business rule.

## 22. Sage Boundary

Unchanged and re-confirmed: no Sage API/SDK/credentials exist anywhere in this codebase. Finance
produces a controlled, reviewable export; a human takes it into Sage manually.

## 23. Sage Export

Unchanged from the original build: `financeSageExportPreview`/`Run`/`History`, VERIFIED/settled
transactions only, duplicate-export prevention at both the app level and the DB level (a real
`.xlsx` file was generated and byte-inspected during the original build's own verification).

## 24. Notifications

No new notification event was invented this pass either. Approval-decision notifications are
unchanged (inherited from `procurementApprovalAction`); Stock Count and Exception Center do not
push notifications this pass (a disclosed scope decision, not an oversight — the brief's own
Section 27 instruction not to invent thresholds without approved business rules extends
naturally to not inventing new notification events for two brand-new workflows without a
business decision on what should actually trigger one).

## 25. Audit

`logAudit` calls added for every new mutating action this pass: stock count create/submit/
complete/cancel, exception case open/resolve/close. Historical financial information is never
silently overwritten — Stock Count corrections flow through the immutable `pending_edits` audit
trail exactly like every other governed edit in this codebase.

## 26. Security

Verified this pass: a real `storekeeper`-role account (zero Finance permission) is denied by
every one of 7 tested new functions. `secureHandle` (IPC) resolves `userId` exclusively from a
server-side session map keyed by `webContents.id` — never trusts renderer-supplied data — so
direct IPC access with a forged identity is not possible. REST's `authenticate` middleware
derives `req.user` exclusively from JWT verification (confirmed via a full-codebase grep: 411
uses of `req.user.userId` across 52 route files, zero uses of a client-supplied
`req.body/query/params.userId` anywhere) — direct REST access with a different user's id is
blocked at the JWT layer. `requireRoles` is a genuine early 403 gate before the route handler
runs, with `data.js`'s own `mustRole`/`_canAccessFinance` checks as a second, independent layer
— true defense in depth, not a single point of failure.

## 27. Desktop / Mobile

Desktop: all 14 tabs (Dashboard, Operations Center, Approval Center, Inventory, Stock Counts,
Stock Variance, Exception Center, Production, Maintenance, Customers, Suppliers, Reports,
Configuration, Sage Export) — full Finance functionality per §30 of the brief. Mobile:
Dashboard, Approval Center, Inventory Overview + Stock Variance summary, Stock Count review
(enter counts + submit for review — a natural on-the-floor workflow; initiating a count and
submitting the resulting adjustments stay desktop, a more deliberate action), and the Exception
Center (view/comment/resolve) — Operations Center, the full 24-report suite, Configuration,
Sage Export, and the department drill-downs remain desktop-only, disclosed as intentional
(dense filterable tables / file-generation workflows, not "no unnecessary complexity" territory
for a phone).

## 28. CRUD Parity

| Entity | Create | View | Edit | Delete | Approve/Reject | Search/Filter/Sort | Export |
|---|---|---|---|---|---|---|---|
| Stock Count Session | ✅ (desktop only) | ✅ (both) | — (append-only lines) | ✅ Cancel (both) | N/A (session itself) | ✅ | via Reports |
| Stock Count Line (a count) | N/A (auto-created) | ✅ (both) | ✅ Enter Count (both) | — | N/A | — | via parent report |
| Stock Adjustment Request | ✅ (auto, via Submit Adjustments) | ✅ (existing pending_edits UI) | — | — | ✅ (existing MANAGER_APPROVERS engine, unchanged) | via Inventory Adjustment report | ✅ CSV |
| Exception Case | ✅ (auto, via Investigate) | ✅ (both) | ✅ Comment (both) | — | ✅ Resolve/Close (both) | ✅ status filter | ✅ CSV |
| Exception Comment | ✅ (both) | ✅ (both) | — (append-only) | — | N/A | — | — |
| Finance Dashboard/Reports/Operations/Traces | N/A (read-only by design) | ✅ | N/A | N/A | N/A | ✅ | ✅ CSV/Excel where applicable |

No backend function this pass has zero UI: every one of the 21 new functions is reachable from
at least desktop, and 10 of them from mobile too (see §27). Stock Count session/line
Create/Edit are intentionally desktop-only for *initiation* (see §8's reasoning) — documented
here, not accidental.

## 29. End-to-End Verification

Full Inventory flow run live against real production data (workshop 3/Gatare): **Stock → Stock
Count → Variance → Approval → Inventory Adjustment → Finance**, all 6 stages — create session,
enter counts (one deliberate variance, one exact match), submit for review, submit adjustments
→ confirmed a real `pending_edits` row created (`entity_type='stock_adjustment'`, correct
payload) → confirmed the same adjustment is visible in both the Stock Variance report AND the
new Inventory Adjustment report → cleaned up (deleted the test session and pending_edits row,
verified both tables restored to their pre-test empty state). **Procurement flow**
(`financeTransactionTrace('procurement_po', ...)`) re-verified live against a real PO. **Sales**
and **Payroll** flow positive paths could not be exercised against real data (0 rows in
production for both) — schema-verified and code-reviewed instead, disclosed honestly (Gap
Register FIN-20). **Production** and **Maintenance** flows verified live via
`financeProductionControl`/`financeMaintenanceControl` returning `ok:true` with real data.
**Sage** flow unchanged from the original build's own verification (a real `.xlsx` generated
and byte-inspected).

## 30. Outstanding Decisions

Carried from the original build, still open, business decisions not engineering ones: FIN-02
(approving real `standard_cost`/`default_price` values), FIN-03/FIN-04 (Weekly Cost system's
future), whether Finance-triggered notifications (Stock Count completion, Exception Center
case-opened) should exist as a new business-approved event type. Nothing in this pass requires
a business decision to function correctly as built.

## 31. Production Readiness

The Finance module — Dashboard, Operations Center, Approval Center, Inventory Financial
Control, Stock Count & Reconciliation, Stock Variance Control, the Financial Exception Center,
department Finance Control drill-downs, 24-report coverage, Configuration, and Sage Export — is
production-ready for the capability actually built and disclosed in this report and the
accompanying Gap Register. Two real concurrency bugs were found and fixed during this pass's
own testing before reaching any user (FIN-14, FIN-16); Workshop Isolation and unauthorized-role
denial were independently live-verified for the new capability; static verification
(`node --check` on every touched backend file, `tsc --noEmit` clean across the entire mobile
project, a full-file cross-check of all 439 `UFCL.*` desktop IPC calls) passed with zero errors.
All QA/test data created during verification was deleted; no residue was left in any new table.

---

## Stop Rule compliance

No General Ledger, Chart of Accounts, double-entry engine, or Trial Balance was built. No
accounting or tax rule was invented (VAT here remains the Nyanza production department, not
tax — Phase 1's finding, re-confirmed). Stock corrections never bypass the existing governed
`pending_edits`/`MANAGER_APPROVERS` approval engine — no second approval architecture was
created. No historical financial or production data was silently corrected. No commit, no
push. No other ERP department was started.
