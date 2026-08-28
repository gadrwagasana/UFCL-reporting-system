# Workshop Department — Phase 2 Changelog

Functional Completion, Enterprise UI/UX & Professional ERP Experience. See `WORKSHOP_PHASE2_COMPLETION_REPORT.md` for full detail.

## Backend (`db/services/data.js`)

- **Generalized** `logisticsRecordHistory` from a Logistics-only function into a shared, department-agnostic per-record audit-history lookup: added a module→permission-check map covering `machines`, `machine-logs`, `machine_maintenance_schedules`, `material-requests` alongside the existing Logistics modules.
- **Added structured `logAudit` opts** (`module`/`actionType`/`recordId`) to: `machinesCreate/Update/Delete`, `machineLogsCreate/Update/Delete`, `machineMaintScheduleCreate/Update/Delete`, `materialRequestsCreate`/`Approve` (both approve and reject branches).
- **Fixed** — `machineMaintScheduleUpdate` previously fired zero audit entries on edit; now logs every update.
- **Fixed** — `machinesCreate`, `machineLogsCreate`, `machineMaintScheduleCreate` now return the new record's `id` (previously discarded in some cases), required by the new detail-overlay/history UI.
- **Extended** `workshopOverview` with 10 new read-only aggregation queries (Executive KPIs: machines, active/scheduled/overdue maintenance, fuel consumption, machine availability %, downtime, material requests pending, workshop costs, maintenance costs; Operational Widgets: today's/upcoming maintenance, overdue jobs, equipment alerts, fleet alerts, workshop notifications) — all behind the same permission gate this function already checks, finance/fleet figures scoped to full-access roles only.
- **Fixed** (live-smoke-test-caught bug) — the maintenance-due classification (today/overdue/upcoming) compared a Postgres `date` value round-tripped through `toISOString()` against local time, off by one day whenever the server isn't in UTC. Reclassified in SQL against `current_date` instead.

## Desktop (`renderer/app.js`)

- `renderMachines` (Machine Registry): full enterprise table toolkit (search/filter/sort/bulk status update); detail overlay with machine info, maintenance-schedule quick action, and audit history; Maintenance Schedule management upgraded from add-only to add/edit/delete.
- `renderMachineLogs` (Machine Daily Logs): table toolkit (search/filter/sort) layered on top of the existing month picker; detail overlay with audit history. Bulk actions deliberately not added given the page's existing governance-aware (supervisor vs. direct) edit/delete routing.
- `renderMachineKpi` (Machine KPI Performance): search/filter/sort toolkit; "View" action opens a machine-history drill-down overlay.
- `renderMaterialRequests` (Material Requests): full enterprise table toolkit including bulk approve; detail overlay with status-progression timeline and audit history.
- `renderWorkshopOverview` (Workshop Dashboard): Executive KPI strip (8–10 tiles depending on role), 7 Operational Widgets, and a CSV "Export report" button — mirrors the Logistics Phase 3 dashboard pattern exactly, reusing the shared `_lgdWidget` helper.

## Mobile API

- No changes required — `mobile-api/routes/workshops.js`'s `/overview` route already passes through the backend result raw, so all new fields flow through automatically.

## Mobile

- `mobile/src/types/api.ts` — `WorkshopOverviewResponse` extended with `financeVisibility` (previously missing from the mobile type entirely, despite existing on the backend since Phase 1) and all new Phase 2 KPI/widget fields; new supporting types (`WorkshopFinanceVisibility`, `MaintenanceScheduleAlert`, `EquipmentAlert`, `WorkshopFleetAlert`, `WorkshopNotification`).
- `mobile/src/screens/workshops/WorkshopOverviewScreen.tsx` — new `MiniKpi`/`OpsWidget` components; Executive KPI grid + Operational Widgets sections added, mirroring desktop.
- `mobile/src/screens/machines/MachinesListScreen.tsx`, `mobile/src/screens/material/MaterialRequestsListScreen.tsx` — added `ListSearchBar` + status-chip filtering (previously routed search to the global search module only).

## Verification

- `node --check`: clean on `data.js`, `migrate.js`, `renderer/app.js`, `mobile-api/routes/machines.js`, `mobile-api/routes/workshops.js`.
- `npx tsc --noEmit` (mobile): clean.
- Live DB smoke test via a throwaway `_qa_p2_smoke` admin account (deactivated + test data removed after): create→history→update→history verified for machines, maintenance schedules, machine logs, and material requests; dashboard widget integration verified end-to-end. Caught and fixed a real maintenance-date classification bug (timezone-related off-by-one-day) during this pass.

## Not committed

Per standing release discipline, none of the above has been committed or pushed.
