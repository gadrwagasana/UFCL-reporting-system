# Fleet & Equipment — Enterprise Audit

**Status: Audit only. No code was written, no database was modified, no business logic was changed.** This document is Step 1 of the standard audit → Phase 1 (architecture/security) → Phase 2 (UI/functional) → Phase 3 (intelligence/production-readiness) methodology already used for Procurement, Logistics, Workshop, and Inventory in this project. Implementation should not begin until this audit is reviewed and approved.

Scope: Vehicle Fleet, Machine Registry, Fuel Logs (vehicle + machine), Maintenance Records, Machine Daily Logs, Machine Maintenance Schedules, Machine KPIs/Categories — across `db/services/data.js`, `db/schema.sql`/`db/migrate.js`, `electron/main.js`/`preload.js`, `mobile-api/routes/*`, `renderer/app.js`, and `mobile/src/**`.

**One item could not be fully live-verified**: the live database was briefly unreachable during this audit (`Connection terminated due to connection timeout` — the same transient outage pattern documented during Inventory Phase 2). The one finding this affects (Critical-01, the `wk_consumption`/`machine_fuel_logs.stock_item_id` phantom references) is based on exhaustive static grep across both `db/schema.sql` and `db/migrate.js` finding no such table/column ever created — high confidence, but flagged so it's re-confirmed with a live query before any fix is scheduled.

---

## 1. Executive Summary

Fleet & Equipment is the least mature department in the ERP relative to the enterprise standard already achieved in Procurement, Logistics, Workshop, and Inventory. It is functionally rich — vehicles, machines, fuel, maintenance, KPIs, and BI forecasting all exist and mostly work — but it was never taken through the same audit → Phase 1 → Phase 2 → Phase 3 hardening cycle those four departments received. The result is a department where:

- **Vehicles and Machines are two parallel, inconsistently-built subsystems** rather than one coherent "Fleet & Equipment" experience — Machines got the full enterprise UI toolkit (search/filter/sort/bulk/detail-overlay/governance); Vehicles got none of it. Machines are workshop-scoped; Vehicles are not (no `workshop_id` column exists on `vehicles`). Machines route deletes/edits through the approval-governance system; Vehicles bypass it entirely with hard deletes.
- **One real crash bug was found**: `_stockItemUsageCount` (used by `stockItemsDelete`) queries a `wk_consumption` table and a `machine_fuel_logs.stock_item_id` column that do not exist anywhere in the tracked schema — any attempt to delete a Stock Catalog item will throw a Postgres error instead of the graceful "cannot delete — N linked records" response it's supposed to give.
- **One real security gap was found**: `mobile-api/routes/meta.js`'s `GET /vehicles` endpoint reads the vehicle registry directly via `pool.query` with no role check at all (comment in the code says "just needs valid JWT"), bypassing the `mustRole('vehicles')` gate every other vehicle-reading path enforces.
- **Cross-department integration is much thinner than the request scope assumes.** Fuel is not tracked as Inventory stock at all (a fully separate, disconnected accounting system). There is no link between a maintenance job and a spare-parts request. Procurement never creates or references a vehicle/machine. There is no "operating cost"/"asset cost" figure anywhere that combines vehicle + machine + fuel + maintenance costs — `vehicles.purchase_cost` is read nowhere outside its own CRUD screen.
- **Mobile has real strengths** (a Vehicle Detail screen richer than anything on desktop, a KPI Performance screen desktop itself only recently justified adding) but also real gaps (no machine delete, a duplicated vehicle-fuel data path, zero offline-queue support, and no single role that can reach all five fleet screens).

None of this is a business-logic problem — the workflows that exist are reasonable and match how a fleet department actually operates. The gap is entirely in consistency, governance, security enforcement, and enterprise UI polish — exactly the kind of gap the audit → Phase 1/2/3 process was designed to close for the other four departments.

## 2. Current Architecture

- **Schema**: `vehicles`, `fuel_logs`, `maintenance_records` defined in `db/schema.sql:296-334` (base) extended by `db/migrate.js` (33 additional columns on `vehicles` alone, `migrate.js:159-193`). `machine_categories`, `machines`, `machine_kpi_definitions`, `machine_kpi_targets`, `machine_daily_logs`, `machine_log_categories`, `machine_maintenance_schedules`, `machine_fuel_logs` defined in `db/schema.sql:445-679`, extended by `migrate.js:148, 197-206, 246-251, 294, 305`.
- **Backend**: 44 exported functions in `db/services/data.js` (full inventory in §5/§9 below) — all reachable, none dead.
- **Desktop wiring**: Electron → IPC → `data.js`, fully wired (every function has a `secureHandle` + preload method) except two parameter-forwarding drops (`reason` on `vehicles:delete`/`fuel-logs:delete` — §5).
- **REST wiring**: `mobile-api/routes/{vehicles,fuel,machines,machineLogs,meta}.js`, mounted `mobile-api/server.js:157-176`. Materially thinner than the desktop surface — several desktop-capable mutations have no REST route at all (§6).
- **Desktop UI**: `renderVehicles` (renderer/app.js:9421), `renderMachines` (11325), `renderMachineLogs` (11837), `renderMachineKpi` (12233), `renderMachineFuelLogs` (13214) — five separate page functions, no shared "Fleet" dashboard.
- **Mobile UI**: five separate navigation stacks (`VehiclesStack`, `MachinesStack`, `MachineLogStack`, `MachineFuelStack`, `VehicleFuelStack`), attached inconsistently across `CeoNavigator`, `OperationsNavigator`, `LogisticsNavigator`, `MechanicianNavigator` — no unified Fleet section, no role can reach all five.

## 3. End-to-End Workflow Review

### Vehicle: Registration → Assignment → Operation → Fuel → Maintenance → Repair → Return to Service → Retirement

- **Registration**: `vehiclesCreate` (`data.js:3803`) — works, `mustRole('vehicles')`, full field set (ownership, asset, owner/contract, driver, compliance dates, document-path fields). No link to a Procurement purchase order (§4 Procurement).
- **Assignment**: exists only as free-text fields on the vehicle (`driver_assigned`, and separately `driver_name`/`driver_phone`/`driver_license_number`/`driver_license_expiry`) — no assignment table, no start/end dates, no assignment history. Two overlapping "driver" concepts on one row with no authoritative field.
- **Operation**: vehicles are attached to `delivery_orders`, `transport_jobs`, `stock_transfer_dispatches` by `vehicle_id` FK (all confirmed real). None of these assignment paths re-check `vehicles.status='Active'` server-side at the point of insert/update — only the UI's dropdown pre-filters to Active, which a caller bypassing the dropdown (or the generic pending-edit-approval flow) would not be stopped by.
- **Fuel Consumption**: `fuelLogsCreate` (`data.js:3901`) — vehicle-only, standalone ledger, no relationship to Inventory stock (§4 Inventory).
- **Maintenance**: `maintenanceCreate` (`data.js:3936`) — free-text `maintenance_type`/`description`, `next_due_date` is manually entered (no forecasting — §7). No spare-parts linkage (§4).
- **Repair → Return to Service**: no explicit "repair completed" / "returned to service" status transition exists — `maintenance_records` is a flat log of maintenance events with no lifecycle/workflow state machine; `vehicles.status` is a free-text field with no enforced transition rules.
- **Retirement**: no retirement/decommission concept exists — `vehiclesDelete` (`data.js:5315`) is the only "removal" path, and it's a **hard delete** that cascades hard-deletes the vehicle's `fuel_logs` and non-trashed `maintenance_records` — permanently destroying operating history rather than retiring the asset. This is inconsistent with every soft-deletable table elsewhere in the app.

### Machine: Registration → Assignment → Daily Operation → Maintenance → Workshop Repair → Return to Service

- **Registration**: `machinesCreate` (`data.js:9221`) — works, `mustRole('machines')`, includes `workshop_id` (unlike vehicles).
- **Assignment**: implicit via `workshop_id` — a machine belongs to one workshop; no separate assignment event/history.
- **Daily Operation**: `machineLogsCreate` (`data.js:9368`) — records hours worked, downtime, fuel consumed, production. Workshop attribution is taken from **the machine's own `workshop_id`**, not validated against the logging user's own workshop — a workshop-restricted user could, in principle, log activity against a machine belonging to a different workshop with no rejection.
- **Maintenance**: `machineMaintScheduleCreate`/`Update`/`Delete` (`data.js:9640/9657/9673`) — a real recurring-schedule concept (`frequency_days`, `next_due`), genuinely more structured than vehicles' flat maintenance log. No workshop-scoping on these functions despite `machines` itself being workshop-scoped.
- **Workshop Repair**: `_autoCheckMaintenanceDue` (`data.js:10075`) fires a real notification when a machine's schedule is due — machines get this; vehicles get no equivalent automation (§7).
- **Return to Service**: same gap as vehicles — `machines.status` is free-text with two inconsistent vocabularies observed in the code itself (`'Under Maintenance'`/`'In Use'` vs `'Maintenance'`/`'Breakdown'`, both appearing inside the *same* `workshopOverview` function, `data.js:3512-3513` vs `3617-3661`) and no CHECK constraint — whichever literal the create/update UI actually writes, the other vocabulary's dashboard counters will silently read zero.

### Fuel: Request → Approval → Issue → Vehicle → Consumption → Reporting

- There is **no fuel request/approval step** for either vehicles or machines — `fuelLogsCreate`/`machineFuelLogsCreate` record fuel as already-issued, with no prior request or approval gate. This may be an intentional simplification (fuel is a routine operational log, not a scarce/approved resource like a Material Request), but it means the brief's assumed "Fuel Request → Approval → Issue" workflow does not exist in the code at all — it should be confirmed with the business whether this is a genuine gap or the correct intended process before treating it as a defect.
- **Issue → Consumption → Reporting** does work for machines: `machineFuelLogsCreate` (issued) reconciled against `machine_daily_logs.fuel_consumed` (consumed) in `machineFuelSummary` (`data.js:5785`), surfaced on `renderMachineFuelLogs` (per-machine + daily breakdown). Vehicles have no equivalent issued-vs-consumed reconciliation — `fuelLogsCreate` just records a fill-up with no "consumption" concept to reconcile against.

## 4. Cross-Department Collaboration Matrix

| Department | Real connections found | Gaps found |
|---|---|---|
| **Workshop** | `workshopOverview` surfaces machine counts/status/maintenance/downtime/fuel by workshop (`data.js:3495-3760`); machine `workshop_id` actively scopes multiple functions; maintenance cost feeds Workshop's finance-visibility cost trend and CSV export. | `vehicles` has no `workshop_id` — vehicle maintenance/repair can never be scoped to a workshop, always company-wide. No link between spare-parts stock consumption and a specific maintenance event (see Critical-01 below — the code *tries* to check this via phantom `wk_consumption`/`machine_fuel_logs.stock_item_id` references that don't exist). |
| **Logistics** | Real FKs: `delivery_orders.vehicle_id`, `transport_jobs.vehicle_id`, `stock_transfer_dispatches.vehicle_id`, `machine_fuel_logs.vehicle_id` — all confirmed. | Driver assignment (`vehicles.driver_assigned`/`driver_name`) is never read/auto-populated by any dispatch/delivery function — driver info is re-entered fresh every time with no link back to the vehicle record. No server-side re-validation of `vehicles.status='Active'` at the point of assignment (UI-dropdown-filter only). |
| **Inventory** | None — searched exhaustively. | Fuel (`fuel_logs`, `machine_fuel_logs`) has no relationship to `stock_catalog`/`stock_levels` at all — it's a fully separate, parallel accounting system. No stock item represents "fuel" anywhere. `maintenance_records`/`machine_maintenance_schedules` have no stock-item/spare-parts reference column; `material_requests` has no `machine_id`/`vehicle_id` column — a mechanic cannot request a spare part *for* a specific maintenance job through the existing Material Request flow. |
| **Procurement** | None — searched exhaustively across all 71 procurement functions. | Vehicle/machine registration is entirely manual and disconnected from Procurement — no PO ever creates a vehicle/machine row, and no vehicle/machine ever references the PO that acquired it. Fuel procurement has no link either (no fuel stock item exists to receive against). |
| **Finance** | `maintenance_records.cost` → Workshop's finance-visibility cost trend + CSV. `fuel_logs.total_cost` → Logistics dashboard's fuel-this-month + CSV. | No dedicated Finance module exists in the app at all. `machine_fuel_logs` has no cost column whatsoever (volume-only). `vehicles.purchase_cost` is read nowhere outside the Vehicles CRUD screen itself — never in CEO Overview, BI, EPM, Workshop, or Logistics. No combined "operating cost"/"asset cost" KPI exists anywhere. |
| **Management** | `getCeoOverview` shows machine status breakdown + active-vehicle count (counts only, no cost). BI dashboard's `_biPredictFuelConsumption`/`_biDetectFuelAnomalies` cover vehicle+machine fuel combined. EPM has 3 machine-only KPIs (`ops-machine-avail`, `ops-maintenance-compl`, `finance-fuel-efficiency`). | `_biPredictMaintenance`, `_biDetectMachineEfficiency`, `_autoCheckMaintenanceDue`, `_checkEscalationMaintenanceOverdue` are all **machines-only** — vehicle maintenance has zero automation/escalation coverage. `_autoCheckFuelAnomaly` is the inverse — **vehicles-only**, silently never checks machine fuel for anomalies. EPM has no vehicle-side "Operations" KPI at all. No unified vehicle+machine executive dashboard or CSV export exists (two separate CSVs from two separate department dashboards). |

## 5. Security Review

**Permission model**: `mustRole(user, pageId)` is the established pattern (role_definitions-driven). Of the 44 Fleet & Equipment functions in `data.js`:
- **30 use `mustRole` cleanly.**
- **6 still use the hardcoded-role-array anti-pattern** the project already fixed on their sibling functions in the same file (`machineCategoriesCreate`, `machinesCreate/Update/Delete`, `machineCategoriesUpdate/Delete` all carry an explicit "Phase 1 — was a hardcoded role array, decoupled" comment — but these 6 were missed): `machineLogCategoriesCreate` (`data.js:9295`, `['admin','operations','supervisor']`), `machineLogCategoriesDelete` (`9308`, `['admin','operations']`), `machineKpiDefinitionsCreate` (`9475`), `machineKpiTargetsSave` (`9514`), `machineKpiDefinitionsUpdate` (`9741`), `machineKpiDefinitionsDelete` (`9761`) — the latter four all `['admin','operations','ceo']`.
- **5 use `mustRole('machine-fuel') || <hardcoded array>` as an OR-fallback** (`machineFuelSummary:5787`, `machineFuelLogsList:5865`, `machineFuelLogsCreate:5887`, `machineFuelLogsUpdate:9841` all `['admin','ceo','operations','logistics','supervisor']`; `machineFuelLogsDelete:5908` uses a *different*, narrower array `['admin','ceo','operations','logistics']` missing `'supervisor'` — an internal inconsistency where a supervisor who can list/create/update a machine fuel log cannot delete one via this fallback path).
- **`vehicles` CRUD bypasses the governance/approval workflow entirely**: `vehiclesUpdate` (`data.js:3844`) and `vehiclesDelete` (`5315`) never call `applyGovernance`, unlike `machinesUpdate`/`Delete` (governed) and `maintenanceUpdate`/`Delete`, `machineFuelLogsUpdate`/`Delete` (all governed). A workshop-restricted or time-limited user's vehicle edits/deletes are never queued for approval the way an equivalent machine edit would be.
- **`MODULE_PERMISSION_CHECK`** (`data.js:1149-1168`) has no entries for `vehicles`, `fuel_logs`, `maintenance_records`, `machine_categories`, `machine_kpi_definitions`, `machine_kpi_targets`, or `machine_fuel_logs` — the per-record audit-history feature (`logisticsRecordHistory`) is unreachable for most Fleet & Equipment entities even where a UI might expect it (only `machines`, `machine-logs`, `machine_maintenance_schedules` are covered).
- **`Workshop isolation` is inconsistent**: `machinesList`, `machineLogsList`, `machineKpiPerformance`, `machineFuelSummary` are correctly workshop-scoped via `isWorkshopRestricted`; `machineMaintScheduleList/Create/Update/Delete` and `machineFuelLogsList/Create/Update/Delete` perform **no workshop check at all**, despite being siblings of functions that received exactly this fix per "Phase 1 (Workshop audit finding)" comments elsewhere in the file.
- **`vehicles` has no workshop concept to isolate** (no `workshop_id` column) — this may be intentional (vehicles are a company-wide fleet, not workshop property) but should be confirmed as a deliberate business decision, not an oversight, before Phase 1 work assumes it.
- **REST-layer security gap (real, not theoretical)**: `mobile-api/routes/meta.js:43-56`'s `GET /vehicles` runs a direct `pool.query` with the explicit comment "no permission restriction — just needs valid JWT," bypassing `mustRole('vehicles')` entirely. Any authenticated mobile user of any role can read the full active-vehicle registry (registration, make/model, category, assigned driver, status) regardless of whether their role holds the `vehicles` page permission.
- **IPC parameter-forwarding bugs** (not a security hole, but a data-integrity/audit gap): `electron/main.js:499` (`vehicles:delete`) and `:504` (`fuel-logs:delete`) both drop the `reason` parameter their `data.js` functions accept — desktop deletions of a vehicle or a fuel log always log `reason: undefined` in the audit trail, while every sibling delete handler (`maintenance:delete`, `machine-logs:delete`, `machine-fuel:delete`) and the mobile REST routes correctly forward it. **Verified directly**: `electron/main.js:499` reads `(userId, { vehicleId }) => data.vehiclesDelete(userId, vehicleId)` — confirmed no `reason` in scope.
- **Route-layer double-gating is inconsistent but not a real bypass**: `mobile-api/routes/fuel.js`'s machine-fuel routes and all of `mobile-api/routes/machineLogs.js` have no `requireRoles()` middleware at all, relying solely on `data.js`'s own internal gate — every other Fleet route double-gates with `requireRoles` first. Since `data.js` still enforces its own check, this is a defense-in-depth inconsistency, not an actual vulnerability.

## 6. Mobile/Desktop Parity

| Capability | Desktop | Mobile |
|---|---|---|
| Vehicle list/search/filter | List only, **no search/filter/sort at all** | List + global search only (no inline filter chips) |
| Vehicle detail view | **Does not exist** (edit form doubles as "detail") | Exists, richer than desktop — full fields + embedded fuel/maintenance sub-lists + delete |
| Vehicle delete | Yes (hard delete, ungoverned) | Yes (same backend function) |
| Machine list/search/filter/bulk | Full toolkit (search/filter/sort/bulk status-update) | Search + status chips; **no sort, no bulk** |
| Machine detail + audit history | Yes (facts + `_loadLogisticsHistoryInto`) | Detail exists but **no audit-history section** (the generic `LogisticsHistoryCard`/`EP.LOGISTICS_HISTORY` mechanism exists and works elsewhere in the app — e.g. Deliveries — but was never wired to Machine/Vehicle detail) |
| Machine delete | Yes | **No — no `useMachineDelete` hook, no REST route, no mobile UI at all** |
| Machine maintenance schedule | Full CRUD (`openMachineMaintOverlay`) | Create-only; no edit/delete |
| Machine Daily Logs | Full toolkit + governance/pending-approval panel + soft-delete-with-approval | List (no search) + create + **read-only detail with no edit/delete/approval UI at all** |
| KPI Performance | Rich dashboard (achievement, utilization/production charts, "machine intelligence" downtime/attention callouts) | Exists (a documented "Phase 1 Workshop parity fix") but no month picker despite hook support, no "machine intelligence" callouts |
| Machine fuel reconciliation (issued vs. consumed) | Full report (per-machine + daily breakdown) | **No equivalent — mobile only shows a flat chronological list**, no reconciliation/variance view at all |
| Vehicle fuel | One path (embedded in Vehicle Detail) | **Two parallel paths** — embedded in Vehicle Detail *and* a separate standalone "Vehicle Fuel" module with a different hook/endpoint, reachable by a narrower, non-overlapping role set (`logistics` non-officer only) |
| Offline queue support | N/A (desktop is always "online" to its local DB) | **None of the 9 Fleet & Equipment create/edit screens support offline queueing** — every one hard-blocks with an "Online Required" alert, unlike Material Requests and 6 other modules that queue and sync later |
| REST coverage gaps | — | No route for `maintenanceUpdate`, `machinesDelete`, `machineMaintScheduleUpdate/Delete`, `machineKpiDefinitions*`/`machineKpiTargets*` CRUD, `machineLogsUpdate/Delete`, `machineFuelSummary`, `machineFuelLogsUpdate/Delete` |
| Role reach | All 5 areas reachable from `NAV`, scattered across 3 different top-level sections | **No single role reaches all 5 mobile stacks.** `supervisor` has zero Fleet access. `mechanician` (who logs daily machine activity) cannot see the Machine Registry or KPI Performance for the machines it logs against. |

## 7. UI/UX Review

Benchmarked against the enterprise toolkit already standard in Procurement/Logistics/Workshop/Inventory (`procFilterBarHtml`, `applyProcListFilters`, `wireSortableTable`, `.bulk-bar`, `insertPendingPanel`, `_lgdWidget`, `_loadLogisticsHistoryInto`/`_statusTimelineHtml`, `.smo-tabs`, `skeletonTableRows()`):

| Page | Search/Filter | Sort | Bulk | Detail overlay | Audit history | Governance panel | Loading state |
|---|---|---|---|---|---|---|---|
| `renderVehicles` (9421) | **None** | **None** | **None** | **None** (edit form only) | **None** | **None** | No skeleton, no spinner text |
| `renderMachines` (11325) | Full | Full | Status-update only | Yes | Yes | No | Spinner text (no skeleton rows) |
| `renderMachineLogs` (11837) | Full | Full | **None** | Yes | Yes | **Yes** (only Fleet page with one) | Spinner text |
| `renderMachineKpi` (12233) | Partial (no KPI-name filter) | Full | N/A | Minimal (history only, no facts card) | Yes | No | Spinner text |
| `renderMachineFuelLogs` (13214) | **None** | **None** | **None** | **None** | No | Deletion panel only | Spinner text |

- `renderVehicles` and `renderMachineFuelLogs` are the two clear outliers — both are functionally rich (Vehicles has fuel/maintenance sub-forms, Fuel Logs has reconciliation reports) but neither has any list-management capability at all, a stark contrast to `renderStockMovements`/`renderStockTransfers` in Inventory or `renderMachines` within this same department.
- **No dedicated Fleet & Equipment executive dashboard exists.** The `NAV` array's "Fleet & Equipment" section (renderer/app.js:158-161) contains only Machine Registry, Fuel Logs, and Vehicle Fleet — Machine Daily Logs is filed under **Operations**, and KPI Performance under **Reports & Finance**, so a user browsing "Fleet & Equipment" won't find two of its five pages there at all.
- The nearest thing to a Fleet dashboard is embedded inside `renderWorkshopOverview` (nav id `workshop-overview`, section "Workshop & Inventory" — not Fleet) — it gives machines four KPI widgets but vehicles only one ("Fleet Alerts"), with no vehicle availability %/utilization figures to match what machines get.
- Empty states are consistently friendly (icon + helpful message) across all five pages — this part meets the enterprise standard everywhere. Loading states do not: no Fleet page uses `skeletonTableRows()`, the pattern already established elsewhere (e.g. Procurement's supplier list).

## 8. Reporting Review

- **Fleet KPIs**: Vehicle KPIs exist only on `renderVehicles` itself (fleet size/active/in-maintenance/fuel cost) — not surfaced anywhere else. Machine KPIs are richer and surfaced in three separate places (`renderMachines`, `renderMachineKpi`, `renderWorkshopOverview`) with no single canonical source.
- **Fuel KPIs**: machine-side reconciliation (issued vs. consumed, variance) exists and is genuinely good; vehicle-side is just a running total, no reconciliation concept.
- **Maintenance KPIs**: machine-side has "on-time completion %" (EPM `ops-maintenance-compl`); vehicle-side has none.
- **Downtime**: machine-only (`machine_daily_logs.downtime_hours`) — vehicles have no downtime concept at all.
- **Utilization/Availability**: machine-only (`machineKpiPerformance`, EPM `ops-machine-avail`) — no equivalent vehicle utilization/availability % anywhere, despite Vehicles' own KPI row implying the data exists to compute one (Active count is there; a true % of fleet-days available is not).
- **Operating Costs**: no combined figure exists (§4 Finance) — this is the single largest reporting gap found.
- **Executive Reports**: `getCeoOverview` — counts only, no costs, no fuel/maintenance figures.
- **CSV exports**: two separate exports (`logistics_operational_report_*.csv` for vehicles/fuel, `workshop_operational_report_*.csv` for machines/maintenance) — no unified Fleet & Equipment export.
- **Dashboard widgets**: `_lgdWidget`-based widgets exist for machines (4 widgets on Workshop Overview) but only 1 for vehicles.
- **Forecasting**: genuine statistical forecasting exists for combined vehicle+machine fuel (`_biPredictFuelConsumption` — mean/stddev/trend/Z-score). Machine maintenance "prediction" is really just a 14-day threshold filter on a manually-entered `next_due` date, not a real forecast. **No forecasting of any kind exists for vehicle maintenance** — `next_due_date` is always manually entered with no model behind it.

## 9. Critical Issues

**CRITICAL-01 — Stock Catalog item deletion is broken (crash, not graceful denial).**
`_stockItemUsageCount` (`data.js:5276-5292`, called live from `stockItemsDelete` at `5305` and a second deletion path at `5000`) queries `select count(*) from wk_consumption where catalog_item_id=$1` and `select count(*) from machine_fuel_logs where stock_item_id=$1`. Exhaustive grep of `db/schema.sql` and `db/migrate.js` confirms **neither `wk_consumption` nor a `stock_item_id` column on `machine_fuel_logs` is ever created anywhere in the tracked schema**. Any call to `stockItemsDelete` will throw a raw Postgres "relation/column does not exist" error instead of the intended graceful block message. *Live-DB confirmation was attempted but the database was transiently unreachable during this audit — re-verify with a direct query before scheduling a fix, but treat as high-confidence.* This is an Inventory-module bug surfaced by auditing a Fleet table's phantom reference — worth fixing regardless of which department "owns" it.

**CRITICAL-02 — Mobile vehicle registry has no permission check.**
`mobile-api/routes/meta.js:43-56`, `GET /vehicles`, queries `vehicles` directly with no `requireRoles()` and no call into `mustRole('vehicles')` — the code comment explicitly states "no permission restriction — just needs valid JWT." Any authenticated mobile user, regardless of role, can read the full active-vehicle registry. Every other vehicle-reading path in the app (desktop, and every other mobile route) enforces `mustRole('vehicles')`/`VEHICLE_ROLES`.

## 10. High Priority Issues

1. **`vehicles` CRUD bypasses the governance/approval workflow entirely** — `vehiclesUpdate`/`vehiclesDelete` never call `applyGovernance` (`data.js:3844`, `5315`), unlike every sibling table in this department.
2. **`vehiclesDelete` is a hard delete that cascades hard-deletes `fuel_logs` and `maintenance_records`** (`data.js:5321-5322`) — permanent loss of operating history, inconsistent with the soft-delete convention used everywhere else including `maintenanceDelete`/`machineLogsDelete`/`machineFuelLogsDelete` in this same department.
3. **`renderVehicles` and `renderMachineFuelLogs` have zero list-management capability** (no search/filter/sort/bulk/detail-overlay) despite being two of the department's most-used pages — a stark gap versus the enterprise standard already achieved on every other department's equivalent pages.
4. **No unified Fleet & Equipment executive dashboard**, and 2 of the department's 5 pages (Machine Daily Logs, KPI Performance) are filed under unrelated nav sections (Operations, Reports & Finance) instead of "Fleet & Equipment."
5. **Machine status vocabulary is inconsistent within the same function** (`'Under Maintenance'`/`'In Use'` vs `'Maintenance'`/`'Breakdown'`, both used inside `workshopOverview`) with no CHECK constraint — whichever literal the create/edit UI actually writes, one entire set of dashboard counters is silently reading zero right now. This should be confirmed and fixed early in Phase 1, before any new machine-status reporting is built on top of it.
6. **No workshop-scoping on `machine_maintenance_schedules`/`machine_fuel_logs` CRUD** despite sibling functions receiving exactly this fix — a workshop-restricted user can currently view/create/edit/delete fuel logs and maintenance schedules for machines outside their own workshop.
7. **`machineLogsCreate` doesn't verify the logging user's workshop matches the target machine's workshop** — attributes `workshop_id` from the machine, not the user, with no cross-check.
8. **No cost roll-up anywhere combines vehicle + machine + fuel + maintenance into an "operating cost"/"asset cost" figure**; `vehicles.purchase_cost` is read nowhere outside its own CRUD screen. This is the single largest Finance/Management visibility gap.
9. **Fuel has no relationship to Inventory's stock system at all** — a fully parallel, disconnected accounting system, with no stock item representing fuel and no consumption debiting `stock_levels`.
10. **No spare-parts-to-maintenance-job linkage** — a mechanic cannot request a part *for* a specific maintenance job via the existing Material Request flow (no `machine_id`/`vehicle_id` column on `material_requests`).
11. **Vehicle maintenance has zero automation/escalation coverage** — `_autoCheckMaintenanceDue`/`_checkEscalationMaintenanceOverdue` are machines-only; `_autoCheckFuelAnomaly` is the inverse (vehicles-only, never checks machine fuel) — no single automated check covers the whole fleet for either concern.
12. **Mobile: no machine delete capability at all** (no hook, no route, no UI).
13. **Mobile: duplicate vehicle-fuel data path** (two hook files, two endpoints, non-overlapping role reach) for the same underlying fact — a data-consistency risk.
14. **Mobile: zero offline-queue support** for any of the 9 Fleet & Equipment create/edit screens, unlike Material Requests and 6 other modules.
15. **Mobile: no single role reaches all 5 Fleet & Equipment areas** — `supervisor` has none at all; `mechanician` (who generates the daily logs and fuel entries that drive machine KPIs) cannot see the Machine Registry or KPI Performance screens for the same machines.
16. **Driver assignment is not a real workflow** — two overlapping free-text driver fields on `vehicles` with no assignment history, and never auto-populated/validated by any dispatch function.

## 11. Medium Priority Issues

1. Six functions still use hardcoded role arrays instead of `mustRole` (`machineLogCategoriesCreate/Delete`, `machineKpiDefinitionsCreate/Update/Delete`, `machineKpiTargetsSave`) — the anti-pattern already fixed on their sibling functions in the same file.
2. Five `machine-fuel` functions use `mustRole('machine-fuel') || <hardcoded array>`, with `machineFuelLogsDelete`'s array inconsistently missing `'supervisor'` versus its four siblings.
3. `MODULE_PERMISSION_CHECK` missing entries for `vehicles`/`fuel_logs`/`maintenance_records`/`machine_categories`/`machine_kpi_definitions`/`machine_kpi_targets`/`machine_fuel_logs` — per-record audit history unreachable for most of the department.
4. Many `logAudit` calls in this area omit the structured `{module, actionType, recordId}` opts needed for the audit-history feature to find them even where the module key does exist.
5. `maintenance_records.workshop_id` is a dead column — added, never read or written.
6. IPC drops `reason` on `vehicles:delete`/`fuel-logs:delete` (desktop-only; REST already correct).
7. No REST route for `maintenanceUpdate`, `machinesDelete`, `machineMaintScheduleUpdate/Delete`, `machineKpiDefinitions*`/`machineKpiTargets*` CRUD, `machineLogsUpdate/Delete`, `machineFuelSummary`, `machineFuelLogsUpdate/Delete` — desktop/mobile parity gaps.
8. `machineFuelLogsUpdate` cannot edit a fuel log originally recorded against a vehicle (requires `machine_id`, ignores `vehicle_id` entirely in its `UPDATE`).
9. Mobile `MachineLogDetailScreen` is read-only with no edit/delete/approval UI, unlike desktop's governed soft-delete workflow for the same entity.
10. Mobile `MachineKpiPerformanceScreen` has no month picker despite the underlying hook supporting one.
11. No CSV/report unifies vehicles and machines — two separate exports from two separate dashboards.
12. Two-driver-field ambiguity on `vehicles` (see High-16) is also a data-model smell worth resolving even independent of the workflow gap.

## 12. Low Priority Improvements

1. Search field coverage gaps: Machines' search omits manufacturer/model/serial number; Machine Logs' search omits product_type/downtime_reason; KPI Performance's search doesn't cover KPI name.
2. `renderVehicles`/`renderMachineFuelLogs` use spinner-text loading instead of `skeletonTableRows()`.
3. Mobile Vehicle/Machine detail screens don't wire the existing, working `LogisticsHistoryCard`/`EP.LOGISTICS_HISTORY` mechanism (already used by Deliveries) into their own detail screens.
4. `mobile-api/routes/fuel.js`'s machine-fuel routes and all of `mobile-api/routes/machineLogs.js` lack `requireRoles()` middleware for defense-in-depth (data.js's own gate still applies — not a real vulnerability, just inconsistent with sibling route files).
5. `renderMachineKpi`'s detail overlay is the thinnest of the department's five (history only, no facts card).

## 13. Production Readiness Assessment

**Fleet & Equipment is not production-ready relative to the standard already achieved elsewhere in this ERP.** It is functionally usable today — vehicles and machines can be registered, fuel and maintenance logged, and reasonable reporting exists for the machine side — but it has: one live crash bug (Critical-01), one real unauthenticated-by-role data-exposure gap on mobile (Critical-02), a governance/approval bypass on an entire table (vehicles), a permanent-data-loss delete path, inconsistent workshop isolation across sibling functions, and two pages (Vehicles, Machine Fuel Logs) with none of the list-management UI the rest of the app's users now expect by default. This is a materially larger gap than Procurement/Logistics/Workshop/Inventory had at the start of their own audits, each of which needed a full audit→3-phase cycle before reaching Production Ready status.

## 14. Recommended Phase 1 (Architecture, Security, Consistency)

Mirroring how Inventory Phase 1 was scoped (consolidation + critical security, not new features):
1. Fix Critical-01 (`_stockItemUsageCount` phantom references) and Critical-02 (mobile `/vehicles` permission bypass) — both are small, isolated fixes with no workflow redesign.
2. Decouple the 6 remaining hardcoded-role-array functions to `mustRole`, and reconcile the `machineFuelLogsDelete` array inconsistency.
3. Add `applyGovernance` to `vehiclesUpdate`/`vehiclesDelete`, and convert `vehiclesDelete` to the soft-delete pattern already used by `maintenanceDelete`/`machineLogsDelete`/`machineFuelLogsDelete` (matching, not redesigning, the existing convention).
4. Add workshop-scoping to `machineMaintScheduleList/Create/Update/Delete` and `machineFuelLogsList/Create/Update/Delete`, and add a workshop cross-check to `machineLogsCreate` — same fix pattern already applied to their siblings.
5. Resolve the `machines.status` vocabulary inconsistency (confirm the actual UI-written value, then make every reader consistent, or add a CHECK constraint) before any new machine-status reporting is built.
6. Fix the two IPC `reason`-forwarding drops.
7. Add `MODULE_PERMISSION_CHECK` entries for the missing Fleet & Equipment modules so per-record audit history becomes reachable.
8. Confirm with the business whether the "Fuel Request → Approval → Issue" workflow described in the audit brief is a genuine intended gap to build, or whether the current "log fuel as already issued" model is correct as-is — this materially changes Phase 2 scope.

## 15. Recommended Phase 2 (UI/Functional Completion, Enterprise Parity)

1. Bring `renderVehicles` and `renderMachineFuelLogs` up to the same toolkit standard as `renderMachines`/`renderMachineLogs` (search/filter/sort, detail overlays with audit history, bulk actions where applicable).
2. Build a genuine Vehicle detail overlay on desktop (currently the edit form doubles as detail) — mobile's `VehicleDetailScreen` is a good reference for what fields/sections to include.
3. Consolidate the department's navigation — either move Machine Daily Logs and KPI Performance into the "Fleet & Equipment" nav section, or build a single Fleet & Equipment landing dashboard that links out to all five pages, matching how other departments present a coherent single entry point.
4. Close the REST parity gaps listed in Medium-7 so mobile can reach every desktop-capable mutation.
5. Add machine delete to mobile; add edit/delete/approval UI to `MachineLogDetailScreen`; add offline-queue support to Fleet & Equipment's create/edit screens, matching Material Requests' pattern.
6. Resolve the duplicate vehicle-fuel mobile surface — pick one path (the Vehicle-Detail-embedded one is reachable by a broader role set) and retire the other, or clearly differentiate their purposes if both are genuinely needed.
7. Add a vehicle utilization/availability % KPI to match what machines already have, and a vehicle-side "on-time maintenance completion" KPI to match EPM's machine equivalent.

## 16. Recommended Phase 3 (Intelligence, Cross-Department Integration, Production Readiness)

1. Build the combined "operating cost"/"asset cost" KPI (vehicle purchase/maintenance/fuel + machine maintenance/fuel) — the single largest visibility gap found, and the natural Phase 3 deliverable given every other department's Phase 3 focused on exactly this kind of executive-visibility work.
2. Extend `_autoCheckMaintenanceDue`/escalation to cover vehicle maintenance (using `maintenance_records.next_due_date`), and extend `_autoCheckFuelAnomaly` to also watch `machine_fuel_logs` — closing the asymmetric automation coverage found in §10.
3. Design (with the business, not unilaterally) whether/how spare-parts-to-maintenance-job linkage and fuel-as-inventory-stock should work, given both are currently deliberate-looking absences rather than obvious oversights — these are the two integration gaps most likely to represent real intended future scope rather than defects.
4. Build genuine vehicle-maintenance forecasting (mirroring `_biPredictFuelConsumption`'s statistical approach) rather than the current "manually enter next_due_date" model, using historical maintenance intervals per vehicle.
5. Unify the two CSV exports into one Fleet & Equipment executive report, and extend `getCeoOverview` to include fleet cost figures alongside the existing counts.
6. Only after the above: consider whether Procurement should gain a "register resulting vehicle/machine" step when a PO's line item represents a fleet asset — a genuine cross-department workflow question for the business, not a code-only fix.

## 17. Final Recommendation

Treat Fleet & Equipment the same way Inventory was treated: **do not skip straight to Phase 2/3 feature work.** The two Critical issues (a live crash bug and a real permission bypass) should be fixed first and independently, as soon as approved, since they're small and isolated. The rest of Phase 1 (governance/workshop-scoping consistency, hardcoded-role cleanup) should follow before any UI/functional work begins, exactly as it did for Procurement, Logistics, Workshop, and Inventory — otherwise Phase 2's UI work would be built on top of the same inconsistent security/governance foundation this audit found. Two items need a business decision, not just an engineering fix, before Phase 1/2 scope is finalized: whether "Fuel Request → Approval → Issue" is a real intended workflow, and whether Vehicles should gain a `workshop_id` (i.e., should vehicles ever be workshop-owned, or are they correctly company-wide as-is).

**Awaiting approval before beginning Fleet & Equipment Phase 1.**
