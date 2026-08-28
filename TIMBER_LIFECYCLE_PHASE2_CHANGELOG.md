# Timber Lifecycle Phase 2 — Changelog

## Database (`db/migrate.js`, `createTimberLifecyclePhase2()`)
- New table `rejection_holds` (quality_inspection_id, production_offcut_id, quantity, status, resolution_id, rework_offcut_id, downgrade_product_id, downgrade_quantity, workshop_id, notes, created_by/at, resolved_by/at).
- `quality_inspections` gained `product_id`, `stock_item_id`, `workshop_id` (frozen at inspection time).
- `production_offcuts` gained `rework_of_rejection_id`.
- `resolution_records.source_type` check constraint extended to allow `'rejected_timber'`.

## Backend (`db/services/data.js`)
- `qualityInspectionCreate` — rewritten to resolve a Product Catalog match from the recovered piece's dimensions, post Accepted quantity to Finished Timber Inventory, and open a `rejection_holds` row for any Rejected quantity.
- `resolutionCreate` — extended for `source_type: 'rejected_timber'`; added the Disposal approval gate; added a backend default for `unit_cost` from the rejected product's `standard_cost` when not explicitly supplied (bug fix, see below).
- New: `rejectionHoldsList`, `rejectionResolveRework`, `rejectionResolveDowngrade`, `rejectionResolveReturnToInventory`, `qualityReport`.
- `productionReconciliation` — extended with `acceptedQty`/`rejectedQty`/`unresolvedRejections`; `reconciled` now also requires zero unresolved rejections.
- **Bug fix**: `productionOffcutCreate`'s and `productionReconciliation`'s offcut-quantity sums now exclude rework-descendant rows (`rework_of_rejection_id is not null`) — previously double-counted, inflating the waste budget and (in `productionOffcutCreate`'s case) wrongly rejecting legitimate offcut requests once enough rework cycles had occurred.

## mobile-api
- New `mobile-api/routes/rejectionHolds.js` (`GET /`, `POST /:id/rework`, `POST /:id/downgrade`, `POST /:id/return`, `GET /quality-report`), mounted in `mobile-api/server.js`.

## Electron (`electron/main.js`, `electron/preload.js`)
- New IPC handlers + bridge functions for all five new backend functions.

## Desktop (`renderer/app.js`)
- Production Offcuts table: "Inspect" action, "Rework of Rejection #N" lineage badge (bug fix — was written to the DB but never surfaced).
- New Rejection Holds card (Rework / Downgrade / Return / Resolve actions, status badges).
- New Quality Report card (KPIs, resolution breakdown, financial impact), wired into CSV export.
- Production Reconciliation table extended with Accepted/Rejected columns.

## Mobile (`mobile/src/...`)
- `types/api.ts` — `ResolutionSourceType` extended with `'rejected_timber'`; new types `QualityInspectionCreateResult`, `RejectionHoldStatus`, `RejectionHoldRow`, `RejectionHoldsListResponse`, `QualityReportResponse`; `ProductionOffcutRow` gained `rework_of_rejection_id`; `ProductionReconciliationRow` gained `acceptedQty`/`rejectedQty`/`unresolvedRejections`.
- `api/endpoints.ts` — `REJECTION_HOLDS_LIST/REWORK/DOWNGRADE/RETURN`, `QUALITY_REPORT`.
- `hooks/useTimberLifecycle.ts` — `useRejectionHoldsList`, `useQualityReport`, `useRejectionHoldActions`; `inspect()` given a proper return type + query invalidation.
- `screens/sawmill/SawmillDashboardScreen.tsx` — "Inspect" action (Alert.prompt), new `RejectionHoldsCard`, new `QualityReportCard`, rework-lineage label on offcut rows.

## Bug fixes discovered via live testing (all fixed this phase)
1. Reconciliation double-counted rework-descendant offcut quantity against the daily log's waste budget (display-level; could mask genuinely untracked waste).
2. Same flaw in `productionOffcutCreate`'s budget check caused a live false-rejection of a legitimate offcut once enough rework cycles had accumulated.
3. `rework_of_rejection_id` was persisted but never shown in either UI.
4. `scrapValue`/`disposalValue`/`firewoodValue` were structurally always zero (Disposal's UI never even showed a cost field) — fixed with a backend default from the rejected product's known `standard_cost`, without overwriting the shared Waste Byproduct catalog item's price.

## Documentation
- `TIMBER_LIFECYCLE_PHASE2_COMPLETION_REPORT.md` (this phase's full report).
- `TIMBER_LIFECYCLE_RUNTIME_INTEGRITY_AUDIT.md` (unrelated dependency-output investigation triggered mid-phase; concluded safe, no code changed as a result).

## Not changed
No schema, route, or UI outside the Sawmill/Inventory boundary this phase covers. No new roles. No new stock movement types (`stock_movements.movement_type` remains `'in'`/`'out'` only). Nothing committed or pushed.
