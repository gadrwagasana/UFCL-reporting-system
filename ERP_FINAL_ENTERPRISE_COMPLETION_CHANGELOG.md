# ERP Final Enterprise Completion Gate — Changelog

Scope: final end-to-end completion and department-parity phase across all 14 departments plus cross-cutting concerns (Permissions, Notifications, Audit Trail, CRUD/Dashboard/Reporting/Mobile-Desktop parity). No architecture redesign, no parallel workflow, no new approval/notification/audit engine. Nothing committed or pushed.

## Method

1. Eight parallel, read-only audit agents covering: (1) CEO/Operations/Permissions matrix, (2) Procurement, (3) Harvesting+Sawmill, (4) Pole Production+Nyanza/VAT, (5) Showroom+Inventory/Stock, (6) Logistics+Fleet+Mechanician, (7) Notifications+Audit Trail+UI parity, (8) Sales Dashboard/Reporting/Customer-History build recon — each citing `file:line` for every finding.
2. Every genuine defect fixed and live-verified against the production database with disposable, uniquely-tagged QA data.
3. Three genuinely-absent capabilities (Sales Dashboard, Reporting, Customer History) built, per the brief's explicit authorization.
4. Full cleanup, independently re-verified against a fresh query.

## Fixed — Workshop Isolation (9 functions/entities, all live-verified with negative + positive controls)

### `db/services/data.js`

- **`transportJobsList/Create/UpdateStatus/Update/Delete`** — had **zero** Workshop Isolation of any kind, reachable by workshop-restricted `sales`/`logistics-officer` roles. `transport_jobs` has no `workshop_id` column of its own; scoped through the linked `sales_orders.workshop_id` (falling back to the delivery order's own sales order when only `delivery_order_id` is set), same "null = unscoped" convention used throughout this file.
- **`valueAddedProductionBatchUpdate`/`Delete`** — write-side Workshop Isolation added, matching the sibling `poleProductionBatchDelete` idiom. **Also fixed a separate, previously-undiscovered crash bug found live during this phase's own fix-verification**: both functions passed the singular `'value_added_production_batch'` as the raw SQL table name to `applyGovernance` (which interpolates it directly as `FROM ${table}`), but the real table is plural (`value_added_production_batches`) — this crashed with a Postgres "relation does not exist" error for **every** caller, unconditionally, regardless of role, since these functions were written. `entityType` (a different, correct concept used by `applyPendingEdit`'s dispatcher) was untouched.
- **`procurementRequisitionDetail`** — read-side Workshop Isolation added (List/Create already had it; Detail didn't).
- **`procurementPoDetail`/`procurementPoUpdate`** — read-side Workshop Isolation added.
- **`procurementGoodsReceiptList`/`Detail`** — had no workshop filtering at all (unlike the adjacent `procurementGoodsReceiptPendingPoleQC`, which already scoped correctly) — fixed.
- **`harvestUpdate`/`Delete`**, **`harvestPlanUpdate`/`Delete`**, **`dailyUpdate`/`Delete`**, **`logTransportUpdate`/`Delete`** — all previously relied only on the generic ownership/time-gated governance check, not a direct workshop-boundary check (unlike sibling functions in the same file, e.g. `harvestWasteCreate`/`productionOffcutCreate`) — added the standard `isWorkshopRestricted` check to all 8.

### `logTransportUpdate` — additional real bug fixed

- Unlike `logTransportCreate`, this never re-validated the "transport ≤ harvested − wasted" invariant nor the duplicate-receipt-reference guard, so an edit could silently raise `qty_transported` past the same ceiling Create enforces. Fixed with the same "only the increase needs to fit, netting out this record's own prior consumption" pattern `dailyUpdate` already uses for its analogous `logs_received` invariant. Preserves `receipt_reference` when the caller doesn't send it (no UI form currently does) rather than silently nulling it out.

## Fixed — Audit Trail

- **`procurementSupplierContactUpdate`/`Delete`**, **`supplierCommunicationUpdate`** — mutated/deleted records with zero audit trail; added `logAudit` calls matching every sibling Supplier/Contact/Contract write in the file.

## Fixed — Notifications

- **`dispatchCreate`** — notification was malformed at the source (no `relatedModule`/`relatedId` at all, despite the new record's id being on hand). Added, plus a `'dispatch'` entry in both `renderer/app.js`'s `NOTIFICATION_ROUTES` and `mobile/src/utils/notificationRouting.ts`.
- **`logPrivilegedOverride`** — the most security-sensitive notification in the app (a CEO/admin "Override Alert") had the same gap; added `relatedModule`/`relatedId` (metadata completeness — not every governed table has a matching UI route yet, so this makes the notification queryable/attributable, not a claim every table now deep-links).

## Fixed — Permissions

- **`'showroom'` desktop NAV page id** was never seeded to any role (including `showroom-staff`, the role the Showroom page was built for) — new migration `grantShowroomNavPermission()` grants it additively to `admin/ceo/operations/supervisor/showroom-staff`, matching the exact role set the underlying backend functions already authorize. `db/services/data.js`'s `ROLE_PAGES` fallback updated to match.
- **`'sales-dashboard'`** page id (backs the new Sales Dashboard + Reporting) seeded via `grantSalesDashboardPermission()` to `admin/ceo/operations/sales/sales-staff/showroom-staff`.

## Fixed — Inventory Integrity

- **`stockMovementsDelete`** — reversed `stock_levels` (for `in`/`return`/`out`/legacy-`transfer` types) but never logged that reversal as a `stock_movements` row, so the live ledger showed neither the original event nor its reversal after a delete. Now inserts the correct opposite-direction movement(s), same shape as every other real posting in this file.

## Built — Sales Dashboard, Reporting, Customer History (explicitly authorized this phase)

### `db/services/data.js`

- **`salesDashboard(userId, workshopId)`** *(new)* — real status-count/revenue aggregates (today/month/year, no `LIMIT`), top products this month, recent orders. Gated on the new `'sales-dashboard'` permission — deliberately its own function, not a reuse of `executiveDashboard` (which hard-excludes `sales` via a literal role array).
- **`salesReport(userId, filters)`** *(new)* — date-range + workshop-filtered Sales History, no cap.
- **`customersOrders(userId, customerId)`** *(new)* — a customer's full order history + summary. Confirmed `sales_orders.customer_id` is a real FK; walk-in orders with no linked customer are structurally excluded (documented in the UI, not silently patched with a fuzzy name match).

### Desktop (`renderer/app.js`, `renderer/index.html`, `electron/main.js`, `electron/preload.js`)

- New "Sales Dashboard" NAV page + `showPage` case + `page-sales-dashboard` container — combined KPI dashboard and filterable Sales History report with CSV export (reuses the existing `exec:export` save-dialog IPC channel), using the `.cards`/`.mc` metric-card convention already used on Customers/Sales/CEO pages.
- New `openCustomerDetailOverlay(customer)` — tabbed overlay (Overview + Orders), mirroring `openVehicleDetailOverlay`'s exact shape (synchronous Overview tab, lazy-loaded Orders tab). New "View" button on the Customers list wired to it.
- New IPC channels: `sales:dashboard`, `sales:report`, `customers:orders` + preload bindings.
- `REPORT_ENTRIES` (data.js) gained a `sales-dashboard` entry so the page is findable via Global Search.

### Mobile

- New screens: `SalesDashboardScreen.tsx`, `SalesHistoryScreen.tsx`, `CustomerDetailScreen.tsx`.
- New stack: `SalesDashboardStack.tsx` (Dashboard → History), replacing the generic shared `DashboardScreen` on `SalesNavigator`'s Dashboard tab.
- `CustomersStack.tsx` gained a `CustomerDetail` route; `CustomersListScreen.tsx`'s card tap now opens it (Edit remains one tap away via the header action) instead of jumping straight to the edit form.
- New hooks: `useSalesDashboard`, `useSalesReport` (`useSalesOrders.ts`), `useCustomerOrders` (`useCustomers.ts`).
- New endpoints: `SALES_DASHBOARD`, `SALES_REPORT`, `CUSTOMERS_ORDERS`.
- New REST routes: `GET /api/sales/dashboard`, `GET /api/sales/report`, `GET /api/customers/:id/orders`.
- CSV export intentionally desktop-only this phase (no direct mobile equivalent to Electron's native save-dialog flow without a new share-sheet integration) — the mobile Sales History screen provides the same filtered on-screen data instead.

## Backend REST parity added (no mobile UI — see report §17 for why)

- **Log Transport** — `mobile-api/routes/logTransport.js` gained `DELETE /:id` + mobile hook (`useLogTransportDelete`) + a Delete action on `LogTransportDetailScreen.tsx` (desktop already had full CRUD; mobile had Create/Read/Update only).
- **Machine Maintenance Schedule** — `mobile-api/routes/machines.js` gained `PUT`/`DELETE /maint-schedules/:schedId`, reusing the already-correct Workshop Isolation checks in `machineMaintScheduleUpdate/Delete`. **Mobile UI deliberately not added** — `MachineMaintScheduleListScreen.tsx` was explicitly built read-only in a prior phase (documented in-code) because the roles granted mobile List access don't hold the write permission; adding write UI here would contradict that prior, still-valid scope decision.

## Verified, no code change needed

- Full role×page×platform permissions matrix (CEO/Operations/Permissions audit) — no other gate mismatches found beyond the two already-known, already-disclosed items (`showroom-staff` Stock Transfers nav gap; poles/vat-supervisor mobile BI, likely consistent supervisor-tier design).
- Procurement's Requisition-Return-for-Revision and PO-Close-with-Shortage workflows — re-verified working in current code.
- Supplier blacklist enforcement — re-confirmed genuinely backend-enforced at 5 independent transaction points.
- Mechanician's full 10-state job lifecycle and real Material-Request→Transfer→Receive spare-parts pipeline — re-confirmed genuine, not a parallel/fake system.
- `mv_stock_summary`/`mv_stock_by_workshop` — re-confirmed a deliberately-retained, actively-refreshed legacy view, not neglected; one residual risk at `dispatchReview` re-disclosed, not touched.
- 20 raw SQL table names used across every `applyGovernance` call site in `data.js` swept against the live schema after finding the VAT batch bug — all 20 (including the now-fixed one) resolve to real tables; no sibling instances of the same bug found.

## Not fixed (documented, correctly scoped — see Gap Register for the full classified list)

- `procurementBenchmark` + 9 Phase-7 executive-report types — fully backend/IPC/REST-wired, zero UI trigger on either platform; a business decision (which comparison dimensions to surface), not a bug.
- Governance reminder/escalation notices (the *follow-up* notices only, not the initial one) drop their `relatedModule` linkage — real, lower-priority, out of this phase's fix budget.
- Notification delivery does not respect Workshop Isolation (role-blast can reach other workshops' role-holders) — a metadata leak, not a data-access breach; the underlying page still enforces isolation.
- ~13 functions (concentrated in the user-account lifecycle) call `logAudit` with a thinner `opts` payload (no `module`/`recordId`) — present and readable in the audit log, just excluded from its module-filter dropdown.
- `_QA-RL-TEST` leftover vehicle (id 2) — still present, awaiting a user decision, not touched.
- `polesSourceReport` mobile hook — built, never wired to a screen.

## Verification

- 8 parallel code-audit agents, `file:line`-cited findings.
- `node --check` clean on every touched backend/desktop file, after every fix and again after all fixes combined.
- `npx tsc --noEmit` clean across `mobile/`, after every mobile change and again after all changes combined.
- Migration re-run three times — fully idempotent (0 additional roles granted on the 2nd and 3rd runs).
- **Live fix verification**: single comprehensive script covering all 9 Workshop Isolation fixes (5 negative + 5 positive controls across Transport Jobs, Harvest/Sawmill/LogTransport, VAT batches, Procurement Requisition — 26 checks), the `logTransportUpdate` revalidation fix, the `stockMovementsDelete` reversal-logging fix, the `dispatchCreate` notification fix, the 3 procurement audit-trail fixes, and the new `salesDashboard`/`salesReport`/`customersOrders` functions returning real data — **41/41 checks passed** on the final run (two earlier runs surfaced and fixed real issues along the way: a test-setup mistake, a race condition against this codebase's fire-and-forget `logAudit`/`pushNotification` calls, and the genuine VAT-batch crash bug itself).
- Security spot-check: unauthorized-role calls to all 3 new Sales functions correctly denied; nonexistent-id calls handled gracefully (no crashes) except one pre-existing, unrelated, very-low-severity silent no-op in `transportJobsUpdateStatus` on a nonexistent id (not introduced this phase, noted in the Gap Register).
- All QA data (3 temporary user accounts — deactivated, never hard-deleted, since `audit_log` is immutable and FK-references `app_users`; 2 sales orders, 1 transport job, 1 harvest log, 1 harvest plan, 1 daily log, 1 log transport entry, 1 VAT batch, 1 requisition + item, 2 stock movements, 1 delivery order, 1 dispatch request, 2 notifications, 1 supplier contact) fully deleted after testing; `stock_levels` restored to its exact pre-test value; zero residue independently re-verified via a fresh query, three separate times across the debugging cycle.

## Not committed

Per this phase's Stop Rule, nothing above has been committed or pushed. All changes are local working-tree edits pending review. No other department or feature starts automatically after this phase.
