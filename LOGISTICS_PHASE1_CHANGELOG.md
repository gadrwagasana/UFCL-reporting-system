# Changelog — Logistics Department Phase 1

## Fixed — Critical

- `logisticsDashboard()` had no permission check at all — added `mustRole(user, 'logistics-dashboard')`; removed the mobile route's separate, narrower hardcoded role list so the backend gate is the single source of truth.
- Governance-blocked (`pendingApproval`) results have no `.error` field, so every affected call site displayed the literal text "undefined" instead of an approval message. Added `showOverlayPending()`, a `toast-pending` style variant, and shared `handleGovernanceResult()`/`handleGovernanceResultToast()` helpers; fixed all ~10 call sites across Delivery Orders, Dispatch, Transport Jobs, and Legacy Logistics.
- Delivery/Dispatch/Transport-Job (and pre-existing but undiscovered: Legacy Logistics item) governance approval requests were created and escalated but had no page to review them on. Extended the existing `insertPendingPanel`/`insertDeletionPanel` components onto all four pages. Fixed the two backend gaps that would have made approving these requests fail: `applyPendingEdit`'s switch (added `delivery_order`, `transport_job` cases; `delivery_order_pod` via a new shared `_applyDeliveryOrderPOD` helper) and `SOFT_DELETE_ALLOWED` (added `delivery_orders`, `dispatch_requests`, `transport_jobs`, `logistics_items`).
- `dispatchReview` now validates the linked order's product-line balance (`mv_stock_summary`) before allowing a transition to `Dispatched`, blocking with a clear "Insufficient stock" message — scoped per an explicit decision, since no per-SKU link exists between sales/delivery orders and `stock_catalog`.

## Fixed — High Priority

- Mobile "Deliver from Sales Order" called `data.deliveriesCreate`, a nonexistent function — repointed to `data.deliveryOrdersCreate`. Added the missing "Quantity Dispatched" field to `SalesOrderDeliverScreen.tsx` so this flow correctly updates the linked Sales Order's dispatched totals, matching desktop.
- `logistics-officer`'s mobile navigator no longer shows tabs that always 403: granted the role to `vehicles.js`/`stock.js` (catalog/inventory/movements)/`workshops.js` (overview only)/`stockTransfers.js` (act, not approve) routes where it already has the underlying page permission; hid Machines/Workshop Management/Timber Inventory/Dispatch/Vehicle Fuel tabs where no such permission exists.
- `dispatchCreate` now sends a notification to approver roles — previously silent.
- `dispatchReview`'s permission check switched from a hardcoded role array to `mustRole('dispatch')`; granted `operations` the `dispatch` page permission so this is additive, not a narrowing (the hardcoded list already implied operations should have access, but the page itself was unreachable for them).
- `transportJobsList/Create/Update/Delete/UpdateStatus` now accept either `transport` or `transport-jobs`, making the independently-grantable `transport-jobs` permission actually functional on its own.
- `deliveryOrdersRecordPOD` now goes through `applyGovernance`, closing the only Delivery Orders mutation that previously bypassed ownership/time-gating entirely.
- Naming standardized: "Legacy Logistics" → "Spare Parts & Materials" (NAV label, export button, permission-checklist group moved from "Commercial" to "Logistics"); "Dispatch Control" → "Dispatch" (page title).

## Added

- Full mobile Transport Carriers module: `mobile-api/routes/transport.js` (`/companies` + `/jobs`), `useTransport.ts` hooks, `TransportCarriersListScreen`/`TransportCarrierFormScreen`, `TransportJobsListScreen`/`TransportJobFormScreen`, two new navigation stacks, wired into `LogisticsNavigator` — matching desktop's existing CRUD capability, which had no mobile presence at all before this phase.
- Loading indicators on Delivery Orders, Dispatch, Transport Carriers, and Legacy Logistics (previously blank during initial fetch).
- Success feedback on Dispatch Approve/Dispatch actions and Delivery/Transport-Job status-change dropdowns (previously silent or used a bare `alert()`).

## Fixed — Unplanned (discovered via live smoke testing)

- **`req.user.id` → `req.user.userId`**: the JWT payload only ever contains `userId` (per `middleware/auth.js`'s own doc comment), but `dispatch.js`, `stock.js`, `workshops.js`, `stockTransfers.js`, and `timberInventory.js` all read `req.user.id` (always `undefined`), meaning every route in these five files would fail. Fixed in all five (Logistics-scoped). The same bug exists in `compartments.js`, `admin.js`, `automation.js`, `epm.js`, `reports.js` — outside this phase's scope, flagged as a follow-up.
- Converting `transport_jobs`/`dispatch_requests`/`delivery_orders`/`logistics_items` to soft-delete required adding `deleted_at is null` filters to 5 queries that would otherwise have started showing trashed records as live: the delivery/dispatch Global Search modules, the Sales Order → delivery lateral join (`salesList`), the "awaiting delivery" pending-actions query, `inventoryList`, and `transportCompaniesList`'s job-count/cost subqueries.
- `transportCompaniesDelete`'s job-count guard was initially (incorrectly) changed to exclude trashed jobs, which caused a live foreign-key violation (a trashed job row still references its carrier). Reverted to counting all jobs, matching the DB's actual constraint — deactivation remains the correct path once any job history exists for a carrier.

## Verification

- `node --check` passed on every touched file.
- `npx tsc --noEmit` passed cleanly on mobile.
- Live database smoke test: 11/11 checks passed (after the two defects above were found and fixed).

## Notes

- No company workflow, approval chain, or workshop isolation rule was redesigned.
- One role permission was widened (`operations` + `dispatch`) to match an inconsistency the audit found between the code's own stated intent and what was actually granted — not a design change.
- Not committed — per standing release discipline, changes are left staged for review and explicit commit approval.
