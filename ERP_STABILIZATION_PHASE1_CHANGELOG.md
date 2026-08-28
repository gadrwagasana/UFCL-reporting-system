# ERP Stabilization Program — Phase 1 — Changelog

## Fixed

- **[Critical] Mobile role gate broken on 8 endpoint groups** — `requireRoles(ARRAY)` was called without spreading the array, so `.includes(req.user.role)` never matched any role (including admin), returning 403 for everyone. Fixed by spreading the role array at every call site in:
  - `mobile-api/routes/dispatch.js`
  - `mobile-api/routes/transport.js`
  - `mobile-api/routes/sales.js`
  - `mobile-api/routes/compartments.js`
  - `mobile-api/routes/stock.js`
  - `mobile-api/routes/stockTransfers.js`
  - `mobile-api/routes/timberInventory.js`
  - `mobile-api/routes/workshops.js`

  Includes fixing a subtler variant of the same bug (`requireRoles([...ARRAY, 'extra'])`) found in `compartments.js` and `workshops.js`.

- **[Critical] Desktop Workshop Overview — Material Request approve always failed** — the dashboard's quick-approve button called the backend with a hardcoded `null` source warehouse, which the backend always rejects. `renderer/app.js` now opens a small overlay to collect the required source (and destination, when needed) before approving, mirroring the dedicated Material Requests page's existing pattern.

- **[Critical] Desktop Machine Logs — mechanician missing "Add log entry" button** — `renderer/app.js`'s `canAdd` role list now includes `mechanician`, matching the backend permission the role already holds.

- **[Critical] Desktop Machine Fuel — mechanician missing "Log Fuel" button** — `renderer/app.js`'s `canManage` role list on this screen now includes `mechanician`, matching the backend permission the role already holds.

- **[Critical] Mobile — no way to assign a technician to a maintenance job** — the existing `useMaintenanceJobAssign` hook and REST route had no screen consumer. `mobile/src/screens/maintenance/MaintenanceJobDetailScreen.tsx` now shows an "Assign Technician" action (gated the same way desktop is) with an inline form.

- **[High, found during live testing] `GET /api/sales` hung indefinitely for every role** — an unrelated query filtered `vehicles` on a non-existent `active` column; fixed to use `status='Active'`, matching every other vehicles-dropdown query in the codebase.

## Verified, not changed

- Confirmed via live REST testing (throwaway accounts, cleaned up afterward) that the role-gate fix works end-to-end for `operations`, `supervisor`, `storekeeper`, and `mechanician` across the 8 fixed files.
- Confirmed no accidental permission expansion was introduced by any fix in this phase.
- Confirmed no regression in unrelated, untouched modules (Vehicles, Machines, Procurement).

## Documented, not fixed (out of this phase's scope)

- `req.user.id` (always `undefined`; the JWT field is `req.user.userId`) used in `admin.js`, `automation.js`, `compartments.js`, `epm.js`, `reports.js` — every route in these 5 files fails and hangs for every role. Flagged as the top-priority item for the next stabilization phase.
- Missing async error handling (no `try/catch`, no unhandled-rejection-to-500 middleware) as the shared root cause of both bugs found via live testing this phase.
- Several pre-existing route-level role-array under/over-grants found during the permission audit (see the completion report §4/§8) — none exploitable, none introduced by this phase.
