# Fleet & Equipment — Phase 1 Changelog

Critical Fixes, Security, Enterprise Governance & Architecture Completion. Implements the approved `FLEET_EQUIPMENT_ENTERPRISE_AUDIT.md`. See `FLEET_EQUIPMENT_PHASE1_COMPLETION_REPORT.md` for full rationale, testing detail, and outstanding items.

## Schema (`db/migrate.js`)

- **Added** `vehicles` and `fuel_logs` to `SOFT_DELETE_TABLES` — both gain `pending_deletion`, `deleted_at`, `deleted_by`, `deletion_reason`.
- **Added** `vehicles.created_by bigint references app_users(id)` — required by `applyGovernance`'s ownership check; the table previously had no creator column at all. Existing rows are `NULL` (routed to approval by default, not a crash).

## Backend (`db/services/data.js`)

### Critical fixes
- `_stockItemUsageCount` — removed two clauses referencing a nonexistent `wk_consumption` table and a nonexistent `machine_fuel_logs.stock_item_id` column. `stockItemsDelete` no longer crashes.

### Governance
- `vehiclesUpdate` — now calls `applyGovernance('vehicles', ..., 'edit', ...)`.
- `vehiclesDelete` — now calls `applyGovernance('vehicles', ..., 'delete', ...)` and performs a soft-delete instead of a hard delete; no longer cascades hard-deletes of `fuel_logs`/`maintenance_records` or nulls `delivery_orders.vehicle_id` (unnecessary now that the parent row is preserved).
- `fuelLogsDelete` — converted from hard delete to governed soft-delete.
- `vehiclesList`/`fuelLogsList`/`maintenanceList`(already correct) — filter out soft-deleted rows.
- `MODULE_PERMISSION_CHECK` — added `vehicles`, `fuel_logs`, `maintenance_records`, `machine_categories`, `machine_kpi_definitions`, `machine_kpi_targets`, `machine_fuel_logs`.
- `SOFT_DELETE_ALLOWED`, `TRASH_TABLES` — added `vehicles`, `fuel_logs`.
- Added structured `{module, actionType, recordId}` audit-log opts to: `vehiclesCreate/Update/Delete`, `fuelLogsCreate/Delete`, `maintenanceCreate/Update`, `machineLogCategoriesCreate`, `machineKpiDefinitionsCreate/Update/Delete`, `machineKpiTargetsSave`, `machineFuelLogsCreate/Update/Delete`.

### Security — hardcoded role arrays decoupled to `mustRole`
- `machineLogCategoriesCreate`/`Delete` → `mustRole('machine-logs') || mustRole('machines')`.
- `machineKpiDefinitionsCreate/Update/Delete`, `machineKpiTargetsSave` → `mustRole('machine-kpi') || mustRole('machines')`.
- `machineFuelSummary`, `machineFuelLogsList/Create/Update/Delete` — redundant hardcoded-array OR-fallback removed (every role in those arrays already held `machine-fuel` via `role_definitions`); now a plain `mustRole('machine-fuel')`.

### Workshop-scoping added
- `machineMaintScheduleList/Create/Update/Delete` — restricted to the user's own workshop.
- `machineFuelLogsList/Create/Update/Delete` — machine-targeted entries scoped to the user's workshop; vehicle-targeted entries remain company-wide (vehicles are not workshop-owned).
- `machineLogsCreate` — verifies the target machine's workshop matches the user's own workshop when restricted.

### Bug fixes
- `machineFuelLogsUpdate` — now accepts either `machine_id` or `vehicle_id` (previously required `machine_id` unconditionally and never wrote `vehicle_id`, so vehicle-sourced fuel logs could never be edited); also gained the same workshop-scoping check as Create/Delete.
- `workshopOverview`'s `machines_maintenance` counter, `getCeoOverview`'s machine breakdown, and EPM's `ops-machine-avail` KPI — corrected to query the actual machine status vocabulary (`Available/Running/Maintenance/Breakdown`) instead of literals (`'In Use'`, `'Under Maintenance'`) that are never written, which meant these counters silently read zero.
- `fuel_logs`-referencing queries (`vehiclesList`, `logisticsDashboard`'s fuel-this-month, `_biPredictFuelConsumption`, `_autoCheckFuelAnomaly`, the BI fuel-trend chart) — added `deleted_at is null` filters now that `fuel_logs` supports soft-delete.

## Electron (`electron/main.js`, `electron/preload.js`)

- `vehicles:delete`, `fuel-logs:delete` — now forward the `reason` parameter (previously silently dropped; every sibling delete handler already forwarded it correctly).

## Mobile API

- `mobile-api/routes/meta.js` — `GET /vehicles` now requires `admin|ceo|logistics|logistics-officer` (previously unrestricted to any authenticated user).
- `mobile-api/routes/vehicles.js` — comment corrected to describe the new soft-delete behavior.
- `mobile-api/middleware/respond.js` — **bug fix**: a governed action's `pendingApproval` response was being collapsed into a generic error by the shared response helper, causing axios to reject the request before the mobile hooks' own pendingApproval handling could run. This affected fuel-log and maintenance-record governance on mobile already, not just the new vehicle work. Fixed with a targeted special-case; verified with a mocked-response test.

## Desktop (`renderer/app.js`)

- Vehicle edit handler — now uses `handleGovernanceResult()` instead of unconditionally calling `showOverlayError(r2.error)` (which showed "undefined" for a pendingApproval response).
- Vehicle delete handler — switched from a plain confirm dialog + hard delete to `confirmDeleteSoft()` (reason required) + `handleGovernanceResultToast()`, matching every other governed Fleet table's own pattern; confirmation copy corrected (fuel logs/maintenance history are now preserved, not deleted).
- Machine edit handler — same `handleGovernanceResult()` fix as the vehicle edit handler (pre-existing bug, same class, fixed opportunistically since it was directly adjacent).

## Mobile

- `mobile/src/hooks/useVehicles.ts` — `useVehicleUpdate`/`useVehicleDelete` now return `VehiclePendingApproval | void`, matching `useFuelLogDelete`/`useMaintenanceDelete`'s existing pattern.
- `mobile/src/screens/vehicles/VehicleFormScreen.tsx` — edit-submit now checks for and displays a "Submitted for Review" alert on a pendingApproval response.
- `mobile/src/screens/vehicles/VehicleDetailScreen.tsx` — delete flow rewritten: reason-required prompt (`Alert.prompt`, matching the screen's own fuel-log/maintenance-delete pattern) + pendingApproval handling + corrected confirmation copy.

## Verification

- `node --check`: clean on all touched backend/route/middleware files.
- `npx tsc --noEmit` (mobile): clean.
- Live DB smoke test via throwaway `_qa_fleet_*` accounts and throwaway catalog items/machines/vehicles (all cleaned up after, nothing pre-existing touched): stock-item deletion (clean + referenced), vehicle create/update/soft-delete/trash-restore, workshop-scoping denials (maintenance schedules, machine fuel, machine logs) for a cross-workshop machine, machine-status-counter corrections, and the `respond()` pendingApproval fix (mocked response object, 3 cases).
- One pre-existing, unrelated bug was discovered (`getCeoOverview` throws due to a `monthly_approvals.status` column that doesn't exist) — **not fixed**, out of scope for this phase; see completion report §9.

## Outstanding (see completion report §9 for full detail)

- `mechanician` role's documented "material requests only" scope vs. its mobile navigator granting Machine Logs/Machine Fuel screens it can't actually use — needs a business decision, not fixed here.
- `getCeoOverview`/`monthly_approvals` crash — unrelated module, not fixed here.
- `machineFuelLogsUpdate` remains unreachable from any UI — Phase 2 scope.
- Everything else deferred by the original audit to Phase 3 (spare-parts↔maintenance linkage, fuel-as-inventory-stock, Procurement linkage, combined operating-cost KPI) remains untouched, as intended.

## Not committed

Per standing release discipline, none of the above has been committed or pushed.
