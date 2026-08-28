# Mechanician — Phase 3 Completion Report

Enterprise Maintenance Lifecycle & Asset Management. Implements the approved plan built from `MECHANICIAN_PHASE2_OPERATIONAL_AUDIT.md`'s findings — a genuine maintenance job lifecycle, integrated with (not duplicating) the existing Material Request → Stock Transfer → Inventory pipeline, Workshop Isolation, audit/notification engines, and permission model.

## 1. Executive Summary

Mechanician can now run a real maintenance job from first inspection to closed, with a full audit trail, instead of the daily-log-plus-recurring-reminder pair that was all this ERP had before. Three tables were added — `maintenance_jobs`, `maintenance_job_labour`, `maintenance_production_impact` — plus one new column (`material_requests.maintenance_job_id`). Everything downstream of a material request (approval, Stock Transfer, dispatch, receive, `stock_levels`) is untouched; the new column only tags which job a request was for.

Three scope decisions were confirmed with you before implementation, all followed exactly: the lifecycle covers machines only (vehicles keep Fleet's separate system); the company-wide "Mechanician Officer" capability was delivered to the existing `logistics` role (Logistics Manager) rather than a new role; and approving External Repair stayed restricted to the same `machines`-tier that already manages the registry, not extended to Workshop Supervisors.

Every piece was live-verified end-to-end against real production data — two full jobs run through the actual state machine, including a full external-repair cycle, a linked material request that went through the real Stock Transfer pipeline, cost computation from actual received quantities, machine-status sync in both directions, workshop isolation, and every audit-log/notification side effect. One real side effect from testing (a machine's status left at "Maintenance" after a test job was deleted mid-lifecycle) was caught and corrected before finishing.

## 2. Maintenance Lifecycle

`maintenance_jobs.status` cycles through the exact order requested: `inspection → diagnosis → assigned → in_progress → [waiting_parts ⇄ in_progress] → [external_repair → testing] → testing → returned_to_service → closed`, with `cancelled` reachable from any non-terminal state. A single dispatcher, `maintenanceJobTransition(userId, jobId, action, payload)`, validates the legal from-states for each action (mirroring the same "load row → check current state → validate → apply" pattern `stockTransfersReceive`/`Dispatch` already use), and every transition writes a structured `audit_log` entry via the existing `logAudit` — live-verified: 16 audit entries were generated across the two test jobs, one per transition, with no gaps.

Gate discipline: creating a job, assigning a technician, and approving External Repair require `machines` (the same tier that already manages the Machine Registry). Every working transition (diagnose, start, request parts, resume, test, return to service, close, cancel) is open to the job's assigned technician **or** a `machines` holder — live-verified: the mechanician test account could work its own assigned job but was correctly denied `send_external`, and creating a job outright was denied with `Access denied`.

## 3. Asset Lifecycle

No new tables for "generators, forklifts, compressors, chainsaws" — confirmed live before building anything that `machine_categories` already includes `Generator` and `Crane / Forklift` as real rows, so "any future equipment" is a new category, not new schema. `machines.status` (the field every existing screen already reads) is now synced automatically: `start` sets it to `Maintenance` (unless already `Breakdown`), `return_to_service` sets it back to `Available` — live-verified both directions on a real machine row. History is never deleted: job/labour/production-impact rows are permanent; the only "removal" path is the `cancelled` status, not a delete.

## 4. Mechanician Operations

A mechanician can now, end-to-end, inside the app: receive an assigned job, diagnose it, start work (opening a labour session), request parts (which pauses the job and notifies Logistics/Supervisor/Storekeeper), resume once materials arrive, test the repair, return the machine to service, and close the job — all live-verified in one continuous run against real data. Workshop isolation is enforced on every read and write (`isWorkshopRestricted` + a `workshop_id` check on the job) — live-verified: a mechanician in a different workshop got `Access denied` on the job's detail and saw zero rows in their own job list.

## 5. Mechanician Officer Supervision

Delivered to the existing `logistics` role, not a new role — confirmed with you before building. `maintenanceOfficerDashboard()` is deliberately company-wide (no workshop filter, unlike every other dashboard in this app) and gated on a new `maintenance-oversight` permission held only by `logistics`/`admin`/`ceo`. It surfaces: open/in-progress/waiting-for-parts/external-repair counts, this-month downtime hours, overdue preventive maintenance, a workshop-by-workshop comparison table, a "repeated failures" list (machines with 3+ jobs in 90 days — a plain count, not an invented reliability score), technician workload, and recent jobs. Live-verified: the officer dashboard correctly reflected both test jobs' final state and the workshop comparison correctly attributed them to Gatare Workshop; a mechanician account was correctly denied access.

## 6. External Repair

Full cycle built and live-verified: `send_external` (machines-tier only, requires vendor + reason, sets `external_repair_sent_at`) → `return_external` (records return date, cost, notes, moves the job to `testing`). Both fields are visible in the job's detail and roll into the Maintenance Reports' External Repair Report. Confirmed live: a mechanician was denied `send_external`; the Logistics Manager test account completed the full send → return cycle, with the recorded vendor/cost/dates all persisted correctly.

## 7. Production Impact

`maintenanceProductionImpactCreate` requires an existing `job_id` — enforced both at the application layer and by the column's `NOT NULL` FK constraint, so there is no way to create a floating production-loss record disconnected from a real maintenance activity. `estimated_production_loss` is a manual entry field, not a computed formula — confirmed during planning that no "estimated production loss" calculation exists anywhere in this codebase today (`machines.production_capacity` is a registry display field never used in any calculation), so this deliberately does not invent one. Live-verified: an Operations test account logged a production-impact entry against the already-existing job, confirmed by inspection that no second maintenance record was created.

## 8. Inventory & Procurement Integration

Zero new inventory logic. `material_requests` gained one nullable FK column; `materialRequestsCreate` accepts and stores it; everything else — `materialRequestsApprove`, `stockTransfersDispatch`, `stockTransfersReceive`, `stock_levels` updates — is byte-for-byte unchanged. Live-verified end-to-end: a mechanician created a job-linked material request, a Supervisor approved it (creating the Stock Transfer exactly as before), a Storekeeper dispatched it, the Supervisor received it, and the job's computed cost (`partsCostActual`) correctly reflected `2 × RWF 200 = RWF 400` — the real received quantity times the real `stock_catalog.unit_cost`, not a duplicated calculation. Procurement's own Requisition path was not touched — that remains the default replenishment source when local stock is insufficient, exactly as before.

## 9. Dashboard

Mechanician's own dashboard (`mechanicianDashboard()`) gained: Open/Assigned/Waiting-for-Parts job KPI tiles, a Completed-Today count, a "My Jobs" widget, and an "Overdue Maintenance" widget split out from the existing "Upcoming Maintenance" one (previously a single undifferentiated list). All built from data the function already had access to — no new tables read beyond what Phase 2 already queried, aside from the new job tables themselves. Live-verified: after closing a job, `completedJobsToday` correctly read `1`.

## 10. Reporting

`maintenanceReports()` returns all 8 requested datasets — Maintenance History, Downtime Summary, External Repair Report, Technician Activity, Workshop Performance, Asset Reliability, Inventory Consumption Summary, plus a combined cost summary — each a straightforward aggregate query, reusing `stock_catalog.unit_cost` for cost figures exactly as the job-detail cost calculation does (no second cost formula). CSV export reuses the existing `UFCL.execExport` IPC/save-dialog pattern verbatim — no new export mechanism. Live-verified: `maintenanceHistory` returned both test jobs, `inventoryConsumption` returned the one linked material request, `externalRepairs` returned the one external-repair job.

## 11. Mobile/Desktop Parity

| Capability | Desktop | Mobile |
|---|---|---|
| Job list/detail/create | ✅ | ✅ |
| Full status-transition lifecycle | ✅ | ✅ (same actions, inline reason forms) |
| Labour entries | ✅ | ✅ |
| Linked material requests + cost | ✅ | ✅ (read + link via existing Materials tab) |
| External repair send/return | ✅ | ✅ |
| Production impact | ✅ | ✅ |
| Dashboard job KPIs/widgets | ✅ | ✅ |
| Officer dashboard (company-wide) | ✅ | Desktop-only — consistent with every department this session; mobile has never had CSV export or a company-wide oversight page anywhere in this app |
| Reports (CSV) | ✅ | Desktop-only, same reason |

The `MaintenanceJobs` tab/stack was added to `MechanicianNavigator`, `SupervisorNavigator`, `SawmillNavigator`, and `PolesNavigator` — the same four role surfaces the DB grant covers (`mechanician`, `supervisor`, `sawmill-leader`, `poles-leader`), reusing one shared stack (`MaintenanceJobsStack`), not four separate implementations.

## 12. Verification Results

**Static**: `node --check` clean on `db/migrate.js`, `db/services/data.js`, `electron/main.js`, `electron/preload.js`, `mobile-api/routes/maintenanceJobs.js`, `mobile-api/server.js`, `renderer/app.js`. `npx tsc --noEmit` clean on mobile (checked after every incremental addition, not just once at the end).

**Live** (6 throwaway QA accounts across 2 workshops + 1 throwaway stock item, all removed after — mechanician, Logistics Manager, Supervisor, Storekeeper, Operations, and a second-workshop mechanician for the isolation test):

1. Full job 1 lifecycle: create (unassigned) → diagnose (by Logistics Manager, before assignment) → assign to mechanician → start (machine status → `Maintenance`) → request parts (reason required, confirmed) → resume → linked material request → approve → dispatch → receive → test → return to service (machine status → `Available`) → close. Every step returned the expected status; the machine's status flipped correctly both directions.
2. Job cost: confirmed `partsCostActual = 400` after receiving 2 units at RWF 200/unit — the real received quantity times the real catalog cost.
3. Job 2, External Repair path: create → diagnose → assign → start → `send_external` denied for the mechanician, accepted for the Logistics Manager → `return_external` recorded vendor/cost/dates correctly.
4. Production impact: logged by an Operations account against job 1; confirmed no duplicate job was created.
5. Workshop isolation: a mechanician in a different workshop was denied job detail access and saw an empty job list.
6. Officer dashboard/reports: confirmed correct company-wide KPIs, workshop comparison, and report row counts; confirmed a mechanician account is denied access to both.
7. Audit trail: 16 `audit_log` entries, one per transition across both jobs, with no gaps.
8. Notifications: 6 notifications fired at the expected moments (assignment ×3, waiting-for-parts broadcast, job-closed to creator, external-repair broadcast).
9. **A real side effect from testing was found and fixed**: job 2 was deleted mid-lifecycle (while still `testing`, never reaching `return_to_service`), leaving its machine's `status` stuck at `Maintenance`. Caught during cleanup and restored to `Available` (its pre-test value) before finishing.

All 6 accounts, the throwaway stock item, and both test jobs (with their labour/production-impact rows) were removed after verification.

## 13. Outstanding Items

- Mobile Officer dashboard/reports were deliberately not built — consistent with every other department's mobile/CSV boundary in this app, not a gap introduced here.
- `mobile-api/routes/machines.js`'s pre-existing `MACHINE_ROLES` inconsistency (flagged in the Phase 2 changelog, not this phase's to fix) remains untouched; the new `maintenanceJobs.js` route file was given its own independently-verified role list rather than inheriting it.
- No file/photo attachment capability was added for completion evidence — this phase's scope (per the approved plan) was the job lifecycle, cost, and reporting; a genuine attachment pipeline (still nonexistent anywhere in this codebase, machine or vehicle side) remains a separate, undecided future item.
- Labour hours have no currency rate anywhere in this system, and machine fuel logs have no cost field — job/report cost figures are explicitly parts-plus-external-repair only, never blended with an invented labour or fuel rate.

## 14. Production Readiness

**A maintenance job can now be created, diagnosed, assigned, worked, blocked on parts, sent to an external vendor, tested, returned to service, and closed — entirely inside the ERP, with a full audit trail, on both platforms** — live-verified against real production data end-to-end, including the full integration with the existing Material Request/Stock Transfer/Inventory pipeline. The Mechanician Officer role's company-wide visibility is real and gated correctly. This closes the gap the Phase 2 audit identified: maintenance in this ERP is no longer just a daily log and a recurring reminder — it is a genuine, traceable job.

## Not committed

Per standing release discipline, none of the code above has been committed or pushed. The database migration (new tables, new columns, new permission grants) **was** applied to the live database as part of implementing this approved phase — the same treatment every prior phase's schema/permission changes received this session.
