# ERP Enterprise Completion Gate — Changelog

Scope: final cross-department completion gate before another department begins. Builds on the immediately-preceding cross-department verification phase (9 defects fixed there). This phase's own contribution: a full 25-entity CRUD matrix, a repo-wide backend↔UI gap sweep, resolution of the previously-disclosed DATA-05 stock discrepancy (with explicit approval), and live end-to-end testing of the Timber, Nyanza, and Showroom scenarios for the first time in this verification program. No architecture redesign, no new isolation mechanism, no parallel workflow. Nothing committed or pushed.

## Method

1. Two parallel, read-only code-audit agents: (a) CRUD completeness + form-completion + status-parity for 8 entities not covered by the prior phase's audits, (b) a repo-wide Backend→UI and UI→Backend gap sweep.
2. DATA-05 investigated directly (full ledger reconstruction, cross-referenced against every table that could represent a legitimate stock source) before presenting findings and asking for approval to correct.
3. Every genuine defect found by either audit fixed and live-verified against the production database with disposable, uniquely-tagged QA data.
4. Three full cross-department scenarios (Timber, Nyanza, Showroom) run live end-to-end for the first time.
5. Full cleanup, independently verified against a fresh query.

## Fixed

### Data correction (approved)

- **DATA-05** — `stock_levels.quantity` for `stock_catalog` item 20 ("Untreated 100×200×4m") at Gatare Workshop corrected from 62 to 2, matching the item's complete, immutable `stock_movements` ledger (a single legitimate +2-unit entry, 2026-08-09). Root cause: an arithmetic error in the prior phase's own QA-cleanup reversal, not a real production data-integrity issue. Presented with full evidence and applied only after explicit approval.

### `db/services/data.js`

- **`deliveryOrdersCreate`** — now returns `{ ok: true, id, order_number }` instead of just `{ ok: true }`. Found live, mid-Scenario-A-test, when a subsequent `deliveryOrdersRecordPOD` call couldn't be given the id it needed. The insert already computed `rows[0].id` (used for its own audit log entry) — purely additive; neither existing caller (desktop, mobile) reads the new fields.
- **`maintenanceCreate`** — identical fix, same reasoning, found while live-verifying the governance fix below (this function also already had `created[0].id` on hand for its own audit log entry, just never returned it).
- **`applyPendingEdit`** — added a `case 'maintenance_record':` to the governed-edit dispatcher's switch statement, mirroring `maintenanceUpdate`'s own UPDATE statement exactly. Previously, `maintenanceUpdate` had routed edits through `applyGovernance`/`entityType: 'maintenance_record'` since that function was written, but this switch had no matching case — every approved edit to a Vehicle Log maintenance record hit the `default: throw new Error('No apply handler for entity type: maintenance_record')` branch, surfaced to the approver as an opaque failure. Deletion was unaffected (routes through a separate, generic soft-delete mechanism that already correctly included this entity type).

### Mobile — Operations & Storekeeper Material Request review (`mobile/src/navigation/`)

- `OperationsNavigator.tsx` — `MaterialReview` tab now renders `MaterialRequestsStack` instead of `ComingSoonScreen`. Operations holds both `material.review` and `workshop.approve` (`mobile/src/utils/permissions.ts`), and `MaterialRequestDetailScreen`'s own Approve/Reject buttons already gate on exactly `workshop.approve` — but this role had no navigational path to the screen at all, despite the same stack already being wired for 6 other roles.
- `StorekeeperNavigator.tsx` — identical fix; `storekeeper` holds `material.review` with the same dead-end.
- Both reuse the existing `MaterialRequestsStack` and its screens exactly as-is — no new screen, no new logic.

## Verified, no code change needed

- Supplier, Raw Logs, Machine Logs, Deliveries, Showroom Damage — full CRUD confirmed complete on both platforms.
- Inventory Adjustments and Governance Requests approver-side queues — confirmed working both platforms (the submitter-side self-view gap is documented, not fixed — see below).
- Maintenance Job status enum (10 values) and Rejection Hold / Production Offcut status enums (5 values each) — confirmed full label/badge coverage on both platforms, no collapsed-to-generic states found.
- Repo-wide UI→Backend placeholder sweep — zero dead/placeholder patterns found in `renderer/app.js`; on mobile, `ComingSoonScreen` found live-wired in 5 places, 3 benign (1 correct fallback, 1 dead import, 1 non-capability-losing redundant tab) and 2 genuine gaps (fixed above).
- `resolutionCreate`'s full-volume-only rule (fixed in the prior phase) — exercised 3 more times this phase across 3 different rejection sources (Timber, Value-Added, Showroom Damage), correctly enforced every time.

## Not fixed (documented, correctly scoped)

- No desktop self-service view of an ordinary employee's own submitted governance/stock-adjustment requests (mobile has `MyRequestsScreen`; desktop's `pendingEditsList`/`deletionRequestsList` callers are both approver-gated with no counterpart). Requires a new desktop page — NEW SCOPE, not a wiring fix, deferred pending a priority decision.
- `machineLogCategoriesCreate/Delete` has no mobile route (read-only category list only) — confirmed low-severity, admin/config-tier by nature.
- Operations' redundant "Pending" mobile tab (duplicates the already-working header Pending-Approvals icon) — cosmetic, not a capability loss.
- Everything the prior phase deferred remains deferred, unchanged, not re-litigated this phase (see that phase's own changelog).

## Disclosed, not corrected

- **A `material_requests` row (id 214)** with no workshop, no linked maintenance job, status "pending," found during this phase's own cleanup to be referencing a `stock_catalog` id that Postgres's sequence had recycled after an earlier, unrelated item was deleted — this phase's own freshly-created test product happened to receive that same numeric id, and the pre-existing orphaned reference blocked a clean hard-delete. The conflicting `stock_catalog` row was deactivated (not deleted); the orphaned `material_requests` row was left completely untouched, pending investigation. Same class of finding as DATA-05, not yet investigated to the same conclusive standard.

## Verification

- 2 parallel code-audit agents, `file:line`-cited findings.
- DATA-05: full ledger reconstruction across `stock_movements`, cross-referenced against `sales_orders`/`stock_transfers`/`quality_inspections`/`resolution_records` — zero legitimate alternative explanation found for anything but the ledger-verified value.
- `node --check` clean on every touched backend file, after every fix and again after all fixes combined.
- `npx tsc --noEmit` clean across `mobile/`, after every mobile change and again after all changes combined.
- Migration re-run — no schema changes this phase, confirmed no regression.
- **Live fix verification**: `deliveryOrdersCreate` id-return (1/1, isolated), `maintenanceCreate` id-return (confirmed via the governance test below), `maintenance_record` governed-edit apply-handler (3/3, using two distinct real accounts to correctly exercise the self-approval guard along the way — caught and corrected two of my own test-script casing mistakes in the process, which incidentally re-confirmed the self-approval guard, the level-based role check, and the double-approval guard all still work correctly).
- **Live end-to-end scenarios**: Timber (12/12 after 1 fix), Nyanza (13/13), Showroom (10/10) — **35/35 total**, all run against the production database with disposable, uniquely-tagged QA data (`_QA` prefixes, `_QA-SCENARIO-*` references).
- All QA data (1 harvest log, 1 daily log, 1 production offcut, 2 quality inspections, 2 rejection holds, 3 resolution records, 3 sales orders, 1 delivery order, 1 showroom damage report, 1 manufactured product + its stock_catalog bridge, 2 stock transfers + dispatch rows, 1 VAT batch + input/output rows, 1 maintenance record, 1 pending_edit, 24 stock movements, 28 notifications) fully deleted after testing; affected `stock_levels` rows restored to their exact pre-test values; zero residue independently verified via direct query. One `stock_catalog` row deactivated rather than deleted, for the disclosed reason above.

## Not committed

Per this phase's Stop Rule, nothing above has been committed or pushed. All changes are local working-tree edits pending review.
