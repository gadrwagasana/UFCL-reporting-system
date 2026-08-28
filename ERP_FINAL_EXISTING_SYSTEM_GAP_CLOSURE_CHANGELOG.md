# ERP Final Existing-System Gap Closure — Changelog (Phase 3)

Scope: definitive resolution of Phase 2's 6 named "known remaining items." No new departments, no new approval/notification/inventory engines, no permission changes, no Workshop Isolation changes. Nothing committed or pushed.

## Fixed

### Resolution Engine Browse (desktop, all 4 source types)

- **`renderer/app.js`** — new `openResolutionHistoryModal(sourceType)` function, reusing the existing `resolutionsList` backend function exactly (no new query, no duplicate resolution system). Wired into:
  - Harvest Waste page (new "Resolution History" button)
  - Production Offcuts table / `_loadProductionOffcuts` (new button above the table)
  - Rejected Timber table / `_loadRejectionHolds` (shared by Sawmill and Nyanza dashboards — new button above the table)
  - Showroom Damage reports (new button in the section header)

Root cause closed: once a waste/rejection/damage record reached "Resolved" status, its actual resolution (destination, cost, notes, resolver) had no UI path anywhere — only a generic badge. This was previously misclassified across two prior phases as a desktop-vs-mobile parity question; it's actually a genuine missing capability on both platforms, now closed on desktop.

### Machine Daily Logs — mobile edit/delete

- **`mobile-api/routes/machineLogs.js`** — added `PUT`/`DELETE /api/machine-logs/:id` (governed passthrough, matching the convention `fuel.js`/`casualLabour.js`/`logTransport.js` already established this program).
- **`mobile/src/hooks/useMachineLog.ts`** — added `useMachineLogUpdate`, `useMachineLogDelete`.
- **`mobile/src/screens/machineLogs/MachineLogCreateScreen.tsx`** — converted to dual-purpose create/edit (optional `entry` route param).
- **`mobile/src/screens/machineLogs/MachineLogDetailScreen.tsx`** — added Edit header action; added Delete button + `ReasonModal`.
- **`mobile/src/navigation/types.ts`** — `MachineLogStackParamList.MachineLogCreate` now accepts an optional `{ entry }`.
- **`mobile/src/api/endpoints.ts`** — added `MACHINE_LOG_UPDATE`, `MACHINE_LOG_DELETE`.

## Classified — confirmed correct, not built

- **Machine KPI Definitions/Targets (mobile)** — admin/config, not field work. Mirrors Machine Maintenance Schedules' own explicit in-code "stays on desktop" decision.
- **Casuals Worker Registry (mobile)** — HR/roster administration, same class as `Users` management (also desktop-only). Distinct from Casual Labour *Requests*, which already has full mobile parity including delete (Phase 2).
- **Downgrade resolution / generic resolution destinations (mobile)** — preserved exactly as-is, per explicit instruction; both need picker infrastructure that doesn't exist on mobile, and both already have this documented in-code.

## Requires business decision — documented, not built

- **`procurementBenchmark`** — investigated the function (well-designed, reuses already-computed data, same permission gate as every other exposed procurement report) and found it plausibly intended but never resolved by an earlier phase's own "awaiting go/no-go" flag. Not built, to avoid violating this phase's explicit "do not create a dashboard merely because the function exists" instruction. Full reasoning recorded in the gap register for whenever the decision is made.

## Verification

- `node --check` clean on all touched backend/route files.
- `npx tsc --noEmit` clean across `mobile/`.
- Live: `machineLogsUpdate` called against a real record, confirmed working, restored to original value, and confirmed a correct `audit_log` entry was written ("Machine log updated: #1", module `machine-logs`).
- Live: `resolutionsList` called for all 4 source types (harvest_waste, production_offcut, rejected_timber, showroom_damage), all confirmed `ok:true`.
- Workshop Isolation regression-verified unaffected.
- Phase 1/2 fixes (`getCeoOverview`, `businessIntelligenceDashboard`, `logTransportList`) re-confirmed still working after this phase's changes.
- No QA/test data left behind.

## Not committed

Per this phase's Stop Rule, nothing above has been committed or pushed. All changes are local working-tree edits pending review.
