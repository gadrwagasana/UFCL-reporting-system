# Sales Enterprise Phase 2 — Gap Register

## Fixed this phase

| # | Finding | Severity | Fix |
|---|---|---|---|
| 1 | Sales Dashboard had no Sales-by-Customer breakdown | Medium | `salesDashboard` — new `topCustomers` query, both platforms |
| 2 | Sales Dashboard had no Sales-by-Workshop breakdown | Low | `salesDashboard` — new `byWorkshop` query (unrestricted roles only), both platforms |
| 3 | Sales Report had no COGS/margin despite `standard_cost` being available | Medium | `salesReport` — `products` join, `cogs`/`margin` computed only where a real cost basis exists |
| 4 | Customer History had no delivery info per order | Medium | `customersOrders` — reused `salesList`'s delivery lateral join |
| 5 | `customersOrders` leaked a customer's cross-workshop order history to workshop-restricted viewers | **High** (Workshop Isolation) | `isWorkshopRestricted` idiom applied + `hiddenOtherWorkshopOrders` disclosure |
| 6 | `sales-staff`/`showroom-staff` had no path to Customer History at all | Medium | `customersOrders` permission extended to accept `'sales'` (user-approved, narrow scope) + new "View Customer" UI entry point, both platforms |
| 7 | Mobile Customers tab shown to `sales-staff`/`showroom-staff` despite being permanently non-functional (403) for them | Medium (UX) | `SalesNavigator.tsx` — tab now conditional on `role === 'sales'` |

## Deferred / documented, not fixed

| # | Finding | Severity | Why deferred |
|---|---|---|---|
| D1 | `salesUpdate` requires `order_number` to be resubmitted on every edit call (no fallback to the existing value if omitted) | Low | API-ergonomics quirk, not a functional defect; discovered incidentally while writing the verification script; out of scope for this phase's brief |
| D2 | No real payment ledger exists (`payment_status`/`payment_due_date` are the only payment fields anywhere in the schema — no amount, no partial payments, no payment-date-recorded) | N/A — business decision | Explicitly out of scope per the brief ("do not invent a ledger without explicit approval"); documented in the Completion Report §8 |
| D3 | No BOM/labour-cost engine exists for true margin on manufactured (non-timber) products | N/A — business decision | Unchanged from prior phases' findings; margin is only computed where `products.standard_cost` is populated |
| D4 | **Pre-existing, unrelated to this phase**: 2 stray `notifications` rows (ids 731/732, `related_module='sales'`, `related_id` 21/22, dated 2026-08-10, titled referencing "QA-SIP2-F"/"QA-SIP2-G") — leftover from an earlier Stock Inventory Phase 2 test run, never cleaned up | Low (cosmetic QA residue) | Discovered incidentally while independently verifying this phase's own QA cleanup was complete. Not created by this phase's testing. Left untouched per the "never silently correct historical/production data without approval" rule — needs a one-line deletion approval, not a code fix |

## New business decisions

- **Decided this phase:** `customersOrders` permission scope — extend to `'sales'` (approved) rather than granting full `'customers'` page access to `sales-staff`/`showroom-staff`, or leaving the gap undisclosed. See Completion Report §21.
- **Still pending:** D2 (payment ledger), D3 (cost/BOM engine) — both require a separate business decision before any implementation work.
