# ERP UI/UX Remediation Phase 2 — Changelog

Scope: CRUD/action parity audit across ~62 entities (Sales/Customers/Products/Users checked directly; Fleet/Mechanician, Procurement, Nyanza/Sawmill/Showroom, Logistics/Stock/Harvesting audited via 4 parallel research passes). 6 genuine gaps fixed, all minimal-footprint reuses of existing governed backend functions and existing UI patterns. No new tables, no new approval/notification engine, no permission change, no Workshop Isolation change. Nothing committed or pushed.

## Fixed

### `db/services/data.js`

- **`logTransportList`** — added `lt.compt_id` to the SELECT list (was previously only joining `compt_name`). Purely additive; found and fixed while building the Log Transport Edit UI below, since the edit form's compartment dropdown couldn't pre-select the right compartment without it.

### `renderer/app.js`

- **Log Transport** — added an Edit button/overlay per row, calling the already-governed `logTransportUpdate` (previously wired via IPC with zero UI callers). Completes Remediation Phase 1's `insertPendingPanel(['log_transport'])` fix, which had nothing to ever populate it until now.
- **Vehicle detail overlay, Maintenance tab** — added a delete button per row (`maintenanceDelete`, governed, previously desktop had Edit-only while mobile already had delete).
- **Vehicle detail overlay, Fuel tab** — added a delete button per row (`fuelLogsDelete`, governed, previously desktop had no action column at all while mobile already had delete).
- **Harvest Waste section** — added a "Categories" management overlay (list + add), closing `harvestWasteCategoryCreate`'s previously-zero UI callers.

### `mobile-api/routes/fuel.js`

- Added `DELETE /api/fuel/machine/:id`, mirroring the existing governed-passthrough convention the sibling `PUT` route already established for `machineFuelLogsUpdate`.

### `mobile-api/routes/casualLabour.js`

- Added `DELETE /api/casual-labour/:id` for `casualLabourRequestsDelete`, same governed-passthrough convention.

### `mobile-api/routes/logTransport.js`

- Added `PUT /api/log-transport/:id` for `logTransportUpdate` — this route didn't exist at all before this phase.

### Mobile hooks/screens/types

- `mobile/src/hooks/useMachineFuel.ts` — added `useMachineFuelDelete`.
- `mobile/src/screens/machineFuel/MachineFuelDetailScreen.tsx` — added a Delete action + `ReasonModal`, matching `VehicleDetailScreen.tsx`'s established delete-flow idiom.
- `mobile/src/hooks/useCasualLabour.ts` — added `useCasualLabourDelete`.
- `mobile/src/screens/labour/CasualLabourDetailScreen.tsx` — added a Delete action + `ReasonModal`.
- `mobile/src/hooks/useLogTransport.ts` — added `useLogTransportUpdate`.
- `mobile/src/screens/harvest/LogTransportCreateScreen.tsx` — converted to dual-purpose create/edit (optional `entry` route param).
- `mobile/src/screens/harvest/LogTransportDetailScreen.tsx` — added an Edit header action; typed `useNavigation` correctly to fix a resulting `tsc` error.
- `mobile/src/navigation/types.ts` — `LogTransportStackParamList.LogTransportCreate` now accepts an optional `{ entry }` param.
- `mobile/src/types/api.ts` — added `compt_id` to `LogTransportEntry` (matches the backend fix above).
- `mobile/src/api/endpoints.ts` — added `MACHINE_FUEL_DELETE`, `LABOUR_DELETE`, `LOG_TRANSPORT_UPDATE`.

## Found already resolved / not a gap — no code changed

- `procurementGoodsReceiptCreate`'s stock-item + workshop pickers — re-confirmed present on both platforms (Remediation Phase 1 finding, re-verified not regressed).
- `procurementQuotationsCompare` — dead but redundant; both platforms already render comparison data inline from the RFQ detail payload.
- Machine Maintenance Schedules mobile edit/delete, Downgrade resolution mobile, generic resolution-destination restriction on mobile — all three explicitly documented in-code as deliberate scope decisions, not oversights.
- Maintenance Job lifecycle — verified all 10 `MAINT_TRANSITIONS` states have a reachable UI trigger on both platforms; excellent existing parity, nothing to fix.

## Corrected from prior findings

- **Resolution Engine browse/list** — Remediation Phase 1's register believed this was desktop-only-missing (mobile had it). This phase found the mobile hook (`useResolutionsList`) exists but is called by **no screen** — the capability is actually missing on both platforms, not just desktop. Documented, not built this phase (see completion report §11).
- **`procurementBenchmark`** — Remediation Phase 1's register believed this was mobile-only-dead. This phase found it's also dead on desktop (zero callers in `renderer/app.js`). Documented, not built (already awaiting a go/no-go decision from an earlier phase).

## Deferred — documented, not built

Machine Daily Logs mobile edit/delete (2 missing REST routes + UI), Machine KPI Definitions/Targets mobile (100% blind, plausibly intentional), Casuals worker registry mobile (100% blind, a genuinely new feature), `supplierImprovementPlansRegister` (dead both platforms, moderate new screen). Full reasoning in the completion report §11.

## Verification

- `node --check` clean on all touched backend/route files.
- `npx tsc --noEmit` clean across `mobile/` after every change.
- Live, read-only + reversible verification: `logTransportUpdate` called against a real record and confirmed working, then restored to its original value (zero residue). Workshop Isolation regression-checked (workshop-restricted storekeeper still denied CEO overview); Phase 1's own fixes (CEO dashboard, BI dashboard) re-verified still working; `machineKpiDefinitionsList`, `harvestWasteCategoriesList`, `logTransportList` (with the new `compt_id` field) all confirmed still functioning correctly.
- No QA/test data was left behind by any verification in this phase.

## Not committed

Per this phase's Stop Rule, nothing above has been committed or pushed. All changes are local working-tree edits pending review.
