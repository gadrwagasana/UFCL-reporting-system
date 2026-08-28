# Mechanician — Phase 3 Changelog

Enterprise Maintenance Lifecycle & Asset Management. See `MECHANICIAN_PHASE3_COMPLETION_REPORT.md` for full detail, reasoning, and live-verification evidence.

## Database (migration applied to live DB via `npm run migrate`)

- `db/migrate.js`
  - New tables: `maintenance_jobs` (job header + status + assignment + external-repair fields), `maintenance_job_labour` (append-only labour sessions), `maintenance_production_impact` (Operations-recorded downtime/loss entries, `job_id` required).
  - New column: `material_requests.maintenance_job_id` (nullable FK) — the entire spare-parts integration; no other schema or logic change to Material Requests/Stock Transfers.
  - New permission keys: `maintenance-jobs` (granted to `mechanician`, `supervisor`, `sawmill-leader`, `poles-leader`, `logistics`, `operations`, `admin`, `ceo` — verified live who already held `machine-logs`/`machine-maintenance` before writing this list) and `maintenance-oversight` (granted to `logistics`, `admin`, `ceo` only — the company-wide "Mechanician Officer" capability, no new role).

## Backend

- `db/services/data.js`
  - New `maintenanceJobsList`, `maintenanceJobDetail`, `maintenanceJobCreate`, `maintenanceJobAssign`, `maintenanceJobTransition` (the unified state-machine dispatcher — `diagnose|start|request_parts|resume|send_external|return_external|test|return_to_service|close|cancel`), `maintenanceJobLabourAdd`, `maintenanceProductionImpactCreate`, `maintenanceOfficerDashboard`, `maintenanceReports`. All exported.
  - `materialRequestsCreate`/`materialRequestsList` — extended to accept/return `maintenance_job_id` and the linked job's title. No other change to either function.
  - `mechanicianDashboard()` — extended with job KPIs (Open/Assigned/Waiting-for-Parts/Completed-Today) and two widgets (My Jobs, Overdue Maintenance split out from Upcoming Maintenance).
  - `MODULE_PERMISSION_CHECK` map — added `maintenance_jobs`/`maintenance_production_impact` entries; fixed the stale `'material-requests'` entry (was still `stock-movements`-only, predating the Phase 1 gate fix, silently blocking mechanician and the other 4 Phase-1-fixed roles from viewing their own request's audit history).
  - `machines.status` is now synced on `start` (→ `Maintenance`) and `return_to_service` (→ `Available`) — the one piece of cross-table integration beyond the material-request FK.

## Electron

- `electron/main.js`/`preload.js` — 9 new `maintenance-jobs:*` IPC channels + matching `UFCL.maintenanceJob*`/`maintenanceOfficerDashboard`/`maintenanceReports`/`maintenanceImpactAdd` preload methods.

## Mobile API

- New `mobile-api/routes/maintenanceJobs.js` — list/detail/create/assign/transition/labour/production-impact/officer-dashboard/reports, each with its own independently-DB-verified role list (not inherited from `machines.js`'s already-known-stale `MACHINE_ROLES`).
- `mobile-api/server.js` — mounted at `/api/maintenance-jobs`.

## Desktop (`renderer/app.js`, `renderer/index.html`)

- New NAV entries: "Maintenance Jobs" (Fleet & Equipment section), "Maintenance Overview" + "Maintenance Reports" (new "Maintenance Oversight" section, logistics/admin/ceo only).
- New `renderMaintenanceJobs()` — full toolkit (search/filter/sort/KPI cards) list page.
- New `openMaintenanceJobDetailOverlay()` — tabbed overlay (Overview/Labour/Parts/External Repair/Production Impact/Audit History), with inline status-transition forms and a "Request Materials" action that creates a job-linked material request via the existing `materialRequestsCreate`.
- New `renderMaintenanceOfficerDashboard()` — company-wide KPIs, workshop comparison, repeated-failures/technician-workload/recent-jobs widgets.
- New `renderMaintenanceReports()` — 7 report sections, each with its own CSV export button via the existing `UFCL.execExport` pattern.
- `renderMechanicianDashboard()` — extended with job KPI cards and two new widgets (My Jobs, Overdue Maintenance).

## Mobile

- `mobile/src/types/api.ts` — `MaintenanceJob`, `MaintenanceJobStatus`, `MaintenanceJobsListResponse`, `MaintenanceJobLabourEntry`, `MaintenanceJobPartLine`, `MaintenanceProductionImpact`, `MaintenanceJobDetailResponse`; extended `MechanicianDashboardResponse` with the new KPI/widget fields.
- `mobile/src/api/endpoints.ts` — 7 new `MAINTENANCE_JOB*` endpoint constants.
- New `mobile/src/hooks/useMaintenanceJobs.ts` — list/detail/create/assign/transition/labour/production-impact hooks + `MAINT_JOB_STATUS_LABEL` map.
- New screens: `mobile/src/screens/maintenance/MaintenanceJobsListScreen.tsx`, `MaintenanceJobDetailScreen.tsx` (scrollable sections, not tabs — matches existing mobile detail-screen convention), `MaintenanceJobCreateScreen.tsx`.
- New `mobile/src/navigation/MaintenanceJobsStack.tsx` — shared stack, wired into `MechanicianNavigator`, `SupervisorNavigator`, `SawmillNavigator`, `PolesNavigator` (the 4 role surfaces the DB grant covers).
- `mobile/src/navigation/types.ts` — new `MaintenanceJobsStackParamList` + `MaintenanceJobs` tab added to the 4 navigators' tab param lists.
- `mobile/src/screens/mechanician/MechanicianDashboardScreen.tsx` — extended with job KPI tiles and My Jobs/Overdue Maintenance widgets.

## Verification

- `node --check`: clean on every touched backend/desktop file, checked incrementally after each addition.
- `npx tsc --noEmit` (mobile): clean, checked incrementally after each addition.
- Live end-to-end test (6 throwaway QA accounts across 2 workshops + 1 throwaway stock item, all removed after): full job lifecycle including material-request/Stock-Transfer integration, external repair, production impact, workshop isolation, officer dashboard/reports, audit trail (16 entries), and notifications (6) all confirmed correct. One test-induced side effect (a machine left at `Maintenance` status after a test job was deleted mid-lifecycle) was found during cleanup and corrected.

## Outstanding (not fixed this phase — see report §13)

- Mobile Officer dashboard/CSV reports not built — consistent with the existing desktop-only CSV/oversight boundary across this entire app.
- `mobile-api/routes/machines.js`'s pre-existing `MACHINE_ROLES` inconsistency (flagged in Phase 2) remains untouched.
- No file/photo attachment capability for completion evidence — out of this phase's approved scope.
- Labour and fuel costs are not monetized in any cost figure — no rate exists anywhere in this system for either.

## Not committed

Per standing release discipline, none of the code above has been committed or pushed. The database migration (new tables/columns/permission grants) was applied live, as noted in the completion report.
