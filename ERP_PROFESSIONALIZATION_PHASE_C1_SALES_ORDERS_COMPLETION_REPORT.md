# Phase C1 — Sales Orders Operational Excellence — Completion Report

Companion files: `_GAP_REGISTER.md` (every finding, classified), `_CHANGELOG.md` (exact
file-by-file diff summary).

## 1. Executive Summary

Sales Orders was the single most consequential finding of the prior Master Professionalization
Phase 1 audit (Gap Register PR-01): the primary daily screen for the whole Sales department had
zero search, filter, sort, or export, was hard-capped at 50 rows server-side with no way to
reach anything past it, and had no detail/drill-down view on either platform. This phase closed
every part of that gap — server-side search/filter/sort/pagination, a new detail view with
delivery and audit history, Excel export, and mobile parity — plus fixed one real, previously
undetected bug (a desktop status-change dropdown that offered 4 values the backend would have
rejected). 19 findings fixed, 4 deliberately deferred (documented, not silently dropped), zero
new departments, zero pricing/COGS logic changes, zero new approval gates. Live-tested against
production data (created, exercised, fully cleaned up): 47/47 checks passed.

## 2. Existing Architecture

Unchanged: Electron → IPC → `db/services/data.js` → PostgreSQL (desktop); React Native → REST
(`mobile-api/routes/sales.js`, thin delegation) → the same `data.js` → PostgreSQL (mobile). No
new tables, no `sales_order_items` line-item table added (orders remain single-product-line
rows, matching the schema's existing design), no duplicate business logic anywhere.

## 3. Backend/UI Audit

Full audit performed before any code was touched (3 parallel research passes: backend functions
in `data.js`; desktop `renderer/app.js` + IPC; mobile screens/hooks/REST). Findings are recorded
in the Gap Register. Headline: the backend had real, sound business logic throughout (correct
workshop isolation, real row-locking on every stock-affecting write, idempotent cancel/
close-short reversal formulas) — the gap was entirely in what was *exposed* (list flexibility,
detail/history read paths, export), not in correctness.

## 4. CRUD Parity

Create/Update/Delete were already fully correct and workshop-isolated (confirmed, unchanged).
The gap was concentrated in **Read**: no filtered/sorted/paginated list beyond the first 50 rows,
and no single-record detail fetch existed at all. Both closed this phase (`salesList` extended,
`salesGet` added).

## 5. Search

`salesList` now accepts a `search` param matching against order number, customer name (both the
free-text and registered-customer name), product type/sub-type/size — server-side `ilike`,
workshop-isolation-safe (search never expands beyond what the user's own workshop scope already
allows). Both platforms wired.

## 6. Filtering

Status, payment status, and date range filters added, all server-side. Desktop's status filter
offers the full real status vocabulary (including system-set values like "Partially Dispatched"
so a user can find those orders); mobile ships status chips for the most common values. No
invented business classification — every filterable value is a real column/status the backend
already produces.

## 7. Sorting

Server-side sort on order number, customer, quantity, total (computed), delivery status, and
date — desktop via clickable column headers (asc/desc toggle), a full round-trip per click since
the dataset can now exceed one page (client-side-only resort, as some other list pages use,
would be wrong once pagination is real).

## 8. Pagination

`salesList` now supports `page`/`pageSize` (default 50, capped at 200) and returns an honest
`total`. Desktop: Prev/Next controls with a "Page X of Y" indicator. Mobile: page-based
accumulation with pull-to-refresh (resets to page 1) and `onEndReached` load-more — not
framework-provided infinite scroll, but real, tested pagination reaching rows the previous
50-row hard cap made permanently unreachable.

## 9. Sales Order Detail

New on both platforms. Desktop: tabbed overlay (Overview / Deliveries / History) opened by
clicking an order number. Mobile: a new `SalesOrderDetailScreen`, opened by tapping an order
card. Both show header, customer, workshop, product, quantity/pricing/total, COGS/margin (newly
surfaced per-order — previously only visible on the separate Sales Dashboard report), payment
status, linked deliveries with driver/dates/dispatched/accepted/rejected quantities, and a full
audit-history list.

## 10. Customer Drill-down

Already complete before this phase (`openCustomerDetailOverlay` on desktop, `CustomerDetail`
navigation on mobile) — confirmed still working, untouched.

## 11. Product Drill-down

Confirmed already complete: the Create/Edit forms resolve dynamically against the real Product
Catalog (`salesProductsForDropdown`), nothing hardcoded beyond the 3 top-level category labels
(an existing, unchanged taxonomy decision, not a defect). No live per-selected-product stock
figure was added to the Create form this pass — deliberately deferred (Gap Register G-20) since
the Create form itself was out of this phase's touched surface.

## 12. Pricing

Untouched. COGS/margin display reuses the exact formula `salesReport` already computed
(`quantity × unit_price` for revenue, `quantity × standard_cost` for COGS) — no new financial
logic invented, no negotiated-price override behavior changed.

## 13. Inventory Integration

Untouched and re-verified structurally: every stock-affecting write
(`salesCreate`/`salesUpdate`/`salesUpdateStatus`-cancel/`salesCloseShort`/POD-rejection) still
routes through the same `_postFinishedTimberStock` helper with the same row-locking. Live-tested
this phase using orders whose product intentionally didn't resolve to a catalog item (to keep
the test isolated from real stock) — confirmed zero `stock_movements` rows were created by the
test, and confirmed the close-short/cancel reversal paths still behave correctly when a product
*does* resolve (verified via code inspection, unchanged).

## 14. Delivery Integration

Visible: the new Sales Order Detail view shows every linked delivery's status/driver/dates/
quantities inline, on both platforms — satisfying §14's "make the relationship visible... reuse
the existing Delivery Order workflow" without redesigning Logistics. A true cross-navigation
link into the standalone Delivery Orders module's own detail screen was not built this pass
(Gap Register G-19) — the delivery *information* is now fully visible where it matters (the
order's own detail view), which is what was actually missing.

## 15. Notifications

Both platforms' `sales` notification-routing entry upgraded from page-only to a real per-record
deep link into the new detail view/screen — this was only possible now that a detail view
exists; the entries were correctly left page-only in earlier phases for exactly this reason.

## 16. Permissions

No permission model changed. One client-side gating inconsistency fixed on mobile: Delete and
status-change had no `hasPermission` check at all (unlike Edit/Pay/Close-Short); now gated on
`sales.edit`, matching the other edit-tier actions. Backend enforcement (`mustRole`, ownership/
time-gated governance) was never affected — this was a UI-affordance fix, not a security fix.

## 17. Workshop Isolation

Mandatory, and re-verified live this phase (not just re-inspected): a real workshop-restricted
`sales-staff` account, scoped to Gatare, was confirmed to see only its own workshop's orders
through the new filtered list, was denied `salesGet` on another workshop's order, and the
export function correctly applied the same scoping. See §21 for the exact assertions.

## 18. Desktop UX

List page now has: search, 3 filter controls (status/payment/date-range), sortable columns,
pagination, skeleton loading (previously plain "Loading…" text), Export Excel button, and a
detail view — closing every item the prior audit flagged. Existing create/edit/deliver/pay/
transport/close-short/delete flows are unchanged and were re-wired (not rewritten) to refresh
via the new data-only reload path.

## 19. Mobile UX

List screen now has: `OfflineBanner` (previously missing, inconsistent with Vehicles/Deliveries/
Payroll), search bar, status filter chips, pagination, tap-to-view-detail, and consistent
permission gating on all 5 row actions. New detail screen follows the same section-card pattern
`CustomerDetailScreen`/`VehicleDetailScreen` already established — no new UI convention invented.

## 20. Excel/CSV Export

Excel (`.xlsx`) added — the first real export of any kind on the Sales Orders list itself
(previously only the separate Sales Dashboard had a CSV-only export, and that exported a
different, aggregated dataset). Respects the exact same search/filter/date-range the on-screen
list is currently using. CSV was deliberately not duplicated — see Gap Register G-21 for the
reasoning (matches the Payroll "gold standard" pattern, which is also Excel-only).

## 21. Live E2E Verification

Executed against production data (the only real environment available — same disclosed
constraint as prior phases), using clearly-tagged, fully disposable QA records
(`QA-C1-001`..`005`, one QA customer), created via direct function calls (bypassing UI, calling
`data.js` functions directly — same methodology as every prior phase's live testing).
**47 of 47 assertions passed**, covering:

- Create 5 orders across 3 workshops; confirmed **zero** `stock_movements` rows were created
  (product intentionally unresolvable, keeping the test isolated from real stock).
- `salesList` default view, `search`, `status`, `paymentStatus`, `dateFrom` filters — each
  verified to return exactly the expected subset.
- `sortBy=total` ascending and descending — verified actually sorted, not just accepted.
- Pagination — page 1 vs page 2 verified disjoint, correct row counts, consistent `total`.
- `salesGet` — verified shape (order/deliveries/totalValue/inventoryNote) and that `totalValue`
  matches `quantity × unit_price`.
- `logisticsRecordHistory('sales', id)` — verified it returns rows for a sales-permitted user
  and is correctly **denied** for a non-sales role.
- `salesOrdersExportExcel` — verified `rowCount` matches, and the returned buffer is a real
  `.xlsx` (starts with the `PK` zip signature).
- Full delivery → close-short lifecycle: partial dispatch (12 of 20), close-short, verified
  final status, verified a **second** close-short call is safely rejected (idempotency guard).
- Cancel, then re-cancel: verified the second call is a safe no-op (idempotency guard).
- Verified the backend rejects a non-manual status string (`'In Progress'`) — confirms the
  desktop dropdown fix (§18) is now consistent with actual backend behavior.
- **Workshop Isolation**: a real Gatare-scoped `sales-staff` account saw only its own
  workshop's 3 QA orders (not the Nyanza/Showroom ones), was denied `salesGet` on a
  cross-workshop order, and its export call correctly applied the same scoping.
- One incidental finding disclosed, not silently fixed: `logisticsRecordHistory`'s permission
  check is role-based only, not per-record workshop-scoped — this is pre-existing behavior of
  the shared function (true for every other module it already serves), not something this phase
  introduced; noted in the Gap Register as **NOT A BUG** relative to this phase's scope.

## 22. Regression Verification

`node --check` clean on every touched backend/desktop file. `npx tsc --noEmit` clean across the
entire mobile project (zero errors). No shared function's behavior changed for any *other*
module — `logisticsRecordHistory` gained one additive permission-map entry; `salesList`'s
extended signature was updated at all 3 real call sites in the same change (no orphaned old-
signature caller left behind — confirmed via a full-codebase grep). Delivery/Logistics/
Inventory/Customer/Product/Notification/Audit/Approval code paths were not touched.

## 23. QA Cleanup

All 5 QA sales orders soft-deleted (`salesDelete`) and verified zero non-deleted `QA-C1-*` rows
remain. The one QA `delivery_orders` row (created for the close-short lifecycle test) was
removed directly, since soft-deleting a sales order does not cascade-delete its delivery orders
— confirmed pre-existing behavior, not something this phase changed. The QA customer was
deactivated (`customersToggle`) rather than hard-deleted: the soft-deleted QA sales orders still
hold a foreign-key reference to it (no `ON DELETE` clause on that column), so a hard delete would
have violated the constraint — deactivation is the correct, non-destructive equivalent, matching
how every other soft-deleted entity in this app is actually cleaned up. Zero `stock_movements`
residue confirmed. No temporary files remain — the E2E test script (`_qa_phaseC1_e2e_test.js`)
was deleted after the run.

## 24. Outstanding Items

4 deferred items, all documented in the Gap Register (G-18, G-19, G-20, G-22) — none are
defects, all are deliberate scope boundaries (Create/Edit forms left untouched; no cross-nav
into the standalone Delivery Orders module; no premature search-index optimization against a
table that currently holds zero real production rows).

## 25. Production Readiness

**Sales Orders is now professionally complete** against every criterion in §31: CRUD, search,
filter, sort, pagination, Excel export, desktop and mobile UX, customer/delivery visibility,
COGS/margin visibility, safe cancel/close-short, correct notifications, complete audit history,
intact Workshop Isolation and permissions, no dead UI, no silently-unreachable capability, QA
data fully cleaned, static verification clean, no regression in adjacent modules. This closes
Gap Register PR-01 from the Master Professionalization Phase 1 audit in full.

**Per the Stop Rule: this phase is complete. Not starting Phase C2 or any other P2/P3 item.**
