# Mechanician — Phase 4 Changelog

Enterprise UI/UX & Productivity Enhancement. See `MECHANICIAN_PHASE4_COMPLETION_REPORT.md` for full detail, reasoning, and live-verification evidence. No database migration — no schema or permission change this phase.

## Backend

- `db/services/data.js`
  - New `maintenanceAssetSummary(userId, machineId)` — per-machine composed read: status, category, workshop, open-maintenance count, last/next maintenance dates, this-month downtime, 90-day failure count, external-repair-active flag, cost summary, 5 most recent jobs. Gated on `maintenance-jobs`, workshop-isolation enforced.
  - New `maintenanceWaitingForPartsList(userId)` — jobs in `waiting_parts`, enriched with their linked material request (item/quantities/status) and Stock Transfer status.
  - `maintenanceOfficerDashboard()` — extended with `machineHealth` (available/running/maintenance/breakdown counts) and `trendMonths` (6-month zero-filled jobs-vs-external-repair-cost series via `generate_series`).
  - `mechanicianDashboard()` — `kpi` object gained `inProgressCount`/`testingCount`/`externalRepairCount`, all read from the already-executed `myJobCounts` query — no new queries added.
  - Both new functions added to `module.exports`.

## Electron

- `electron/main.js` — 2 new IPC handlers: `maintenance-jobs:asset-summary`, `maintenance-jobs:waiting-parts`.
- `electron/preload.js` — matching `UFCL.maintenanceAssetSummary(userId, machineId)` / `UFCL.maintenanceWaitingParts(userId)` methods.

## Mobile API

- `mobile-api/routes/maintenanceJobs.js` — 2 new static routes (placed before `/:id` per Express route-matching order): `GET /waiting-for-parts`, `GET /asset-summary/:machineId`, both gated on the existing `JOB_ROLES` list.

## Desktop (`renderer/app.js`)

- `renderMechanicianDashboard()` — redesigned: "What should I work on now?" panel (blocked jobs sorted first), 3 new clickable KPI tiles (In Progress/Testing/External Repair) deep-linking into a pre-filtered Maintenance Jobs view via a new `_mjGoToJobs(status)` helper.
- `renderMaintenanceJobs()` — now defaults to a Work Queue view (jobs grouped into per-status cards, `renderQueueView()`) with the original table kept as a one-click toggle; added dedicated **Waiting for Parts** (`renderWaitingView()`, backed by the new `maintenanceWaitingForPartsList`) and **External Repair** (`renderExternalView()`, pure client-side filter — no new backend call) views, both reachable from the same view-toggle row. Accepts an optional `initialStatus` param for dashboard deep-linking.
- `openMaintenanceJobDetailOverlay()` — added a **Timeline** tab (`renderTimelineTab()` + new `_mjTimelineHtml()`/`MAINT_TIMELINE_STAGES` helpers, reusing `_statusTimelineHtml`'s existing visual language with the two detour states spliced in) and a persistent **asset-summary strip** above the tabs (calls the new `maintenanceAssetSummary`).
- `renderMaintenanceOfficerDashboard()` — added a Machine Health grid and a 6-month trend chart (`_svgDualBar`, already-existing helper — no new charting code).

## Mobile

- `mobile/src/api/endpoints.ts` — 2 new endpoint constants: `MAINTENANCE_WAITING_FOR_PARTS`, `MAINTENANCE_ASSET_SUMMARY(machineId)`.
- `mobile/src/types/api.ts` — new `MaintenanceWaitingForPartsRow`/`Response`, `MaintenanceAssetSummaryResponse` types; `MechanicianDashboardResponse.kpi` extended with the 3 new fields.
- `mobile/src/hooks/useMaintenanceJobs.ts` — new `useMaintenanceWaitingForParts()`, `useMaintenanceAssetSummary(machineId)` hooks.
- `mobile/src/navigation/types.ts` — `MaintenanceJobsStackParamList.MaintenanceJobsList` now accepts an optional `{ initialStatus?: string }` param for dashboard deep-linking.
- `mobile/src/screens/maintenance/MaintenanceJobsListScreen.tsx` — reads `initialStatus` from route params; default view (no search/filter active) is now a `SectionList` grouped by status (Work Queue), falling back to the existing flat `FlatList` the moment a search or status chip is applied.
- `mobile/src/screens/maintenance/MaintenanceJobDetailScreen.tsx` — added an Asset Summary section (`useMaintenanceAssetSummary`), a Timeline section (`TimelineRow`, mirrors desktop's `_mjTimelineHtml` splice logic using chip styling), and a previously-missing **External Repair** section with the vendor-return action (`return_external` — existed on the backend and on desktop since Phase 3, was never wired into the mobile screen).
- `mobile/src/screens/mechanician/MechanicianDashboardScreen.tsx` — redesigned: KPI tiles are now tappable (deep-link into a filtered job list or a specific job's detail via `goToJobs`/`goToJobDetail`), 3 new KPI tiles added, "My Jobs" widget replaced with a "What should I work on now?" panel (blocked jobs sorted first).

## Verification

- `node --check`: clean on every touched backend/desktop file, checked incrementally.
- `npx tsc --noEmit` (mobile): clean after all edits, zero errors.
- Live read-only + one throwaway-job lifecycle test against production data: both new backend reads called cold with no fixtures (correct empty-state shape), then a full job driven through create → assign → start → waiting_parts → resume → external_repair → return → close, checking `maintenanceWaitingForPartsList` and `maintenanceAssetSummary` at each relevant state, machine-status sync confirmed both directions, cleanup left the DB and machine status exactly as found.

## Outstanding (not fixed this phase — see report)

- No file/photo attachment capability — unchanged scope boundary from Phase 3.
- Mobile CSV export / company-wide Officer dashboard access — desktop-only, consistent with every other department in this app.
- View-mode choice (Work Queue vs Table, desktop; grouped vs flat, mobile) does not persist across navigation — minor polish item, not addressed.

## Not committed

Per standing release discipline, none of the code above has been committed or pushed. No database migration was required this phase.
