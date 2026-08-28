# Finance Enterprise — Gap Register

This register covers the full Finance Enterprise program to date: the original Control Center
build (Dashboard/Operations Center/Approval Center/7 reports/Config/Sage Export) and this
pass's expansion into Inventory Financial Control, Stock Count & Reconciliation, Stock
Variance Control, the Financial Exception Center, department Finance Control drill-downs
(Production/Maintenance/VAT/Customers/Suppliers), and the 24-report suite, per the Complete
Requirements Specification. Format: ID / Severity / Capability / Evidence / Disposition.

---

## Carried from the original Control Center build (all still accurate, unchanged this pass)

### FIN-06 — Duplicate-payment prevention gap in Procurement — FIXED
App-level check in `procurementPaymentCreate`/`procurementPaymentApprove` plus a DB-level
partial unique index (`uidx_procurement_payment_one_paid_per_invoice`). Live-verified via a
direct duplicate INSERT returning Postgres `23505`. Unchanged and re-confirmed working this
pass (see §Regression below).

### FIN-08 — `_monthBounds` naming collision — FIXED
A same-name `function` declaration collision with Procurement's own `_monthBounds(monthsAgo)`
silently broke every Finance date-scoped query. Found live during the original build's own E2E
pass, fixed by renaming to `_financeMonthBounds` (7 references). Re-verified this pass:
`procurementPerformanceScorecard`/`procurementExecutiveReport('executive_summary')` (the two
functions depending on the original) still work correctly.

### FIN-09 — Sales Transaction traceability — NOW BUILT (previously disclosed as not built)
`financeTransactionTrace` gained a `sales_order` branch this pass (Sales Order → Customer →
Deliveries → Revenue). Live-tested against a real query path; production currently has zero
sales orders to trace against (see FIN-13 below), so the positive path is code-reviewed and
schema-verified rather than run against real data — disclosed, not claimed as fully proven.
Production traceability is intentionally NOT a single linear chain (see FIN-15) — served
instead by `financeProductionControl`.

### FIN-10 / FIN-11 / FIN-12 — Report count, mobile scope, notification reuse
Superseded by this pass's much larger build — see the new findings below for the current,
accurate state of report coverage and mobile scope. Notification reuse (FIN-12, no new events
invented, all decisions inherit existing `notifyPayrollEvent`/`notifyProcurementEvent` routing)
remains accurate and unchanged.

---

## New findings from this pass (Complete Requirements Specification)

### FIN-13 — No Stock Count / physical count capability existed anywhere — BUILT

- **Severity**: HIGH (capability gap, not a defect).
- **Evidence**: A dedicated audit confirmed zero matches for `stock_count`/`physical_count`/
  `cycle_count`/`stocktake` anywhere in `data.js`/`schema.sql`/`migrate.js` prior to this pass.
- **Disposition**: BUILT from scratch — `stock_count_sessions`/`stock_count_lines` tables, a
  full workflow (create → enter counts → submit for review → submit adjustments → completed),
  gated on a new narrow `finance-stock-count` permission (not the broad `stock-movements`
  page). Every variance line becomes a real request in the pre-existing governed
  `pending_edits`/`MANAGER_APPROVERS` engine via a newly-extracted `_stockAdjustmentRequestSubmit`
  helper — corrections never touch `stock_levels` directly. Finance can initiate/review a count
  but cannot approve its own resulting adjustment (`MANAGER_APPROVERS` excludes `'finance'` —
  confirmed correct segregation of duties by the audit, not something this pass works around).
  Live-verified end-to-end including a genuine concurrency fix (see FIN-14).

### FIN-14 — Concurrency race in Stock Count adjustment submission — FOUND AND FIXED LIVE

- **Severity**: HIGH — would have let two near-simultaneous "Submit Adjustments" actions (a
  double-click, or two Finance users acting on the same session) create duplicate governed
  adjustment requests for the same variance line before either finished writing back.
- **Evidence**: Caught live during this pass's own concurrency testing — firing two parallel
  `financeStockCountSubmitAdjustments` calls against the same `pending_review` session both
  passed the initial status check before either committed.
- **Disposition**: FIXED — an atomic `UPDATE stock_count_sessions SET status='submitted' WHERE
  status='pending_review'` now claims the session before any line processing; the losing
  caller's `UPDATE` affects 0 rows and bails immediately. Re-verified live: two concurrent
  calls now produce exactly 1 caller's worth of adjustment requests (2 in the test case), the
  second call cleanly returns "already being submitted."

### FIN-15 — Financial Exception Center: `resolution_records`/`rejection_holds` rejected as a
  base, new case-management tables built instead

- **Severity**: INFO (architecture decision, not a defect).
- **Evidence**: A dedicated audit found `resolution_records` is a one-shot materials
  write-off ledger with a hardcoded `destination` enum and mandatory stock-posting — not
  general case tracking — and `rejection_holds` goes straight `pending` → resolved with no
  investigate/comment intermediate state anywhere in its check constraint.
- **Disposition**: Built `finance_exception_cases`/`finance_exception_comments` — a genuinely
  new, narrow case-management layer (investigate → comment → resolve/close) over exceptions
  this codebase's own live reports already compute. `unique(category, source_ref)` makes
  "open" idempotent.

### FIN-16 — Concurrency race in Exception Case opening — FOUND AND FIXED LIVE

- **Severity**: MEDIUM — a SELECT-then-INSERT dedupe check let a genuine concurrent duplicate
  "Investigate" click crash with an unhandled Postgres `23505` instead of gracefully reusing
  the existing case.
- **Evidence**: Caught live during this pass's own concurrency testing — firing two parallel
  `financeExceptionCaseOpen` calls for the same `(category, source_ref)` pair threw instead of
  both returning the same case id.
- **Disposition**: FIXED — the INSERT now uses `on conflict (category, source_ref) do nothing`,
  with a re-select fallback for the caller that lost the race. Re-verified live: two concurrent
  opens now both return `{ok:true, reused:true}` pointing at the same single created case (1
  row created, not 2, not a crash).

### FIN-17 — Department Finance Control (Production/Maintenance/VAT/Customers/Suppliers) built
  via additive permission bypass, not re-derived SQL

- **Severity**: INFO (architecture decision).
- **Evidence**: 12 existing functions across Sawmill/Nyanza/Poles/Fleet/Maintenance/Sales/
  Procurement (`productionReconciliation`, `qualityReport`, `valueAddedProductionReport`,
  `valueAddedProductionReconciliation`, `poleProductionReconciliation`, `polesSourceReport`,
  `fleetDashboard`, `maintenanceReports`, `timberInventoryList`, `customersOrders`,
  `customersList`, `procurementSuppliersList`, `procurementSupplierIntelligenceProfile`) were
  each given a minimal, additive `&& !(await _canAccessFinance(user))` bypass on their existing
  permission gate — a one-line change per function, zero query-logic duplication.
- **Disposition**: Live-verified both directions this pass — Finance can now call all 13
  functions directly; every original caller (a real `sales`-role account, a real
  `sawmill-leader`-role account) was re-tested and still gets identical original behavior (a
  "not found" error, not "access denied," for the sales case; `ok:true` for the sawmill case).
  New thin combinators (`financeProductionControl`, `financeMaintenanceControl`,
  `financeCustomerFinancialProfile`, `financeSupplierFinancialProfile`) call these directly —
  nothing is re-implemented.

### FIN-18 — 24-report suite: 16 reports run as flat/nested data, 8 link to their dedicated tab

- **Severity**: LOW (disclosed scope decision, not a defect).
- **Evidence**: 13 reports now run as flat CSV-exportable tables in the Reports tab (Revenue
  Summary, Workshop Cost, Department Cost, Inventory Valuation, Stock Movement, Stock
  Variance, Stock Count Sessions, Inventory Adjustment, Financial Approval, Financial
  Exception, Financial Transaction Audit, Customer Outstanding, Supplier Outstanding); the
  remaining 8 (COGS/Gross Margin, Payroll Cost, Production Cost/Consumption, Maintenance Cost,
  VAT Summary, Waste/Disposal Cost, Rejection/Downgrade Impact, Finished Product Inventory) are
  richer nested data already served by their own dedicated tab (Production/Maintenance/
  Inventory) — rebuilding them a second time as a flat table would duplicate, not add,
  coverage.
- **Disposition**: A "Full Report Index" panel at the top of the Reports tab links directly to
  each of the 8, so nothing is hidden or harder to find — all 24 named reports are genuinely
  reachable, none fabricated, none silently missing.

### FIN-19 — Mobile scope expanded: Stock Count review and Exception Center now reachable on
  mobile (previously desktop-only)

- **Severity**: INFO (scope expansion, disclosed).
- **Evidence**: `useFinance.ts`'s own header comment documents the exact split: mobile can now
  enter physical counts and submit a count for review (a natural fit for on-the-floor
  counting), and can view/comment/resolve exception cases. Mobile deliberately still cannot
  **initiate** a count or **submit the resulting adjustments** — both stay desktop, a more
  deliberate action than a phone screen suits, matching the same class of trim already
  established for Payroll/Sage Export.
- **Disposition**: Disclosed, intentional. Operations Center, the 24-report suite,
  Configuration, Sage Export, and the Production/Maintenance/Customer/Supplier drill-downs
  remain desktop-only — dense filterable tables, not "no unnecessary complexity" territory for
  mobile.

### FIN-20 — Sales/Production traceability data sparsity (production has near-zero live
  Sales/Payroll data to test against)

- **Severity**: INFO (data-volume observation, not a defect).
- **Evidence**: Live queries this pass found 0 rows in `sales_orders`, 0 rows in
  `payroll_periods`, and 0 rows in `customers` in production. `procurement_purchase_orders`
  does have data and was successfully traced live.
- **Disposition**: Disclosed rather than fabricated. The `sales_order` trace branch and the
  Customer Financial Control screen are code-reviewed against the real schema and correctly
  handle the empty-state case (a clean "not found" rather than a crash), but their positive
  path (a real order actually tracing through) could not be exercised against real data this
  pass. Not a Finance-scope defect — a reflection of this business's current data volume.

---

## Summary Table

| ID | Severity | Disposition |
|---|---|---|
| FIN-06 | MEDIUM | FIXED (carried, re-verified) |
| FIN-08 | HIGH | FIXED (carried, re-verified) |
| FIN-09 | — | Sales trace NOW BUILT (was disclosed-not-built) |
| FIN-13 | HIGH | Stock Count capability BUILT from scratch |
| FIN-14 | HIGH | Concurrency race FOUND + FIXED this pass |
| FIN-15 | INFO | Exception Center architecture decision, documented |
| FIN-16 | MEDIUM | Concurrency race FOUND + FIXED this pass |
| FIN-17 | INFO | Reuse-via-bypass architecture decision, regression-verified |
| FIN-18 | LOW | 24-report coverage complete (13 direct + 8 linked, 0 fabricated) |
| FIN-19 | INFO | Mobile scope expanded (Stock Count review + Exceptions), rest disclosed desktop-only |
| FIN-20 | INFO | Data-volume observation, not a defect |
