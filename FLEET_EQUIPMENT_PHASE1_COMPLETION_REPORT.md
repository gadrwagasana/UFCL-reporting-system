# Fleet & Equipment — Phase 1 Completion Report

Critical Fixes, Security, Enterprise Governance & Architecture Completion. Implements the approved `FLEET_EQUIPMENT_ENTERPRISE_AUDIT.md`. No business workflows were redesigned, no operational logic changed, no new UI/dashboards/analytics were added — those are Phase 2/3.

## 1. Executive Summary

Fleet & Equipment's two Critical audit findings are fixed and live-verified: `stockItemsDelete` no longer crashes on a phantom table/column reference, and the mobile vehicle-metadata endpoint now enforces the same permission desktop already does. Vehicles gained the same governance/audit/soft-delete foundation every other Fleet table already had (machines, maintenance records, machine fuel logs) — no more silent hard deletes that destroyed fuel and maintenance history. Six functions with hardcoded role arrays were decoupled to the project's standard `mustRole` pattern, closing an inconsistency the audit flagged. Workshop isolation was extended to four function groups that had none. Three machine-status dashboard/KPI counters that were silently reading zero (checking for status literals that are never actually written) now read correctly. And a real, previously-undiscovered bug was found and fixed during implementation: the mobile REST layer's shared response helper was swallowing every governed action's "submitted for approval" response and turning it into a generic error — this affected fuel logs and maintenance records already, not just the new vehicle governance work.

Two items surfaced during implementation that are **not** fixed here, by design — they need a business decision, not an engineering judgment call, and Phase 1's rules are explicit about not redesigning workflows or business logic unilaterally. Both are detailed in §9.

## 2. Critical Fixes

### 2.1 Stock Catalog item deletion no longer crashes

`_stockItemUsageCount` (`db/services/data.js`, used by `stockItemsDelete`) queried a `wk_consumption` table and a `machine_fuel_logs.stock_item_id` column that do not exist anywhere in the tracked schema. Confirmed by exhaustive grep of `db/schema.sql` + `db/migrate.js`, and live-tested: before the fix this call would throw a raw Postgres error instead of the intended "cannot delete — N linked records" response. The two invalid clauses were removed (fuel logs, machine or vehicle, have no real link to `stock_catalog` — fuel is its own separate ledger, confirmed during the original audit and unchanged by the "no Fuel Request workflow" business decision for this phase).

**Live-verified**: a clean (unreferenced) test item deleted successfully with no crash; a referenced test item was gracefully blocked with a clear message ("Cannot delete — this item has 1 linked record(s)...").

### 2.2 Mobile vehicle registry no longer bypasses permissions

`mobile-api/routes/meta.js`'s `GET /vehicles` previously ran a direct, unrestricted database query ("no permission restriction — just needs valid JWT" per its own comment), letting any authenticated mobile user of any role read the full active-vehicle registry (registration, driver assignment, status). Now gated with `requireRoles(...VEHICLE_ROLES)` using the exact same role set (`admin, ceo, logistics, logistics-officer`) that `mobile-api/routes/vehicles.js` already uses and that resolves to desktop's `mustRole('vehicles')` gate. (This endpoint constant, `EP.META_VEHICLES`, was confirmed unused anywhere in the current mobile app — the fix carries zero risk of breaking an existing screen.)

## 3. Security Fixes

- **Six hardcoded role arrays decoupled to `mustRole`**, matching the pattern already applied to their sibling functions in the same file (`machinesCreate/Update/Delete`, `machineCategoriesUpdate/Delete` each already carry a "Phase 1 — was a hardcoded role array, decoupled" comment from an earlier phase — these six were missed):
  - `machineLogCategoriesCreate`/`Delete` — now `mustRole('machine-logs') || mustRole('machines')`, matching `machineLogCategoriesList`'s own gate.
  - `machineKpiDefinitionsCreate`/`Update`/`Delete`, `machineKpiTargetsSave` — now `mustRole('machine-kpi') || mustRole('machines')`, matching `machineKpiDefinitionsList`/`machineKpiTargetsList`'s own gate.
- **Five `machine-fuel` functions had their redundant hardcoded-array OR-fallback removed**: `machineFuelSummary`, `machineFuelLogsList/Create/Update/Delete` previously used `mustRole('machine-fuel') || ['admin','ceo','operations','logistics','supervisor'].includes(user.role)` (with `machineFuelLogsDelete`'s array inconsistently missing `'supervisor'`). Verified live against `role_definitions` that every role in every one of those arrays already holds the `machine-fuel` permission directly — the fallback never actually widened access for anyone; it was pure redundancy. Now a clean `mustRole('machine-fuel')` check, with the internal inconsistency eliminated as a side effect.
- **`mobile-api/routes/meta.js`'s `/vehicles` route** — see §2.2.

### Access-widening from the hardcoded-array decoupling (documented per the project's established transparency convention)

| Function | Old gate | New gate | Roles gaining access |
|---|---|---|---|
| `machineLogCategoriesCreate` | `admin, operations, supervisor` | `machine-logs` OR `machines` | ceo, poles-leader, sawmill-leader (hold `machine-logs`); logistics (holds `machines`) |
| `machineLogCategoriesDelete` | `admin, operations` | `machine-logs` OR `machines` | ceo, supervisor, poles-leader, sawmill-leader, logistics |
| `machineKpiDefinitionsCreate/Update/Delete`, `machineKpiTargetsSave` | `admin, operations, ceo` | `machine-kpi` OR `machines` | logistics (holds `machines`) |

These are all reference-data/configuration operations (log categories, KPI definitions/targets) — not operational business records — and the widened set already holds the page permission that gates the *list* view for the same data; this closes an access inconsistency rather than opening a new capability.

## 4. Governance Improvements

**Vehicles now carry the same governance/soft-delete/audit foundation as every other Fleet table** (matching `machinesUpdate`/`Delete`'s pattern exactly):

- `vehiclesUpdate` now calls `applyGovernance('vehicles', ..., 'edit', ...)` — a non-owner or a stale edit (>24h old, per the existing time-gated authorization rule shared by every governed table) now correctly requires manager/leader approval instead of applying instantly.
- `vehiclesDelete` now calls `applyGovernance('vehicles', ..., 'delete', ...)` and is a **soft-delete** (`deleted_at`/`deleted_by`/`deletion_reason`/`pending_deletion` columns, added via `SOFT_DELETE_TABLES`) instead of an ungoverned hard delete. Critically, it **no longer cascades hard-deletes of `fuel_logs` or `maintenance_records`** — since the vehicle row itself is preserved (moved to Trash, not removed), those child rows' foreign keys stay valid with no cascade needed, and `delivery_orders.vehicle_id` no longer needs nulling either. Fuel and maintenance history for a deleted vehicle is now permanently preserved and restorable.
- `fuel_logs` also gained soft-delete columns; `fuelLogsDelete` converted from a hard delete to the same governed soft-delete pattern as `maintenanceDelete`/`machineFuelLogsDelete`.
- A `vehicles.created_by` column was added (the table had none — `applyGovernance`'s ownership check needs one, and using the existing `created_by` convention every other governed table already has was more consistent than inventing a different owner column). Existing rows are `NULL` (no historical creator recorded); the governance engine already treats a null owner as "not the current user," routing pre-existing vehicles' edits/deletes to approval by default rather than crashing or silently auto-allowing them.
- Both `vehicles` and `fuel_logs` were added to `SOFT_DELETE_ALLOWED` and `TRASH_TABLES`, so deleted vehicles/fuel logs now appear in the standard admin Trash page and can be restored within 30 days, exactly like every other governed record.
- `MODULE_PERMISSION_CHECK` gained entries for `vehicles`, `fuel_logs`, `maintenance_records`, `machine_categories`, `machine_kpi_definitions`, `machine_kpi_targets`, `machine_fuel_logs` — the per-record audit-history lookup (`logisticsRecordHistory`) was previously unreachable for all of these.
- Structured `{module, actionType, recordId}` audit-log opts were added to several calls that were missing them (`vehiclesCreate/Update/Delete`, `fuelLogsCreate/Delete`, `maintenanceCreate/Update`, `machineLogCategoriesCreate`, `machineKpiDefinitionsCreate/Update/Delete`, `machineKpiTargetsSave`, `machineFuelLogsCreate/Update/Delete`) so these actions are now findable in the per-record audit-history view, not just the global audit log.
- **Workshop-scoping added** to four function groups that had none, matching the exact pattern already used by `machinesList`/`machineLogsList` (`isWorkshopRestricted(user)` + a workshop-match check):
  - `machineMaintScheduleList/Create/Update/Delete` — a workshop-restricted user can no longer view/create/edit/delete maintenance schedules for a machine outside their own workshop.
  - `machineFuelLogsList/Create/Update/Delete` — machine-targeted fuel-log entries are now scoped to the user's own workshop when restricted; vehicle-targeted entries remain visible company-wide (vehicles are not workshop-owned — confirmed business decision, see the Phase 1 prompt's approved decisions).
  - `machineLogsCreate` — now verifies the target machine's workshop matches the logging user's own workshop when restricted (previously attributed the log to the machine's workshop with no check that the user was allowed to log against it).
- **`machineFuelLogsUpdate` fixed to support vehicle-targeted entries** — it previously required `machine_id` unconditionally and never wrote `vehicle_id`, so a fuel log originally recorded against a vehicle could never be edited. Now mirrors `machineFuelLogsCreate`'s machine-or-vehicle handling.
- **Machine status vocabulary corrected** in three places that were silently reading zero for a status category because they checked literal values (`'In Use'`, `'Under Maintenance'`) that `machinesCreate`/`Update` never actually write (confirmed against `renderMachines`' own status dropdown, the true canonical vocabulary: `Available/Running/Maintenance/Breakdown`):
  - `workshopOverview`'s per-workshop `machines_maintenance` counter (was `status='Under Maintenance'`, now `status in ('Maintenance','Breakdown')`, matching the same function's own later, correct classification).
  - `getCeoOverview`'s machine breakdown (`in_use`/`maintenance` counters).
  - EPM's `ops-machine-avail` KPI (was `status IN('Available','In Use')`, now `IN('Available','Running')`).
- **Bonus fix, discovered during implementation**: `mobile-api/middleware/respond.js`'s shared `respond()` helper was treating a governed action's "queued for approval" response (`{ok:false, pendingApproval:true, message, level}`) as a hard error — collapsing it to a generic "An unexpected error occurred" and a non-2xx HTTP status, which caused axios to reject the request before the mobile hooks' own `pendingApproval` checks (already present in `useFuelLogDelete`/`useMaintenanceDelete`, and newly added to `useVehicleUpdate`/`useVehicleDelete`) ever ran. This was a real, pre-existing bug affecting fuel-log and maintenance-record governance on mobile already — not something introduced by this phase, but discovered and fixed while verifying the new vehicle governance end-to-end. Fixed with a small, isolated special-case in the shared helper (verified with a mock-response test — see §8); zero impact on desktop (which doesn't use this REST layer).
- **Two pre-existing desktop UI bugs fixed** (same class as the `respond()` bug — a governed response with no `.error` field being shown as "undefined"): `renderVehicles`' vehicle-edit save handler and `renderMachines`' machine-edit save handler both used to call `showOverlayError(r2.error)` unconditionally; both now use the existing shared `handleGovernanceResult()` helper that already correctly distinguishes a real error from a "submitted for approval" outcome.

## 5. Cross-Department Verification

Per Priority 4's instruction to verify, not invent — this is a confirmation pass, no code was changed:

- **Workshop**: unaffected by this phase beyond the `machines_maintenance` counter fix (§4) and the new workshop-scoping on maintenance-schedule/fuel functions (§4) — both are correctness fixes to existing behavior, not new integration.
- **Logistics**: vehicle FK relationships (`delivery_orders`, `transport_jobs`, `stock_transfer_dispatches`) are unaffected — vehicles are now soft-deleted rather than hard-deleted, so these FKs no longer need special handling on vehicle delete at all (previously `delivery_orders.vehicle_id` had to be manually nulled; now the vehicle row simply persists in a deleted state and the FK stays valid).
- **Inventory**: confirmed, no code change — fuel remains intentionally disconnected from `stock_catalog` (the approved Phase 1 business decision explicitly keeps the current Vehicle/Machine → Fuel Fill → Fuel Log → Reporting flow with no request/approval/stock-linkage step). No spare-parts-to-maintenance-job linkage exists or was added (confirmed a genuine gap in the original audit, correctly deferred — Priority 4 says "do not invent new workflows").
- **Procurement**: confirmed, no code change — vehicle/machine registration remains disconnected from Procurement, exactly as before. No genuine defect was found here to correct (the audit's own finding was "this integration point doesn't exist," which is a Phase 3 design question, not a Phase 1 defect).
- **Finance**: confirmed, no code change — no combined vehicle+machine "operating cost" KPI exists (audit finding, correctly deferred to Phase 3 per the audit's own recommendation).
- **Management**: the three machine-status counter fixes (§4) directly improve existing Executive/EPM visibility without adding any new report, dashboard, or workflow.

## 6. Mobile/Desktop Verification

- **`node --check`**: clean on `db/migrate.js`, `db/services/data.js`, `electron/main.js`, `electron/preload.js`, `mobile-api/routes/meta.js`, `mobile-api/routes/vehicles.js`, `mobile-api/middleware/respond.js`, `renderer/app.js`.
- **`npx tsc --noEmit`** (mobile): clean, both before and after the `useVehicles.ts`/`VehicleFormScreen.tsx`/`VehicleDetailScreen.tsx` governance-handling changes.
- **IPC parameter-forwarding fixed**: `electron/main.js`'s `vehicles:delete` and `fuel-logs:delete` handlers previously dropped the `reason` parameter entirely (destructured only `{ vehicleId }`/`{ logId }`); both now forward it, matching every sibling delete handler (`maintenance:delete`, `machine-logs:delete`, `machine-fuel:delete`) and the mobile REST routes, which were already correct.
- **Mobile governance parity**: `useVehicleUpdate`/`useVehicleDelete` now return `VehiclePendingApproval | void`, matching `useFuelLogDelete`/`useMaintenanceDelete`'s existing pattern. `VehicleFormScreen.tsx`'s edit-submit handler now checks for and displays a "Submitted for Review" alert on a pending-approval response (previously it silently discarded the result and always navigated back as if the edit had applied). `VehicleDetailScreen.tsx`'s delete flow was changed from a plain confirm dialog to a reason-required prompt (matching its own existing fuel-log/maintenance-delete pattern) with correct pendingApproval handling, and its confirmation copy was corrected to reflect the new soft-delete-with-preserved-history behavior instead of the old "fuel logs will be deleted" wording.

## 7. Files Modified

**Backend**
- `db/migrate.js` — `vehicles`/`fuel_logs` added to `SOFT_DELETE_TABLES`; `vehicles.created_by` column added.
- `db/services/data.js` — see §2–4 for the full list of touched functions (`_stockItemUsageCount`, `vehiclesList/Create/Update/Delete`, `fuelLogsList/Create/Delete`, `maintenanceCreate/Update`, `machineLogCategoriesCreate/Delete`, `machineKpiDefinitionsCreate/Update/Delete`, `machineKpiTargetsSave`, `machineFuelSummary`, `machineFuelLogsList/Create/Update/Delete`, `machineMaintScheduleList/Create/Update/Delete`, `machineLogsCreate`, `workshopOverview`, `getCeoOverview`, `_epmComputeCurrentValues`, `_biPredictFuelConsumption`, `_autoCheckFuelAnomaly`, `logisticsDashboard`, `businessIntelligenceDashboard`'s fuel-trend query, `MODULE_PERMISSION_CHECK`, `SOFT_DELETE_ALLOWED`, `TRASH_TABLES`).

**Electron**
- `electron/main.js`, `electron/preload.js` — `reason` forwarding fix for `vehicles:delete`/`fuel-logs:delete`.

**Mobile API**
- `mobile-api/routes/meta.js` — `/vehicles` permission fix.
- `mobile-api/routes/vehicles.js` — comment correction (soft-delete, not cascade).
- `mobile-api/middleware/respond.js` — `pendingApproval` response bug fix.

**Desktop**
- `renderer/app.js` — vehicle edit/delete handlers rewritten for governance; machine edit handler's pre-existing `showOverlayError(undefined)` bug fixed.

**Mobile**
- `mobile/src/hooks/useVehicles.ts` — `useVehicleUpdate`/`useVehicleDelete` governance-response handling.
- `mobile/src/screens/vehicles/VehicleFormScreen.tsx` — edit-submit pendingApproval handling.
- `mobile/src/screens/vehicles/VehicleDetailScreen.tsx` — delete flow rewritten (reason prompt + pendingApproval handling + corrected confirmation copy).

## 8. Live Testing Results

All testing used throwaway `_qa_fleet_*` accounts (deactivated afterward, never hard-deleted) and throwaway catalog items/machines/vehicles created solely for this testing, all removed afterward — nothing pre-existing was touched, per the project's live-DB-testing-safety discipline.

| Test | Result |
|---|---|
| `stockItemsDelete` on a clean (unreferenced) item | `{ok:true}` — no crash |
| `stockItemsDelete` on a referenced item | `{ok:false, error:'Cannot delete — this item has 1 linked record(s)...'}` — graceful block, no crash |
| `vehiclesCreate` sets `created_by` | Confirmed `created_by` = calling user's ID |
| `vehiclesUpdate` by the same (fresh) owner | `{ok:true}` — applies immediately, no approval required |
| `vehiclesDelete` | `{ok:true}` — soft delete; vehicle disappears from `vehiclesList`; raw row shows `deleted_at`/`deleted_by`/`deletion_reason` set |
| `trashList` / `trashRestore` for a deleted vehicle | Vehicle appears in Trash with correct label/reference; restore returns `{ok:true}` and the vehicle reappears in `vehiclesList` |
| `machineMaintScheduleCreate` by a workshop-restricted user for a machine in a *different* workshop | `{ok:false, error:'You can only schedule maintenance for machines in your own workshop'}` |
| `machineMaintScheduleList` for a machine in a different workshop | Correctly denied |
| `machineFuelLogsCreate` by a workshop-restricted user for a machine in a different workshop | `{ok:false, error:'You can only log fuel for machines in your own workshop'}` |
| `machineLogsCreate` by a workshop-restricted user for a machine in a different workshop | `{ok:false, error:'You can only log activity for machines in your own workshop'}` |
| Machine status counter fix — set a test machine to `'Running'`, query the raw `getCeoOverview` breakdown SQL directly | `in_use: 1` (previously would have read `0` querying the never-written `'In Use'` literal) |
| Machine status counter fix — set the same machine to `'Maintenance'`, call `workshopOverview` | `machines_maintenance: 1` for its workshop (previously would have read `0` querying `'Under Maintenance'`) |
| `respond()` `pendingApproval` fix — mocked `res` object, 3 cases | Case 1 (pendingApproval): HTTP 200, `data.pendingApproval` preserved through the full server→client unwrap round-trip. Case 2 (real error): unaffected, correct error status/shape. Case 3 (success): unaffected. |

One test uncovered a **pre-existing, unrelated bug** while probing `getCeoOverview`'s machine counters: that function's `monthly_approvals` query references a `status` column that doesn't exist on the live `monthly_approvals` table, so the *entire* `getCeoOverview` function currently throws for any admin/ceo caller, unrelated to anything in this phase. This is outside Fleet & Equipment's scope (a different module entirely) and was **not fixed** here — see §9. The machine-status-counter fix itself was verified by running the corrected SQL fragment in isolation, confirmed correct.

## 9. Outstanding Items

**Requiring a business decision (not fixed, per Phase 1 rules against redesigning workflows/business logic unilaterally):**

1. **`mechanician` role vs. its mobile navigator's screens.** `role_definitions.permissions` for `mechanician` is exactly `['dashboard', 'material-requests', 'notifications']`, and the role's own seeded description states: *"Requests spare parts and maintenance materials from the workshop store. Access limited to material requests only."* However, `mobile/src/navigation/MechanicianNavigator.tsx` gives this role navigation access to Machine Daily Logs and Machine Fuel screens — both of which require `mustRole('machine-logs')`/`mustRole('machine-fuel')`, which `mechanician` does not hold. In its current state, a `mechanician` user can navigate to those screens on mobile but every create/list action on them will be denied by the backend. This was not discovered during the original audit — it surfaced only while investigating the machine-fuel permission fallback arrays during this phase. **Needs a decision**: either grant `mechanician` the `machine-logs`/`machine-fuel` permissions (expanding its documented scope), or scope `MechanicianNavigator` down to match its documented "material requests only" intent (removing dead-end screens). Not fixed here since either direction is a real scope change, not a bug fix.
2. Confirmed still open from the audit, correctly deferred to Phase 3 per the audit's own recommendation: spare-parts-to-maintenance-job linkage, fuel-as-inventory-stock, vehicle/machine-to-Procurement linkage, combined operating-cost KPI. No code changes were made toward any of these in this phase.

**Discovered but out of scope for this phase (not fixed):**

3. `getCeoOverview` throws for any admin/ceo caller due to an unrelated `monthly_approvals.status` column reference that doesn't exist on the live table — a different module entirely, unrelated to Fleet & Equipment. Flagged here because it was encountered while live-testing the machine-status-counter fix, but left untouched since fixing it is outside this phase's scope and risks a business-logic judgment call about the Monthly Approvals module this phase wasn't scoped to make.
4. `machineFuelLogsUpdate` remains unreachable from any UI (desktop has no edit action for machine fuel logs at all — confirmed already in the original audit, and confirmed again here that no caller of the IPC-wired function exists anywhere in `renderer/app.js` or mobile). The function itself was fixed for correctness (§4) since it's shared, reachable-by-API infrastructure, but building the UI to actually use it is Phase 2 scope ("do not add dashboards/UI" per this phase's rules).

## 10. Recommendations

1. Take the `mechanician` role question (§9.1) to the business before Phase 2 begins — it affects what Phase 2's mobile Fleet parity work should even assume that role can do.
2. Consider fixing the unrelated `getCeoOverview`/`monthly_approvals` crash (§9.3) as a small, independent hotfix — it currently blocks the CEO Overview page entirely for every admin/ceo user, which is a more urgent, broader-impact issue than anything in Fleet & Equipment itself, but it's a different module's bug and shouldn't be bundled into this phase's changes.
3. Phase 2 (UI/Functional Completion) can now proceed on a secured, governed foundation — recommend starting with the two pages the audit found had zero list-management capability (`renderVehicles`, `renderMachineFuelLogs`), and building the desktop UI needed to actually reach `machineFuelLogsUpdate`.
4. No other blockers to Phase 2 were found.

## Not committed

Per standing release discipline, none of the above has been committed or pushed.
