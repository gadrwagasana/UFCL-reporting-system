# Workshop Department — Phase 1 Changelog

Critical Issues, Security & Operational Foundation. See `WORKSHOP_PHASE1_COMPLETION_REPORT.md` for full detail.

## Backend (`db/services/data.js`)

- **Fixed** — hardcoded role arrays replaced with `mustRole`:
  - `machinesCreate`, `machinesUpdate`, `machinesDelete` → `mustRole(user,'machines')`
  - `machineCategoriesCreate`, `machineCategoriesUpdate`, `machineCategoriesDelete` → `mustRole(user,'machines')`
  - `materialRequestsApprove` → `mustRole(user,'stock-movements')`
- **Fixed** — workshop isolation restored (machines table was never workshop-scoped anywhere):
  - `machinesList` — added `(m.workshop_id=$1 or m.workshop_id is null)` filter for restricted users.
  - `machineKpiPerformance` — same filter applied to its underlying `machines` join.
  - `machineFuelSummary` — same filter applied to both its `byMachine` and `byDate` queries.
  - `machineLogsList` — its own machine-picker dropdown query (the log rows themselves were already correctly scoped) now respects `effectiveWorkshop`.
- **Fixed** — `workshopOverview` now checks `mustRole(user,'workshop-overview')` instead of `mustRole(user,'inventory')`, matching the role-permission system's actual key.
- **Added** — `financeVisibility` block on `workshopOverview` (full-access roles only): `maintenanceCostThisMonth`, `maintenanceRecordCountThisMonth`, `maintenanceCostByType[]`, aggregated from `maintenance_records.cost`.
- **Added** — `pushNotification` calls on `materialRequestsCreate` (broadcast to manager-tier roles) and `materialRequestsApprove` (targeted `forUserId` back to the requester, on both approve and reject). `materialRequestsCreate` now also returns the new request's `id`.

## Database (`db/migrate.js`)

- `logistics` role granted `'workshop-overview'` — preserves this role's existing Workshop Overview access now that the backend check no longer accepts `'inventory'` as a substitute. Migration run against the live database; confirmed via direct query.

## Desktop (`renderer/app.js`)

- `renderWorkshopOverview` — added a small Finance visibility card (maintenance cost this month + breakdown by type), using the page's existing card styling only. No table toolkit, no new components — that's Phase 2 scope.

## Mobile API

- `mobile-api/routes/machines.js` — new `GET /api/machines/kpi-performance?month=YYYY-MM`, with numeric-string-to-number response normalization matching every other mobile-api route's convention.

## Mobile

- `mobile/src/types/api.ts` — new `MachineKpiPerformanceRow`, `MachineKpiResult`, `MachineKpiPerformanceResponse`.
- `mobile/src/api/endpoints.ts` — new `MACHINE_KPI_PERFORMANCE(month?)`.
- `mobile/src/hooks/useMachines.ts` — new `useMachineKpiPerformance(month?)`.
- `mobile/src/screens/machines/MachineKpiPerformanceScreen.tsx` — new screen (utilization/efficiency/downtime/production/KPI-target achievement per machine).
- `mobile/src/navigation/types.ts`, `mobile/src/navigation/stacks/MachinesStack.tsx` — new `MachineKpiPerformance` route.
- `mobile/src/screens/machines/MachinesListScreen.tsx` — new header action to reach the KPI screen.

## Verification

- `node --check`: clean on `data.js`, `migrate.js`, `renderer/app.js`, `mobile-api/routes/machines.js`.
- `npx tsc --noEmit` (mobile): clean.
- Live DB smoke test via 3 throwaway QA accounts (operations / supervisor+workshop / storekeeper), all deactivated and cleaned up after: verified the hardcoded-array fixes actually unblock the roles they were blocking, verified workshop isolation genuinely excludes a cross-workshop control machine, verified the permission-key fix and `financeVisibility` gating, verified both new notifications fire and target correctly.

## Not committed

Per standing release discipline, none of the above has been committed or pushed.
