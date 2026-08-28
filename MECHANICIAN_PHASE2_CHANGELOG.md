# Mechanician — Phase 2 Changelog

Operational Capability Restoration. See `MECHANICIAN_PHASE2_COMPLETION_REPORT.md` for full detail, reasoning, and testing evidence.

## Database (migration applied to live DB via `npm run migrate`)

- `db/migrate.js`
  - `mechanician` role granted `machine-logs`, `machine-fuel`, `machine-maintenance`.
  - New `machine-maintenance` permission key also granted to `admin`, `ceo`, `operations`, `logistics`, `supervisor`, `sawmill-leader`, `poles-leader` — every role that already held `machines`/`machine-logs` at the time, verified live before granting (mirrors existing access, doesn't broaden it).

## Backend

- `db/services/data.js`
  - New `machineMaintScheduleListAll(userId, workshopId)` — cross-machine read of `machine_maintenance_schedules`, gated on `machines`/`machine-logs`/`machine-maintenance`, workshop-scoped for restricted users, returns a `canManage` flag. Exported.
  - `mechanicianDashboard()` — extended with two new widgets: `myMaintenanceActivity` (this user's recent `machine_daily_logs`) and `myFuelActivity` (this user's recent `machine_fuel_logs`), both date-formatted consistently with the rest of the function.

## Electron

- `electron/main.js`, `electron/preload.js` — `machine-maint:list-all` IPC channel + `machineMaintListAll` preload method.

## Mobile API

- `mobile-api/routes/machines.js` — new `GET /api/machines/maintenance-schedules`, gated with its own explicit, DB-verified role list (`MAINT_SCHEDULE_ROLES`), registered before `/:id`.

## Desktop (`renderer/app.js`)

- New NAV entry `machine-maintenance` ("Maintenance Schedule") under Fleet & Equipment.
- New `renderMachineMaintenance()` — full enterprise toolkit (search/filter/sort/KPI cards), inline edit/delete for `machines` holders, read-only list otherwise.
- `renderMechanicianDashboard()` — two new `_lgdWidget`s (My Recent Maintenance Activity, My Recent Fuel Activity).
- `renderer/index.html` — new `#page-machine-maintenance` container.

## Mobile

- `mobile/src/types/api.ts` — `MaintScheduleWithMachine`, `MaintScheduleListAllResponse`, extended `MechanicianDashboardResponse.widgets`.
- `mobile/src/api/endpoints.ts` — `MACHINES_MAINT_SCHEDULES_ALL`.
- `mobile/src/hooks/useMachines.ts` — new `useMaintScheduleListAll()`.
- New `mobile/src/screens/machines/MachineMaintScheduleListScreen.tsx` — search, status chips, card list (read-only).
- `mobile/src/screens/mechanician/MechanicianDashboardScreen.tsx` — two new `OpsWidget`s mirroring desktop.
- `mobile/src/navigation/types.ts` — `MechanicianTabParamList` extended with `MachineLog`, `MachineFuel`, `MaintSchedule`.
- `mobile/src/navigation/MechanicianNavigator.tsx` — `MachineLogStack`/`MachineFuelStack` restored (same stacks Supervisor already uses), new `MaintSchedule` tab added.
- `mobile/src/utils/permissions.ts` — mechanician's client-side flags gained `machine.log`/`fuel.machine` back (now genuinely functional, unlike when removed in Phase 1).

## Verification

- `node --check`: clean on `db/migrate.js`, `db/services/data.js`, `electron/main.js`, `electron/preload.js`, `mobile-api/routes/machines.js`, `renderer/app.js`.
- `npx tsc --noEmit` (mobile): clean.
- Live end-to-end test (4 throwaway QA accounts + 1 throwaway stock item, all removed after): confirmed mechanician can now read maintenance schedules, create machine logs, and create fuel logs; confirmed mechanician still cannot create/edit schedules; confirmed workshop isolation still blocks cross-workshop logging; confirmed dashboard widgets populate correctly; re-ran the full material request lifecycle (create→approve→dispatch→receive) to confirm no regression from Phase 1.

## Outstanding (not fixed this phase — see report §8)

- Mobile Notifications still has no screen for any non-CEO role — systemic, unchanged.
- `machineMaintScheduleCreate/Update/Delete` remain `machines`-only — deliberate.
- Completion states, spare-parts linkage, labor tracking, cost tracking, completion evidence — all explicitly out of scope, Phase 3 territory pending a business decision.
- Officer/Assistant split — not created, per the audit's recommendation.
- A pre-existing, unrelated inconsistency in `mobile-api/routes/machines.js`'s `MACHINE_ROLES` array (excludes some roles that hold `machines`/`machine-logs` in the DB) was found but not fixed — the new route was given its own accurate role list instead of inheriting the gap.

## Not committed

Per standing release discipline, none of the code above has been committed or pushed. The database migration itself (permission grants) was applied live, as noted in the completion report.
