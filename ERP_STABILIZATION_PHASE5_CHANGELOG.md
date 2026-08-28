# ERP Stabilization Program — Phase 5 — Changelog

## Added — Backend / mobile-api

- `mobile-api/routes/machines.js` — `DELETE /:id` (archive a machine), governance-passthrough shaped like the existing `PUT /:id`.
- `mobile-api/routes/vehicles.js` — `PUT /maintenance/:recordId` (edit a maintenance record).
- `mobile-api/routes/fuel.js` — `PUT /machine/:id` (edit a machine fuel log).
- `db/services/data.js`'s `machineFuelLogsList` now also selects `machine_id`/`vehicle_id` (needed by the new Edit UI to pre-select the correct machine/vehicle; purely additive).

## Added — Desktop (`renderer/app.js`)

- Machine Registry: Archive row-action.
- Vehicle Maintenance tab: Edit action per record.
- Machine Fuel Logs detail: Edit action.
- Purchase Order detail: Edit action (delivery date / terms / tax amount).
- Deliveries: "Change status" now opens a real status overlay instead of silently aliasing to Edit.

## Added — Mobile

- New screen `MaintenanceWaitingForPartsScreen.tsx`, registered in `MaintenanceJobsStack`, reachable from a new header action on the Maintenance Jobs list.
- RFQ Detail: "Record Quotation" card.
- Material Request Detail: Approve/Reject actions for pending requests.
- Machine Detail: Archive action.
- Vehicle Detail → Maintenance: Edit action per record (`VehicleMaintenanceCreateScreen` extended to dual create/edit mode).
- Machine Fuel Detail: Edit action (`MachineFuelCreateScreen` extended to dual create/edit mode).
- New shared component `mobile/src/components/MRApproveModal.tsx`, extracted from `WorkshopOverviewScreen.tsx` (which now imports it) so both entry points to Material Request approval share one implementation instead of duplicating it.
- New hooks: `useMachineDelete`, `useMaintenanceUpdate`, `useMachineFuelUpdate`.

## Fixed

- **`procurementPoUpdate` had no workflow-stage guard at all** — added one: editing `tax_amount` is now blocked once a PO reaches `received`/`shortage_pending_approval`/`closed_with_shortage`/`cancelled` (an invoice may already exist by then); `expected_delivery_date`/`terms` remain editable at any stage.
- **`procurementPoUpdate` couldn't clear a field to empty** — explicit `null`/`''` was being silently treated as "no change" (via `??`). Fixed to distinguish "field omitted" from "field explicitly cleared." Found and fixed because it directly affected this phase's own new Edit UI; confirmed safe since this function had zero other callers before this phase.
- Desktop's delivery "Change status" button opened the Edit overlay (no status field) instead of changing status — now opens a dedicated status overlay restricted to the 4 backend-valid values.

## Verified

- Live REST verification against the real environment: F-19+F-21 tested end-to-end via a throwaway machine and fuel log; F-16 tested via the pre-existing `_QA-RL-TEST` throwaway vehicle; F-2 (no REST route — desktop-only) tested directly against a real PO, confirming both the new guard and the null-clearing fix, with the PO's original values verified restored afterward. F-1/F-6/F-28's pre-existing routes sanity-checked. No regressions across 7 spot-checked endpoints from Phases 1–4.
- `node --check` clean on all touched backend/desktop files; `tsc --noEmit` clean on mobile.

## Documented, not fixed (out of this phase's scope)

- Mobile-api has no route to delete a machine fuel log at all (desktop has always had it via IPC) — found live during F-21 verification, doesn't block F-21 itself.
- The ~13 deferred desktop-only convenience/parity items (bulk actions, CSV export, report dashboards, etc.) — see completion report §5.
- Machine archiving (F-19) is one-way by design (no reactivate path exists anywhere in the backend) — the new UI states this explicitly rather than implying reversibility.
