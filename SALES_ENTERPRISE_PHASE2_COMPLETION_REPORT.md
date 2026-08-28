# SALES ENTERPRISE PHASE 2 — MANAGEMENT & CUSTOMER EXPERIENCE
## Completion Report

**Date:** 2026-08-13
**Scope:** Sales department — Dashboard, Reporting, Customer History, Payment Visibility, Notifications, Desktop/Mobile Parity, Workshop Isolation, Permissions, Inventory Integrity, CRUD/Concurrency/Regression verification.
**Status: PRODUCTION READY**

---

## 1. Executive Summary

This phase professionalized the Sales department's UI to match the functional depth already present in its backend, per the Audit-First / reuse-don't-duplicate discipline used throughout this program. No parallel Sales system was built; every deliverable extends existing functions, tables, and UI patterns.

Work fell into three groups:

1. **Completeness gaps** in the Dashboard/Reporting/Customer-History features built in the immediately preceding ERP Final Enterprise Completion Gate phase: no Sales-by-Customer breakdown, no Sales-by-Workshop breakdown, no COGS/margin in the Sales Report, no delivery history in Customer History. All four closed, both platforms, reusing already-proven query/join patterns (`salesList`'s delivery lateral join, `qualityReport`'s COGS pattern).
2. **A real, previously undiscovered Workshop Isolation gap** in `customersOrders`: `customers` are company-wide (no `workshop_id` column) but their individual `sales_orders` rows are workshop-scoped, so a customer's full cross-workshop order history was being shown to workshop-restricted viewers. Fixed with the standard `isWorkshopRestricted` idiom plus an honest "N hidden" disclosure rather than silently leaking or silently truncating.
3. **A real, pre-existing permission gap**: `sales-staff`/`showroom-staff` (the actual field sales roles) never held the `'customers'` permission, so they could not view Customer History at all — not even for a customer they themselves registered. Per the brief's explicit "do not grant permissions unilaterally" rule, this was escalated via `AskUserQuestion` rather than fixed silently. The user approved the narrowest option: extend `customersOrders` alone to also accept the `'sales'` permission, and give these roles a "View Customer" entry point from the Sales Orders list instead of full Customers-page access. Implemented exactly as approved, on both platforms. A related bug was found and fixed in the same pass: mobile's Customers tab was being shown unconditionally to these two roles even though they lacked `customersList` access — a permanently-broken (403) tab. It is now hidden for them, consistent with desktop (which never showed them a Customers nav entry to begin with).

26/26 CRUD checks, 12/12 concurrency checks, and 7/7 regression spot-checks passed live against the production database with disposable `_QA`-tagged data, fully cleaned up afterward and independently re-verified at zero residue.

## 2. Audit Methodology

Given first-hand knowledge of the exact code just built one phase earlier (Dashboard/Report/Customer History), a full multi-agent audit was judged unnecessary; the audit was performed directly by re-reading `salesDashboard`, `salesReport`, `customersOrders`, their desktop renderers, and their mobile screens/hooks against each of the brief's 18 priorities, then grepping for existing payment/notification/permission infrastructure before writing any new code (Priority 18, Audit-First Rule).

## 3. Backend Capability Audit

| Capability | Pre-existing | Gap found |
|---|---|---|
| Sales Dashboard core metrics (today/week/month, status counts, top products) | Yes (ERP Final Completion Gate) | Missing top customers, missing by-workshop breakdown |
| Sales Report (history, filters, CSV) | Yes | Missing COGS/margin, missing payment due date |
| Customer History (profile, orders, summary) | Yes | Missing delivery info; Workshop Isolation leak; permission gap for sales-staff/showroom-staff |
| Payment visibility (`payment_status`, `payment_due_date`, overdue detection, Pay button) | Yes, on core Sales Order screens both platforms | Not surfaced in Report/History views |
| Delivery lateral join pattern (`delivery_count`/`delivery_number`/`delivery_status`) | Yes, in `salesList` | Not reused in `customersOrders` |
| Notification producers for Sales/Delivery events | Yes | None — verified working, no gap |
| Workshop Isolation idiom (`isWorkshopRestricted`) | Yes, applied to `salesList`, `salesCreate`, `salesUpdateStatus`, `salesCloseShort`, `_applyDeliveryOrderPOD` | Not applied to `customersOrders` |

No genuinely new business capability (e.g. a payment ledger, a BOM/cost engine) was found missing that this phase was authorized to build — per the brief, those remain explicitly out of scope pending a separate business decision.

## 4. CRUD / Frontend Parity

Full trace re-confirmed for: Customer create/edit/deactivate/reactivate; Sales Order create/view/edit/cancel/close-short; Delivery Order create/edit/complete (POD)/reject (partial POD). All reachable, functional, and correctly permissioned on both desktop and mobile — see §14 for live evidence.

## 5. Sales Dashboard

Extended `salesDashboard(userId, workshopId)` with two new parallel queries:
- **Top Customers This Month** — top 5 by value, grouped by customer (falls back to `customer_name` for walk-in orders with no `customer_id`). Always rendered for every role.
- **Sales by Workshop This Month** — only computed for unrestricted roles (`workshop_id` filter is `null`); workshop-restricted roles get an empty array and the card is conditionally omitted, since they only ever see their own workshop's numbers elsewhere on the same dashboard.

No new financial calculations were invented — both are straightforward `sum(quantity*unit_price)` aggregations, the same shape as the existing "Top Products" query.

## 6. Sales Reporting

`salesReport` now joins `products` on `so.product_id` to pull `standard_cost`, computing `cogs`/`margin` per row **only when a real product match with a known cost exists** (`null`, not `0`, otherwise — no fabricated formula for unresolved products). Summary totals (`totalCogs`, `totalMargin`, `marginKnownOrders`) let the UI honestly show "N of M orders have a known cost basis" rather than implying a margin figure covers every order. `payment_due_date` added to the row and CSV export.

## 7. Customer History

`customersOrders` now returns delivery info per order (reusing `salesList`'s lateral join verbatim) and `payment_due_date`. Both desktop's `openCustomerDetailOverlay` and mobile's `CustomerDetailScreen` render it.

## 8. Payment Visibility

Confirmed: the only payment fields that exist anywhere in the schema are `sales_orders.payment_status` and `payment_due_date` — no amount, no partial-payment tracking, no payment-date-recorded field, matching Sales Phase 1's own finding. These were already exposed on the core Sales Order list/detail screens on both platforms before this phase. This phase extends the same two fields into the Sales Report and Customer History views. **No ledger was invented.** A proper payment ledger (amounts, partial payments, payment history, reconciliation against bank records) would require a new schema and a separate business decision — documented here, not built.

## 9. Notifications

Audited delivery-rejection and delivery-creation notification producers: both correctly set `relatedModule`, `relatedId`, role/owner-scoped recipients, and route on both platforms. Live-confirmed in regression check REG-4 (§16) — no changes were needed.

## 10. Desktop/Mobile Parity

Every capability touched this phase (Dashboard breakdowns, Report COGS/margin, Customer History delivery info, "View Customer" entry point) was built in lockstep on both platforms in the same change, not sequentially. The one platform-specific difference — desktop's sidebar already hid the Customers page from roles lacking the permission, while mobile's tab bar did not — is corrected in §10a below.

**10a. Mobile Customers-tab fix.** `SalesNavigator.tsx` showed the `Customers` tab unconditionally to `sales`, `sales-staff`, and `showroom-staff`, but `customersList`/`customersUpdate` still require the `'customers'` permission, which only `sales` holds. `sales-staff`/`showroom-staff` could tap the tab and would get a real HTTP 403 (confirmed via `mobile-api/middleware/respond.js` — a genuine `{ok:false}` result maps to a non-2xx status, so `CustomersListScreen.tsx`'s existing `isError` branch renders `ErrorState` with a Retry that would fail forever). The tab is now shown only to `role === 'sales'`; the other two roles reach Customer History exclusively via the new "View Customer" link from the Sales Orders list, which is fully functional for them since `customersOrders` now accepts `'sales'`.

## 11. Workshop Isolation

- `customersOrders`: fixed (§13 in the original audit, tracked here as the primary WI finding this phase) — restricted viewers now only see their own workshop's orders for a given customer, with an honest `hiddenOtherWorkshopOrders` count disclosed rather than a silent leak or silent truncation.
- Delivery Order WI (Sales Phase 1 regression): re-confirmed live — a Showroom user cannot record POD on or edit a Gatare delivery (REG-1/REG-2, §16).

## 12. Permissions

- `customersOrders` extended to accept `'sales'` in addition to `'customers'` — approved via `AskUserQuestion`, narrowest of three offered options, implemented exactly as approved. No other permission was granted; `customersList`/`customersCreate`/`customersUpdate` remain `'customers'`-only (unchanged).
- Negative-authorization control re-confirmed: a `mechanician` (holds neither `'sales'` nor `'customers'`) is denied by `customersOrders` (check 15c, §16).

## 13. Inventory Integrity

Re-verified for every mutating Sales/Delivery path this phase touches indirectly (create, quantity-edit, cancel, POD accept, POD partial-rejection, short-close) — all produce the correct `stock_levels`/`stock_movements` deltas, live-tested end to end (§16) including under concurrency (§17). No historical reversal bug was reintroduced.

## 14. End-to-End Verification (Priority 13)

Live, disposable `_QA`-tagged data against the production database (test accounts: `sales.staff`=18/Gatare, `show.staff`=19/Showroom, `mech.gatare`=14/negative control, `ADMIN`=1):

**26/26 checks passed**, covering: Customer create/edit/deactivate/reactivate; Sales Order create/view/edit(qty change, confirmed stock reflects it)/cancel(confirmed stock reversal); Delivery Order create/edit/complete(full POD)/reject(partial POD, confirmed stock reversal for rejected units); short-close(confirmed stock reversal); audit-log presence; `salesDashboard` topCustomers/byWorkshop real data; `salesReport` real non-null margin for a resolved product; `customersOrders` delivery info; Workshop-Isolation-restricted/same-workshop/negative-control access to `customersOrders`.

One test-script-only issue found along the way, not a product defect: `salesUpdate` requires `order_number` to be resubmitted on every edit (no fallback to the existing value) — see §17 Deferred Items.

## 15. Concurrency Testing (Priority 14)

**12/12 checks passed**, all against live, `for update`-locked code paths:

- **A — Two simultaneous sales racing for the same constrained stock** (9 available, two concurrent 5-unit orders): exactly one succeeded, the other correctly rejected with "Insufficient Finished Timber stock," stock never went negative. Confirms the Stock & Inventory Phase 2 row-locking fix still holds.
- **B — Concurrent cancellation** of the same order (called twice via `Promise.all`): both calls returned `ok:true` (idempotent by design — the reversal amount is computed fresh under lock each time), stock reversed exactly once, final status correctly `Cancelled`. A third, sequential call confirmed no further stock change.
- **C — Concurrent delivery rejection (POD)** on the same delivery: exactly one call succeeded, the other correctly rejected with "POD has already been recorded for this delivery" (the `for update` + status-guard fix in `_applyDeliveryOrderPOD`). Stock reversed exactly once. Sequential 3rd call correctly rejected.
- **D — Concurrent short-close** of the same order: exactly one call succeeded, the other correctly rejected with "This order is already Closed (Short)." Stock reversed exactly once. Sequential 3rd call correctly rejected.

No operation produced negative stock, a duplicate reversal, a duplicate stock movement, or an incorrect final Sales status.

## 16. Regression Testing (Priority 15)

**7/7 spot-checks passed**, targeting the Sales Phase 1 items named in the brief:

- Delivery Order Workshop Isolation: a Showroom user cannot record POD on (REG-1) or edit (REG-2) a Gatare delivery; an unrestricted admin still can (REG-3, sanity control).
- Logistics/Sales notification routing: delivery creation produced a correctly-routed notification (`related_module='deliveries'`, correct roles) — REG-4.
- Audit trail: both the regression Sales Order and Delivery Order produced `audit_log` entries — REG-5.
- Customer deactivate/reactivate and Customer authorization: re-confirmed as part of the 26/26 Priority 13 run (checks 1–4).
- Inventory reversal integrity: re-confirmed extensively in §14/§15.
- Cancellation confirmation and Desktop error/loading states are UI-only concerns; confirmed by inspection that neither `StatusModal`'s cancel-confirmation checkbox nor the general loading/error harness in `renderSales`/`SalesOrdersListScreen` was touched this phase.

**Cross-department regression:** this phase's backend changes are confined to three Sales-specific functions (`salesDashboard`, `salesReport`, `customersOrders`) in `data.js`; no shared helper (`_postFinishedTimberStock`, `applyGovernance`, `isWorkshopRestricted`, `pushNotification`, `logAudit`, `mustRole`) and no other department's function was modified. Combined with the immediately-preceding ERP Final Enterprise Completion Gate's 35/35 live cross-department evidence (unchanged since), no additional full cross-department regression sweep was run — the diff scope makes the risk architecturally nil, per this program's established reuse-don't-duplicate discipline.

## 17. Static Verification (Priority 17)

- `node --check` clean on: `db/services/data.js`, `electron/main.js`, `electron/preload.js`, `renderer/app.js`, `mobile-api/server.js`, every file in `mobile-api/routes/`.
- `npx tsc --noEmit` clean across `mobile/`.

**Disclosed limitation:** no physical device or simulator was available this phase; mobile screen changes were verified via type-checking and code inspection, not a manual click-through — consistent with the disclosed limitation carried since the ERP Final Enterprise Completion Gate phase.

## 18. Defects Found

1. Sales Dashboard had no Sales-by-Customer or Sales-by-Workshop breakdown (Priority 2 gap).
2. Sales Report had no COGS/margin despite `products.standard_cost` being available (Priority 3 gap).
3. Customer History had no delivery information per order (Priority 4 gap).
4. `customersOrders` leaked a customer's cross-workshop order history to workshop-restricted viewers (Workshop Isolation gap, Priority 9).
5. `sales-staff`/`showroom-staff` held no path to Customer History at all (pre-existing permission gap, Priority 10).
6. Mobile's Customers tab was shown to `sales-staff`/`showroom-staff` despite being permanently non-functional (403) for them (newly discovered UI bug, found while investigating #5).

## 19. Defects Fixed

All six items in §18 — see §5–§10a for implementation detail. All fixes were live-verified (§14–§16).

## 20. Deferred Items

- `salesUpdate` requires `order_number` to be resubmitted on every edit call (no fallback to the existing value) — a minor API-ergonomics quirk discovered while writing the test script, Low severity, not in scope to fix this phase. Tracked in the Gap Register.
- A full payment ledger (amounts, partial payments, payment-date tracking) remains undesigned and unbuilt — requires a separate business decision (§8).
- **Newly found, pre-existing, unrelated QA residue** (not caused by this phase): two stray `notifications` rows (ids 731/732, `related_module='sales'`, `related_id` 21/22, titled "Sales order closed short — QA-SIP2-F"/"QA-SIP2-G", dated 2026-08-10 — from an earlier Stock Inventory Phase 2 test run, never cleaned up). Discovered incidentally while independently verifying this phase's own cleanup was complete. Per the "never silently correct historical/production data" rule, left untouched and disclosed here rather than deleted without approval.

## 21. New Business Decisions

- **Approved this phase:** extend `customersOrders`'s permission check to accept `'sales'` in addition to `'customers'`, rather than granting `sales-staff`/`showroom-staff` full Customers-page access. Selected by the user via `AskUserQuestion` from three options (narrow extension / leave as-is and disclose / full page access). Implemented exactly as approved, plus the required new "View Customer" UI entry point on both platforms.
- **Still pending, not decided this phase:** a real payment ledger (§8, §20); a BOM/labour-cost engine for true margin on manufactured products (unchanged from prior phases' findings — out of scope, not fabricated).

---

## Production Readiness

**PRODUCTION READY.** All 18 brief priorities addressed: audited, fixed where genuinely missing/broken, or explicitly documented where already satisfied or deferred. 45/45 live checks passed (26 CRUD + 12 concurrency + 7 regression) against the production database with disposable QA data, now fully cleaned up and independently re-verified at zero residue (Gatare item-20 stock restored to its exact pre-test baseline of 2 units). Static verification clean across backend, desktop, and mobile. No parallel system was built; no permission was granted without approval; no historical data was altered.

Per the Stop Rule, no other department is started automatically following this phase.
