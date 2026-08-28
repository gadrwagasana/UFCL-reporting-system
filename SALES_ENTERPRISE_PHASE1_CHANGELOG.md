# Sales Enterprise Phase 1 — Changelog

Scope: Sales department completion — backend inventory, CRUD parity, Workshop Isolation, notifications, permissions, UI/UX standard. No architecture redesign, no parallel Sales workflow, no change to the shared governance/QC/Resolution engines. Nothing committed or pushed.

## Method

1. Three parallel, read-only audit agents: (a) backend capability matrix + CRUD/Customer/Pricing, (b) delivery/inventory/notifications/permissions/Workshop Isolation, (c) dashboard/reporting/UI completion — each citing `file:line`.
2. Every genuine defect fixed and live-verified against the production database with disposable, uniquely-tagged QA data.
3. Live end-to-end Cancellation and Concurrency scenarios run fresh; other scenarios (A–G) cited from prior phases' already-completed live evidence rather than re-run.
4. Full cleanup, independently re-verified against a fresh query.

## Fixed

### `db/services/data.js`

- **`deliveryOrdersList`** — added Workshop Isolation. Previously returned every workshop's delivery orders (and every open sales order in its dropdown payload) to any caller holding `'deliveries'`, including workshop-restricted `sales-staff`/`showroom-staff`. Now scoped through the linked `sales_orders.workshop_id` (the table itself has no `workshop_id` column), using the same "null = unscoped, not blocked" convention used everywhere else in this file.
- **`deliveryOrdersCreate`** — added the same Workshop Isolation check inside its existing transaction (it already locked the target `sales_orders` row for the quantity check; the lock now also carries `workshop_id` for the isolation check). Also: now fires a `pushNotification` to `['admin','ceo','logistics','operations']` with `relatedModule:'deliveries'` on successful creation — previously fired none at all, unlike sibling `dispatchCreate`.
- **`deliveryOrdersUpdateStatus`**, **`deliveryOrdersUpdate`**, **`deliveryOrdersDelete`** — each added the identical Workshop Isolation check (join to `sales_orders.workshop_id`, compare against `isWorkshopRestricted(user)`), matching the idiom already used in `_applyDeliveryOrderPOD`/`salesCreate`/`stockTransfersDispatch` elsewhere in this program.
- **`customersCreate`** — previously had no role gate at all (`if (!user)` only); any authenticated user of any role could register a customer via desktop IPC. Now requires the `customers` or `sales` permission.
- **`customersToggle`** *(new function)* — closes a real gap: `customers.active` existed in the schema, was selected/displayed by `customersList`, but had no write path anywhere. Mirrors `productsToggle`'s existing reasoned soft-toggle pattern exactly (gated on `customers`, requires a non-empty reason, logs to the audit trail).
- Exported `customersToggle` from the module.

### `electron/main.js` / `electron/preload.js`

- Added the `customers:toggle` IPC channel and its preload binding, wired to the new `customersToggle` function.

### `mobile-api/routes/customers.js`

- Added `CUSTOMER_CREATE_ROLES` (adds `sales-staff`/`showroom-staff` to the existing `CUSTOMER_ROLES`) for the `POST /` route only — closes the desktop/mobile disagreement described above (desktop had no gate, mobile's gate omitted these two roles even though they legitimately need to register walk-in customers). List/Update remain on the unchanged, narrower `CUSTOMER_ROLES`.
- Added `PATCH /:id/toggle` route, delegating to `customersToggle`.

### `renderer/app.js`

- `renderSales` — added a loading placeholder (matching the convention already used by `renderExecutiveDashboard`/`renderMachines`) and wrapped its initial data fetch in `try/catch`, rendering a "Could not load Sales orders" error state with a Retry button on failure. Previously rendered nothing until every request resolved and had no recovery path for a thrown error.
- Sales order status-update overlay — selecting "Cancelled" now reveals a warning notice and requires typing `CANCEL` to confirm before the Update button will submit. Every other status is unaffected.
- `renderCustomers` — added a Status column and a Deactivate/Reactivate button per row (reason-required overlay, same pattern as the existing Product Catalog toggle), wired to the new `customersToggle`.

### Mobile

- `mobile/src/api/endpoints.ts` — added `CUSTOMERS_TOGGLE`.
- `mobile/src/hooks/useCustomers.ts` — added `useCustomerToggle`.
- `mobile/src/screens/customers/CustomersListScreen.tsx` — added a Deactivate/Reactivate action per customer card (via the existing `ReasonModal`, matching `ProductsListScreen`'s own toggle UI — not `Alert.prompt`), and an Inactive badge for deactivated customers.
- `mobile/src/screens/salesOrders/SalesOrdersListScreen.tsx` — `StatusModal`'s Cancelled option now requires an explicit "Yes, cancel this order" checkbox before Update is enabled. Every other status is unaffected.

## Verified, no code change needed

- Sales × Inventory/Workshop product resolution — confirmed no hardcoded category allow-list.
- Pricing model — confirmed negotiated-per-order, frozen historically, never overwritten back to the Product Catalog.
- Desktop/mobile Sales/Customer/DeliveryOrders action wiring — zero orphaned backend functions on either platform.
- Mobile Pay/Close-Short screen wiring — confirmed real and wired via direct source inspection (an earlier grep-only pass produced a false lead).
- Delete confirmation, `Alert.prompt` sweep, `salesCreate`'s concurrency guard — all re-confirmed correct, no change needed.

## Not fixed (documented, correctly scoped — see Gap Register)

- Sales Dashboard and Sales Reporting — confirmed to not exist anywhere for the `sales` role, on either platform. Presented to the user as a scope decision (build now vs. disclose); **user chose to disclose only and defer building**, consistent with how every other "new page" finding has been handled throughout this program.
- Payment ledger (only a binary Paid/Unpaid status flag exists, no amount/date/partial-payment tracking).
- Sales order attachments (the polymorphic `attachments` table's entity allow-list was never extended to `sales_order`).
- Customer Detail / order-history view (neither platform has one; both have only a flat list + edit form).

## Live end-to-end scenarios

- **Scenario H (Cancellation)** and **Scenario I (Concurrency)** run fresh this phase — 13/13 checks passed (4 + 3 scenario-specific, plus setup/verification checks). Scenarios A–G cited from prior phases' already-completed live evidence (Completion Gate, Pole Production Phase 1/2) rather than duplicated.
- This phase's own fixes verified with a dedicated script (`_qa_sales_p1_fixes.js`): real Sawmill production → real Stock Transfer Gatare→Nyanza → two sales orders (one per workshop) → 5 Workshop Isolation checks (negative + positive controls) → notification check → 3 customer-permission checks → 4 customer-toggle checks. **26/26 checks passed.**

## Verification

- 3 parallel code-audit agents, `file:line`-cited findings.
- `node --check` clean on every touched file, after every fix and again after all fixes combined.
- `npx tsc --noEmit` clean across `mobile/`, after every mobile change and again after all changes combined.
- All QA data from both live-test scripts (2 sales orders, 2 delivery orders, 2 customers, 1 daily log, 1 offcut, 1 QC record, 1 stock transfer + dispatch row, ~9 stock movements, ~14 notifications, across the two scripts) fully deleted after testing; affected `stock_levels` rows restored to their exact pre-test values at both workshops; zero residue independently re-verified via a fresh query, both times.

## Not committed

Per this phase's Stop Rule, nothing above has been committed or pushed. All changes are local working-tree edits pending review. No other department starts automatically after this phase.
