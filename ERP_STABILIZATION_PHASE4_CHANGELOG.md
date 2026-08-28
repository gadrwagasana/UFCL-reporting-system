# ERP Stabilization Program — Phase 4 — Changelog

*(Numbered Phase 4 in this session's sequence — the brief that requested this work called itself "Phase 2," but this session already shipped a Phase 2 and Phase 3; renumbered per explicit user direction to preserve program history.)*

## Fixed — Mobile client permissions (`mobile/src/utils/permissions.ts`)

- `logistics-officer` gains `stock.catalog`, `transfer.view`, `transfer.act`, `fuel.vehicle` — all match backend grants it already held (`stock-items`, `stock-transfers`, `vehicles`).
- `supervisor` gains `workshop.approve` — matches desktop's existing Material Request approval behavior; this was the only mobile entry point for that action.
- `operations` gains `dispatch.view`, `dispatch.approve` — matches its backend `dispatch` grant.
- `admin`/`ceo` gain `fuel.vehicle` — matches their backend `vehicles` grant (previously only `logistics` had this mobile key).

## Fixed — Mobile navigation

- `mobile/src/navigation/types.ts` / `OperationsNavigator.tsx` — added a Dispatch tab for the `operations` role (reusing the existing `DispatchStack`), so the newly-granted permission has a screen to unlock.

## Fixed — Desktop (`renderer/app.js`)

- Stock Transfers screen: `logistics-officer` added to `canAct` (create/dispatch/receive/discrepancy) — the approve-vs-act split itself was left untouched, no finding questioned it.
- Roles & Permissions editor: added missing checkboxes for `machine-maintenance`, `maintenance-jobs`, `maintenance-oversight` — previously grantable only via a one-time migration.

## Fixed — mobile-api routes (under-grants: role held the backend permission but was blocked at the route)

- `dispatch.js` — `operations` added to `VIEW_ROLES`.
- `transport.js` — `operations`, `sales` added to `ROLES`.
- `workshops.js` — `supervisor`, `storekeeper-assistant` added to `OVERVIEW_ROLES`; `storekeeper` added to `MANAGE_ROLES`.
- `compartments.js` — `harvesting-leader` added to `VIEW_ROLES`.
- `timberInventory.js` — `sawmill-leader`, `vat-leader`, `showroom-staff` added to `ALLOWED`.
- `fuel.js` — `/vehicle` routes widened from `['logistics','admin']` to `['admin','ceo','logistics','logistics-officer']`, matching `vehicles.js`'s own role set and the function's actual `mustRole('vehicles')` gate.

## Fixed — mobile-api routes (over-grants: role passed the route but was always refused by the function it called — dead paths, not exploitable)

- `workshops.js` — `operations` removed from `MANAGE_ROLES` (doesn't hold `warehouses`).
- `timberInventory.js` — `logistics` removed from `ALLOWED` (doesn't hold `timber-inventory`).
- `stock.js` — `ceo` removed from `INVENTORY_ROLES`; `supervisor`/`harvesting-leader`/`sawmill-leader`/`poles-leader`/`vat-leader` removed from `MOVEMENTS_ROLES` (none hold `stock-movements`, cross-confirmed by `db/migrate.js`'s own `STOCK_MOVEMENTS_ROLES` list).
- `sales.js` — `/:id/deliver` moved off the shared `SALES_ROLES` onto a new `DELIVER_ROLES = ['admin','ceo','sales']` (the route calls `deliveryOrdersCreate`, which gates on `mustRole('deliveries')`, a different key than the rest of the file; `operations` holds `sales` but not `deliveries`).

## Verified

- Live REST verification against the real environment with 8 throwaway accounts (admin, ceo, logistics, logistics-officer, supervisor, mechanician, storekeeper, operations): all 15 targeted checks matched predicted before/after status exactly.
- Every added mobile permission key confirmed consumed by a real `hasPermission()` call in an actual screen before being granted.
- `node --check` clean on all 9 touched files; `tsc --noEmit` clean on mobile.
- No regression in any Phase 1–3 fix.

## Documented, not fixed (out of this phase's scope, per explicit user decision)

- P-1 — mobile Procurement's near-total lack of client-side permission gating (15/22 screens have none at all). Confirmed not a security issue (backend enforcement is solid); deferred to its own future phase given its size. Full ground-truth captured in the completion report §9.
- `compartmentsCreate`/`Update`/`Delete`'s narrower hardcoded gate vs. `compartmentsList`'s `mustRole` OR-clause — a backend-internal inconsistency, not touched (backend is this phase's source of truth, not its target).
