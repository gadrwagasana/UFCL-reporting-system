# Finance Enterprise — Changelog

This file covers the original Control Center build (below) plus a large expansion pass
implementing the Complete Requirements Specification (Inventory Financial Control, Stock
Count & Reconciliation, Stock Variance Control, the Financial Exception Center, department
Finance Control drill-downs, and the full 24-report suite) — see the new section immediately
below for that expansion; everything under "Original Phase 2 build" further down was already
complete and is unchanged except where explicitly noted.

---

# Expansion Pass — Complete Requirements Specification

## Database (`db/migrate.js`)

- **New**: `createFinanceStockCountTables()` — `stock_count_sessions` (workshop_id, category,
  status check(draft/counting/pending_review/submitted/completed/cancelled), notes,
  initiated_by/at, completed_at) and `stock_count_lines` (session_id, item_id,
  system_qty_snapshot, physical_qty, unit_cost_snapshot, status, notes, counted_by/at,
  adjustment_request_id → pending_edits, unique(session_id, item_id)). `variance` is
  deliberately NOT a stored column — computed at read time as `physical_qty -
  system_qty_snapshot` so an uncounted line reads as NULL, not a false negative-full-quantity
  value.
- **New**: `grantFinanceStockCountPermission()` — grants a new, narrow `'finance-stock-count'`
  page (not the broad `'stock-movements'` page) to admin/ceo/operations/finance.
- **New**: `createFinanceExceptionTables()` — `finance_exception_cases` (category, source_ref,
  title, description, severity check(low/medium/high/critical), financial_impact, workshop_id,
  status check(open/investigating/resolved/closed), created_by/at, assigned_to, resolved_by/at,
  resolution_notes, `unique(category, source_ref)`) and `finance_exception_comments`
  (case_id → cases, user_id, comment, created_at).
- All three called at the end of `migrate()`, after the original Finance Phase 2 calls.
  Live-run confirmed: all 4 new tables exist, `finance-stock-count` granted to 4 roles.

## Backend (`db/services/data.js`)

- **`ROLE_PAGES`** — added `'finance-stock-count'` alongside `'finance-center'` for
  admin/ceo/operations/finance.
- **`_canAccessFinanceStockCount(user)`** — new helper, gates on `'finance-stock-count'` OR
  `FINANCE_ROLES`, distinct from `_canAccessFinance` since Stock Count is a WRITE capability
  (initiates counts, submits governed adjustment requests), not pure oversight.
- **`stockAdjustmentRequestCreate`** refactored (behavior-preserving) to extract
  **`_stockAdjustmentRequestSubmit(user, payload, {module, actionType})`** — the original
  function now does its permission check then delegates; Stock Count's own submission path
  calls the same helper after its own (different) permission check, so the governed
  `pending_edits` insert logic exists in exactly one place.
- **New Inventory Financial Control**: `financeInventoryOverview` (totals/by-workshop/
  by-category/top-15-by-value/missing-cost-count/pending-rejected-qty/waste-resolved-this-month,
  all labeled as an operational estimate, never an accounting valuation) and
  `financeStockMovements` (date/item/type/search-filtered read over `stock_movements`, no
  bypass of the authoritative ledger).
- **New Stock Count & Reconciliation workflow**: `financeStockCountCreate` (snapshots system
  qty for every active item in the selection at session-open time), `financeStockCountList`,
  `financeStockCountDetail`, `financeStockCountEnterCount`, `financeStockCountSubmitForReview`
  (refuses if any line uncounted), `financeStockCountSubmitAdjustments` (every variance line
  becomes a real `_stockAdjustmentRequestSubmit` call; zero-variance lines just marked
  reviewed; **atomically claims the session via `UPDATE...WHERE status='pending_review'`
  before processing — the actual concurrency guard, added after a real race was caught live,
  see Gap Register FIN-14**), `financeStockCountCancel`.
- **New Stock Variance Control**: `financeStockVarianceReport` — variance lines across
  completed counts (large/repeated/high-value flagged, `HIGH_VALUE_THRESHOLD = 50000`) plus a
  live `stock_levels < 0` negative-stock check.
- **New Inventory Adjustment report**: `financeInventoryAdjustmentReport` — read-only history
  of every `entity_type='stock_adjustment'` row in `pending_edits`, covering both Stock
  Movements' own adjustment screen and Stock Count's submissions identically (same table, same
  engine).
- **New Financial Exception Center**: `financeExceptionCaseOpen` (idempotent
  open-or-reuse via `unique(category, source_ref)`; **insert uses `on conflict do nothing` +
  re-select fallback — fixed after a real concurrent-open crash was caught live, see Gap
  Register FIN-16**), `financeExceptionCaseList`, `financeExceptionCaseDetail`,
  `financeExceptionCaseComment`, `financeExceptionCaseResolve`, `financeExceptionCaseClose`.
- **New department Finance Control combinators**: `financeProductionControl` (Sawmill
  reconciliation+quality, Nyanza/VAT report+reconciliation, Poles reconciliation+source, all
  parallelized), `financeMaintenanceControl` (Fleet + Maintenance Oversight),
  `financeCustomerFinancialProfile` (order history + AR balance), `financeSupplierFinancialProfile`
  (purchase history/spend trend + AP balance) — all thin combinators, zero re-derived SQL.
- **Additive permission bypass** (one line each, `&& !(await _canAccessFinance(user))` appended
  to the existing gate, zero query-logic change) on 12 existing functions so Finance can reuse
  them directly instead of a second implementation: `customersOrders`, `customersList`,
  `procurementSuppliersList`, `procurementSupplierIntelligenceProfile`, `timberInventoryList`
  (per-product COGS/margin + inventory value by location), `fleetDashboard`, `maintenanceReports`,
  `productionReconciliation`, `qualityReport` (the financial/waste/rejection/downgrade value
  block), `valueAddedProductionReport`, `valueAddedProductionReconciliation`,
  `poleProductionReconciliation`, `polesSourceReport`. Regression-verified: every original
  caller (a real `sales`-role account, a real `sawmill-leader`-role account) re-tested and
  confirmed to get identical original behavior.
- **`financeTransactionTrace`** — new `sales_order` branch (Sales Order → Customer →
  `delivery_orders` → Revenue), closing the previously-disclosed Sales traceability gap. Honestly
  discloses that `stock_movements` carries no FK to `sales_orders`/`delivery_orders` in this
  schema rather than fabricating a join.
- All 21 new functions added to `module.exports`.

## Desktop (`electron/`, `renderer/`)

- **`electron/main.js`** / **`electron/preload.js`** — 21 new `finance:*` IPC channels + matching
  `UFCL.finance*` bridge functions, same pattern as the original Phase 2 build.
- **`renderer/app.js`** — Finance Control Center expanded from 6 tabs to 14: **Inventory**
  (totals/by-workshop/by-category/top-value/movement-history), **Stock Counts** (list + a
  full create/enter-count/submit-review/submit-adjustments/cancel overlay workflow),
  **Stock Variance** (flagged discrepancies + negative stock, each row has an "Investigate"
  button that opens/reuses a Financial Exception Center case), **Exception Center** (status-
  filtered case list + a detail overlay with comment/resolve/close), **Production** (Sawmill/
  Nyanza-VAT/Poles reconciliation+quality+cost sections), **Maintenance** (Fleet + Maintenance
  Oversight cost tiles), **Customers** and **Suppliers** (search-then-profile-overlay, reusing
  `customersOrders`/`procurementSupplierIntelligenceProfile` via the new bypass). Reports tab
  gained a "Full Report Index" panel (13 direct reports + 8 links to their dedicated tab,
  covering all 24 named reports) and 6 new flat-table report entries (Revenue Summary,
  Inventory Valuation, Stock Movement, Stock Variance, Stock Count Sessions, Inventory
  Adjustment). Every new screen reuses existing components only (`openOverlay`, `filter-chip`
  tabs, `tw`/`dt` tables, `mc`/`cards` tiles, `prependWorkshopBanner`) — zero new CSS/components.
  A full-file cross-check confirmed all 439 `UFCL.*` calls in `app.js` (not just Finance's own)
  resolve to a real `preload.js` export — a side-effect regression check of the entire desktop
  app.

## Mobile (`mobile/`)

- **`mobile/src/api/endpoints.ts`** — 11 new `FINANCE_*` endpoint constants.
- **`mobile/src/types/api.ts`** — `FinanceInventoryOverviewResponse`,
  `FinanceStockVarianceResponse`/`Row`, `FinanceStockCountSession`/`Line`/list/detail responses,
  `FinanceExceptionCase`/`Comment`/list/detail responses — shapes mirror the backend functions'
  own return objects verbatim.
- **`mobile/src/hooks/useFinance.ts`** — 10 new hooks: `useFinanceInventoryOverview`,
  `useFinanceStockVariance`, `useFinanceStockCounts`, `useFinanceStockCountDetail`,
  `useFinanceStockCountActions` (enter count + submit for review only — initiation and
  adjustment submission stay desktop-only, see Gap Register FIN-19),
  `useFinanceExceptions`, `useFinanceExceptionDetail`, `useFinanceExceptionActions`
  (comment + resolve).
- **5 new screens**: `FinanceInventoryScreen` (overview + variance summary),
  `FinanceStockCountsScreen` (session list), `FinanceStockCountDetailScreen` (physical count
  entry + submit for review — a natural on-the-floor mobile workflow),
  `FinanceExceptionsScreen` (status-filtered list), `FinanceExceptionDetailScreen`
  (comments + resolve). All reuse existing components (`AppHeader`, `LoadingState`/
  `ErrorState`/`EmptyState`/`OfflineBanner`, `StatusBadge`) verbatim.
- **`FinanceCenterStack.tsx`** / **`navigation/types.ts`** — 5 new stack screens registered;
  `FinanceDashboardScreen`'s header actions expanded from 1 to 4 quick links.

## Mobile API (`mobile-api/routes/finance.js`)

- 21 new REST routes: `/inventory-overview`, `/stock-movements`, `/stock-variance`,
  `/stock-counts` (POST/GET), `/stock-counts/:id` (GET), `/stock-counts/:id/lines/:lineId`
  (PUT), `/stock-counts/:id/submit-review`, `/stock-counts/:id/submit-adjustments`,
  `/stock-counts/:id/cancel`, `/exceptions` (POST/GET), `/exceptions/:id` (GET),
  `/exceptions/:id/comments`, `/exceptions/:id/resolve`, `/exceptions/:id/close`,
  `/production-control`, `/maintenance-control`, `/customers/:id`, `/suppliers/:id`,
  `/reports/inventory-adjustment` — all pure delegation, `requireRoles(...FINANCE_ROLES)` +
  the same internal `_canAccessFinance`/`_canAccessFinanceStockCount` re-check every other
  Finance route already uses.

## Bugs found and fixed live during this pass's own testing (not carried from the original build)

- **FIN-14 — Stock Count adjustment-submission concurrency race**: two simultaneous "Submit
  Adjustments" calls could both pass the status check and both process the same variance
  lines. Fixed with an atomic `UPDATE...WHERE status='pending_review'` claim. Live-verified:
  exactly one caller's adjustments get submitted, the other is cleanly rejected.
- **FIN-16 — Exception Case open concurrency crash**: two simultaneous "Investigate" clicks on
  the same live-computed exception threw an unhandled Postgres `23505` instead of gracefully
  deduping. Fixed with `on conflict (category, source_ref) do nothing` + a re-select fallback.
  Live-verified: exactly one case created, both callers get the same id back, no crash.

## Live E2E Verification (this pass, disposable QA data, all cleaned up)

- Full Inventory flow run end-to-end against real production data (workshop 3/Gatare, real
  "Waste Byproduct" category items): create stock count → enter physical counts (one
  deliberate variance, one exact match) → submit for review → submit adjustments → confirmed
  the variance line produced a real `pending_edits` row (`entity_type='stock_adjustment'`,
  correct payload/reference) → confirmed the **same** adjustment is visible in both the Stock
  Variance report and the new Inventory Adjustment report → deleted the test session and
  pending_edits row, verified both tables back to their pre-test state.
- Concurrency: both new races (FIN-14, FIN-16) reproduced live, fixed, and re-verified fixed —
  see above.
- Security: a real `storekeeper`-role account (no Finance permission at all) correctly denied
  by all 7 tested new functions. A real active `finance`-role account's `workshop_id`
  snapshotted, temporarily set to a real workshop, used to confirm `financeStockCountCreate`
  correctly refuses a cross-workshop request and `financeInventoryOverview` correctly scopes
  to just the one workshop (not a leak), then restored and verified restored.
- Regression: re-verified `financeTransactionTrace('procurement_po', ...)` still traces a real
  PO correctly; re-verified the 12 additively-bypassed functions' *original* callers (a real
  `sales`-role account, a real `sawmill-leader`-role account) still get their exact original
  behavior, not a new one. A full-file scan confirmed all 439 `UFCL.*` calls across the entire
  `renderer/app.js` (every department, not just Finance) still resolve to a real preload
  export — no desktop regression anywhere in the app from this pass's changes.
- Data-volume disclosure: production currently has 0 rows in `sales_orders`, `payroll_periods`,
  and `customers` — the new Sales trace branch and Customer Financial Control screen are
  schema-correct and handle the empty state cleanly, but their positive path could not be
  exercised against real data this pass (Gap Register FIN-20).

---

# Original Phase 2 build

## Database (`db/migrate.js`)

- **New**: `createFinanceTables()`, called at the end of `migrate()`:
  - `uidx_procurement_payment_one_paid_per_invoice` — partial unique index on
    `procurement_payments(invoice_id) where status='paid'` — the DB-level fix for FIN-06
    (duplicate-payment gap), created first with an explanatory comment distinguishing it from
    the app-level check in `data.js`.
  - `finance_sage_exports` table — `id, source_module, source_record_id, transaction_type,
    exported_by, exported_at, sage_reference, reconciliation_status (check: exported/
    reconciled/disputed), notes`, plus a unique index `uidx_finance_sage_export_source on
    (source_module, source_record_id)` (duplicate-export prevention) and an index on
    `(source_module, exported_at desc)`.
- **New**: `grantFinanceCenterPermission()` — grants the `'finance-center'` page id to
  admin/ceo/operations/finance in `role_definitions`.
- Live-run confirmed: `[migrate] duplicate-payment DB constraint ready`,
  `[migrate] finance tables ready`, `[migrate] finance-center permission granted to 4 role(s)`.

## Backend (`db/services/data.js`)

- **`ROLE_PAGES`** — added `'finance-center'` to admin/ceo/operations/finance arrays (the
  documented fallback, alongside the DB grant above). Additive only — does not touch `finance`
  role's existing narrower page grants (dashboard/weekly-cost/monthly/sage/
  procurement-dashboard/requisitions/invoices/reports).
- **New Finance module** (inserted after Payroll's Excel-export section, before
  `logisticsDashboard`):
  - `FINANCE_ROLES`, `_canAccessFinance` — every finance* function gates on
    `mustRole(user,'finance-center') || FINANCE_ROLES.includes(user.role)`, so a caller does
    not need to separately hold `sales`/`stock-items`/`payroll` page grants to see Finance's
    own read-only aggregate views of that data — a deliberate, reasoned architectural choice
    (Finance oversight ≠ blanket departmental edit access).
  - `financeDashboard` — Revenue (today/month/YTD/by-workshop/awaiting-review), Costs
    (procurement/maintenance+fuel/payroll/inventory-value, Nyanza production units),
    Profitability (gross margin %, with an explicit `dataQualityWarning` when sales reference
    unapproved-cost products), Outstanding (AR/AP/pending counts), Exceptions (missing-cost
    items, rejected/returned this month).
  - `financeCustomerOutstanding` / `financeSupplierOutstanding` — AR/AP summaries derived at
    read time from `sales_orders.payment_status` / `procurement_invoices` minus
    `procurement_payments` — no new balance table, no ledger (Option A, per Phase 1's
    architecture recommendation).
  - `financeOperationsSearch` — a single `UNION ALL` over 5 source modules' own key fields
    (sales/procurement_po/procurement_invoice/procurement_payment/payroll_period), never a
    re-implementation of each module's business logic; workshop-scoped invoice/payment rows are
    omitted entirely (not shown unfiltered) for a workshop-restricted viewer, matching the
    existing "finance-level, unscoped by design" precedent from `procurementApprovalAction`.
  - `financeApprovalQueue` — a thin, read-only queue over `procurement_approval_steps`
    (mirrors `procurementApprovalAction`'s own `assigned_role` check exactly), enriched with a
    human-readable label/amount/workshop per entity type; decisions are NOT re-implemented here
    — the desktop UI calls the existing `procurementApprovalAction` directly via IPC, and a new
    thin REST pass-through route does the same for mobile.
  - `financeWorkshopCostSummary` / `financeDepartmentCostSummary` — company-wide-only reports
    (explicitly denied for a workshop-restricted viewer with a clear error, not silently
    filtered) combining Payroll + Procurement PO spend, the only two cost sources this codebase
    can actually attribute to a workshop/department today.
  - `financeApprovalReport` / `financeExceptionReport` / `financeAuditReport` — read-only
    reports over `procurement_approval_steps` / a fixed set of Phase-1-evidenced exception
    conditions / `audit_log` (scoped to payroll/procurement/finance/sales modules).
  - `financeTransactionTrace` + `financePayrollTrace` — Procurement (PO → Requisition → Goods
    Receipts → Invoices) and Payroll (Period → Lines → Approval Steps) traceability chains; any
    other `sourceType` returns a clear "not built this phase" error rather than a fabricated or
    crashing response (see Gap Register FIN-09).
  - `financeConfigView` — read-only view of the one real configurable financial parameter this
    codebase has (`procurement_config.ceo_threshold`), plus an explicit list of parameters
    Phase 1 confirmed have no established business rule (customer credit limits, VAT/tax rates,
    payroll rate policy) — documented as a decision, never guessed.
  - `FINANCE_SAGE_ELIGIBLE`, `financeSageExportPreview`, `_financeSageEligibleRows`,
    `financeSageExportRun`, `financeSageExportHistory` — controlled export of VERIFIED/settled
    transactions only (closed/closed_with_shortage POs, paid invoices, closed payroll periods)
    into a real `.xlsx` (via the existing `_payrollBuildExcelBuffer`, confirmed generic and
    reused verbatim), tracked in `finance_sage_exports` to prevent re-exporting the same source
    record — enforced at both the app level (a pre-check) and the DB level (the unique index),
    with the DB level as the actual authority under concurrency.
  - `_financeMonthBounds(d)` — Finance's own current-month date-bounds helper. **Originally
    named `_monthBounds`, which silently collided with a pre-existing same-named function
    further down this file (`_monthBounds(monthsAgo)`, used by Procurement's analytics) — found
    live during this phase's own E2E verification (see Gap Register FIN-08) and fixed by
    renaming to `_financeMonthBounds` across all 7 references before Procurement's version was
    ever touched.**
  - All 15 new functions added to `module.exports`.
- **`procurementPaymentCreate`** (FIN-06 fix) — now checks for an existing `pending`/`paid`
  payment against the invoice before inserting a new one, returning a clear error instead of
  silently allowing a duplicate.
- **`procurementPaymentApprove`** (FIN-06 fix) — re-checks for an already-paid payment before
  flipping status, and wraps the update in try/catch for Postgres error code `23505`
  (unique_violation) as the real concurrency-safe guard (the SELECT-based check alone is
  TOCTOU-vulnerable; the DB constraint is the actual enforcement).

## Desktop (`electron/`, `renderer/`)

- **`electron/main.js`** — 15 new `secureHandle('finance:*', ...)` IPC channels
  (`dashboard`, `customerOutstanding`, `supplierOutstanding`, `operationsSearch`,
  `approvalQueue`, `workshopCostSummary`, `departmentCostSummary`, `approvalReport`,
  `exceptionReport`, `auditReport`, `transactionTrace`, `configView`, `sageExportPreview`,
  `sageExportRun` — base64-encodes the generated `.xlsx` buffer, same pattern as Payroll's own
  `payroll:exportExcel` — and `sageExportHistory`). Approval decisions reuse the existing
  `procurementApprovalAction` exposed on `UFCL` directly — no new IPC channel for that action.
- **`electron/preload.js`** — 15 matching bridge functions on `window.UFCL`.
- **`renderer/index.html`** — new `<div class="page" id="page-finance-center"></div>` page
  container.
- **`renderer/app.js`**:
  - New nav entry `{ id: 'finance-center', ... }` under "Reports & Finance" (before Weekly
    Cost Report), new `case 'finance-center': return renderFinanceCenter();` routing branch.
  - New **Finance Control Center** module (~430 lines): a 6-tab page (Dashboard / Operations
    Center / Approval Center / Reports / Configuration / Sage Export) reusing existing
    components throughout — `prependWorkshopBanner`/`fetchWorkshopsForBanner` for cross-
    workshop filtering, `openOverlay`/`showOverlayError`/`showOverlaySuccess` for the
    approve/reject modal and the transaction-trace viewer, `procApprovalStepsHtml` for the
    Payroll trace's approval timeline, `downloadCsv` for report export, the same base64-decode-
    then-Blob-download pattern Payroll Phase 3 established for the Sage Excel export, and the
    `filter-chip` tab convention already used by `renderProcurementReports`. Zero new CSS
    classes, zero new shared components.
  - No checkbox added to the Role Permissions editor for `finance-center` — matches the
    existing precedent that `payroll` itself also has no checkbox there (both are granted via
    the one-time migration grant, consistent with how the newest page permissions in this
    codebase are already handled).

## Mobile (`mobile/`)

- **`mobile/src/api/endpoints.ts`** — `FINANCE_DASHBOARD`, `FINANCE_APPROVALS`,
  `FINANCE_APPROVAL_DECIDE(entityType, entityId)`, with a comment explaining the deliberately
  narrow scope (Dashboard + Approval Center only — see Gap Register FIN-11).
- **`mobile/src/types/api.ts`** — `FinanceDashboardResponse`, `FinanceApprovalQueueItem`,
  `FinanceApprovalQueueResponse`, shapes mirroring the backend functions' own return objects
  verbatim.
- **`mobile/src/hooks/useFinance.ts`** (new file) — `useFinanceDashboard`, `useFinanceApprovals`,
  `useFinanceApprovalDecide` (a thin pass-through to the shared approval engine via REST, no new
  approval logic on the mobile side either).
- **`mobile/src/screens/finance/FinanceDashboardScreen.tsx`** (new) — tile-grid dashboard,
  reusing `formatCurrency`/`formatNumber` and the existing `LoadingState`/`ErrorState`/
  `OfflineBanner`/`AppHeader` components; surfaces the same `dataQualityWarning` banner the
  desktop dashboard shows.
- **`mobile/src/screens/finance/FinanceApprovalsScreen.tsx`** (new) — reuses the existing
  `ApprovalCard` component verbatim (title/subtitle/meta/approve/reject with a reason modal),
  the same component every other mobile approval screen in this app already uses.
- **`mobile/src/navigation/FinanceCenterStack.tsx`** (new) — a 2-screen stack
  (`FinanceDashboard` → `FinanceApprovals`).
- **`mobile/src/navigation/types.ts`** — new `FinanceCenterStackParamList` +
  `FinanceCenterStackScreenProps`; `FinanceCenter` tab added to `FinanceTabParamList`,
  `CeoTabParamList`, and `OperationsTabParamList` (the three role-navigator families whose
  roles hold the `finance-center` permission: finance/ceo+admin/operations).
- **`mobile/src/navigation/FinanceNavigator.tsx`**, **`CeoNavigator.tsx`**,
  **`OperationsNavigator.tsx`** — each gains a new `FinanceCenter` tab mounting the shared
  `FinanceCenterStack`, same "one shared stack, multiple navigators" pattern already
  established by `CasualLabourStack` (Payroll's own mobile home).

## Mobile API (`mobile-api/`)

- **`mobile-api/routes/finance.js`** (new file) — pure delegation to `data.js`, mirroring
  `payroll.js`'s structure exactly: `GET /dashboard`, `/customer-outstanding`,
  `/supplier-outstanding`, `/operations`, `/approvals`, `/reports/workshop-cost`,
  `/reports/department-cost`, `/reports/approvals`, `/reports/exceptions`, `/reports/audit`,
  `/trace/:sourceType/:sourceId`, `/config`, `/sage-export/preview`, `/sage-export/history`; a
  binary `GET /sage-export/run` (same exception class as `payroll.js`'s own
  `/export/:reportType` — raw `.xlsx` bytes, not the JSON envelope); and a new
  `POST /approvals/:entityType/:entityId/decide` — a thin, generalized pass-through to
  `procurementApprovalAction` (the same function `procurementRequisitions.js`'s own
  `/:id/approve` route already calls, just not hardcoded to one entity type here since
  Finance's queue spans five).
- **`mobile-api/server.js`** — registers the new route at `app.use('/api/finance-center', ...)`.

## Bugs found and fixed during this phase's own build (not carried from Phase 1)

- **FIN-08 — `_monthBounds` naming collision**: see Gap Register. Found live during this
  phase's own E2E verification, fixed before any client (desktop or mobile) could reach it.

## Live E2E Verification (this phase, disposable QA data, all cleaned up)

- All 13 read-only finance* functions invoked directly against production with a real admin
  account — all returned `ok: true` with sane, well-shaped data.
- Sage export: ran a real export against one pre-existing leftover QA invoice (`QA-INV-001`),
  confirmed a real `.xlsx` file was generated (`PK` zip signature, 7222 bytes, opened and
  inspected — not merely "button exists"), confirmed the tracking row was created, confirmed a
  second run correctly reports "nothing new to export" (duplicate blocked at the app level),
  confirmed a direct duplicate INSERT against the same `(source_module, source_record_id)` pair
  fails with Postgres `23505` (duplicate blocked at the DB level, the actual concurrency-safe
  authority) — then deleted the tracking row created by this test, restoring
  `finance_sage_exports` to its pre-test empty state.
- Duplicate-payment guard: confirmed `procurementPaymentCreate` blocks a second payment attempt
  against an already-paid invoice with no new row created.
- Workshop Isolation: snapshotted a real active `finance` role account's `workshop_id` (null),
  temporarily set it to a real workshop id, confirmed `financeDashboard`/
  `financeOperationsSearch`/`financeApprovalQueue` return zero cross-workshop rows and
  `financeWorkshopCostSummary`/`financeDepartmentCostSummary` correctly deny access
  ("company-wide only"), then restored the account's `workshop_id` to its original value
  (verified restored).
- Regression: `getCeoOverview`, `payrollPeriodList`, `getApprovalDashboard`,
  `procurementRequisitionsList`, `getBootstrap`, `procurementPerformanceScorecard`, and
  `procurementExecutiveReport('executive_summary')` (the two functions depending on
  Procurement's own, untouched `_monthBounds(monthsAgo)`) all re-verified live — zero
  regression from this phase's changes.
