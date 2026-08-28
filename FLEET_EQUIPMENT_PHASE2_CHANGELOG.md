# Fleet & Equipment — Phase 2 Changelog

Enterprise UI/UX Modernization & Executive Operational Dashboard. See `FLEET_EQUIPMENT_PHASE2_COMPLETION_REPORT.md` for full detail, testing evidence, and outstanding items.

## Backend

- `db/services/data.js`
  - Added `fleetDashboard(userId)` — new read-only aggregation across `vehicles`, `machines`, `fuel_logs`, `machine_fuel_logs`, `maintenance_records`, `pending_edits`, `deletion_requests`, `audit_log`. Gated on the existing `'vehicles'` permission (no permission change). Workshop-scopes the machine-side figures only, when the caller is workshop-restricted (vehicles remain company-wide per the Phase 1 business decision). Returns 12 KPI fields and 7 widget arrays. Exported.

## Electron

- `electron/main.js` — added `secureHandle('fleet:dashboard', (userId) => data.fleetDashboard(userId));`
- `electron/preload.js` — added `fleetDashboard: (_userId) => ipcRenderer.invoke('fleet:dashboard'),`

## Mobile API

- `mobile-api/routes/vehicles.js` — added `GET /api/vehicles/dashboard` (role-gated the same as the existing vehicle list route), registered before `/:id` to avoid Express route-matching collision.

## Desktop (`renderer/app.js`)

- `renderVehicles` rebuilt:
  - Fetches `vehiclesList`, `transportCompaniesDropdown`, and the new `fleetDashboard` in parallel.
  - Page renamed "Vehicle Fleet" → "Fleet Dashboard"; renders 12 new KPI cards + 7 new operational widgets (via new `_fleetKpiCardsHtml`/`_fleetWidgetsHtml` helpers, using the existing `_lgdWidget` component).
  - Registry table replaced with the standard enterprise toolkit: `procFilterBarHtml` search + status chips, `wireSortableTable` column sorting, `.bulk-bar` bulk selection with "Move selected to Trash" (governed soft-delete, per-row pendingApproval handling).
  - New `renderVehicleRows(list)` + `wireVehicleRowActions()` functions consolidate all row-action wiring (`.v-view`/`.v-chk`/`.v-edit`/`.v-del`/`.v-fuel`/`.v-maint`), re-invoked after every render.
  - New `vExport` button — CSV export of KPIs + widget summaries + filtered vehicle rows, via the existing `UFCL.execExport` IPC pattern (matching Inventory's `invExport`).
  - `vehicleForm`/`collectVehiclePayload`/`bindVehicleOwnershipToggle` and the fuel/maintenance create sub-overlays are unchanged.
- New `openVehicleDetailOverlay(r)` — tabbed detail overlay (`.smo-tabs`/`.smo-tab`, reused pattern): Overview, Maintenance (live `maintenanceList`), Fuel (live `fuelLogsList`), Assignments (current-state snapshot, explicitly labeled as such), Audit History (`_loadLogisticsHistoryInto`).
- `renderMachineFuelLogs` extended:
  - "Fuel Issue Log" table replaced with toolkit version: `procFilterBarHtml` search + fuel-type filter, `wireSortableTable`, new `renderFuelLogRows(list)`.
  - New `.mfl-view` action opens new `openMachineFuelLogDetailOverlay(r)` (detail + `_loadLogisticsHistoryInto`).
  - New `wireFuelLogRowActions()` preserves the existing supervisor-vs-direct-delete branching unchanged.
  - KPI cards, reconciliation tables, today's-activity strip, the fuel-issue create form (including the stock-deduction checkbox), and the trailing `insertDeletionPanel` call are all unchanged.
- `renderMachines` — reviewed for visual consistency against the new Vehicle Registry; already at the target standard (was the reference implementation this phase mirrored). No changes made.

## Mobile

- `mobile/src/api/endpoints.ts` — added `FLEET_DASHBOARD: '/api/vehicles/dashboard'`.
- `mobile/src/types/api.ts` — added `FleetDashboardKpi`, `FleetDashboardWidgetItem`, `FleetDashboardResponse`.
- `mobile/src/hooks/useVehicles.ts` — added `useFleetDashboard()` (`queryKey: ['fleet-dashboard']`, `staleTime: 60_000`).
- `mobile/src/screens/vehicles/VehiclesListScreen.tsx` — added `ListSearchBar` + status `FilterChip` row (`''|'Active'|'In Maintenance'|'Inactive'`, matching `MachinesListScreen`'s established pattern); added new `FleetBanner` (Machines/Active/Open Maintenance/Utilization) alongside the existing vehicle `MetricsBanner`.
- `mobile/src/screens/machineFuel/MachineFuelListScreen.tsx` — added `ListSearchBar` + local fuel-type `FilterChip` row (shown only when more than one fuel type is present in the data).

## Verification

- `node --check`: clean on `db/services/data.js`, `electron/main.js`, `electron/preload.js`, `mobile-api/routes/vehicles.js`, `renderer/app.js`.
- `npx tsc --noEmit` (mobile): clean.
- Backend integration test (throwaway `_qa_fleet_p2` account, deactivated after use): `fleetDashboard`, `maintenanceList`, `fuelLogsList` all confirmed working against real production data.
- Static DOM-ID cross-reference: no orphaned `$('...')` selectors found in the new code.

## Outstanding (not fixed this phase — see report §9)

- Full interactive desktop click-through (Electron + CDP) was not performed — recommended as the immediate next step.
- Phase 1's outstanding items (`mechanician` role/navigator mismatch, unrelated `getCeoOverview`/`monthly_approvals` crash) remain untouched.
- No edit action was added for fuel logs (view-only detail added; editing was never possible before and adding it would be a functional change, out of this phase's scope).

## Not committed

Per standing release discipline, none of the above has been committed or pushed.
