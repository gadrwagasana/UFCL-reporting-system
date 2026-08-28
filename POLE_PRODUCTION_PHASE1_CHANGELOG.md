# Pole Production Phase 1 — Changelog

Scope: closed the 3 confirmed architectural gaps in manufactured pole production (no batch/output concept, no shared QC/Resolution engine reuse, no real Finished Pole Inventory) by mirroring the existing Nyanza Value-Added Production model exactly. Purchased finished poles (Path B) and the existing `poles_purchase_requests`/`poles_deliveries` pipeline were deliberately left untouched. Also fixed one unrelated, pre-existing Workshop Isolation gap found during the audit (`dispatchReview`). No new procurement, inventory, QC, approval, or notification engine was created. Nothing committed or pushed.

## Added

### `db/schema.sql`
- No changes (the new tables are created by `db/migrate.js`, matching this codebase's convention for every prior production-batch feature).

### `db/migrate.js`
- New function `createPoleProductionPhase1()`, called at the end of `migrate()` after `createNyanzaValueAddedProduction()`:
  - `pole_production_batches` table (workshop, batch date, operator/supervisor/machine, timing, downtime, input raw log quantity, notes, soft-delete columns).
  - `pole_production_outputs` table (batch_id, output_product_id, quantity, QC status, rework linkage) — one row per output spec per batch.
  - `quality_inspections.pole_production_output_id` — a third polymorphic source column, added the exact same way `value_added_production_output_id` was added as the second one. The one-source-per-row CHECK constraint was extended from 2-way to 3-way (`num_nonnulls(production_offcut_id, value_added_production_output_id, pole_production_output_id) = 1`).
  - `rejection_holds.pole_production_output_id` / `rework_pole_production_output_id` — same third-source extension.
- Migration run twice consecutively against the live database — both succeeded, fully idempotent.

### `db/services/data.js`
- `_polesAvailableRawLogQty(workshopId)` — new shared helper factoring out the "approved deliveries minus consumed" balance computation, now accounting for consumption via both the legacy `daily_logs.poles_units`/`poles_waste` counter and the new `pole_production_batches.input_raw_log_qty`, so neither entry point can over-consume past what the other already used. `polesPurchaseList` and `dailyCreate`'s poles_units validation were refactored to call this helper instead of duplicating the SQL (behavior-preserving — confirmed via a live call returning identical figures before and after).
- `poleProductionBatchesList`, `poleProductionBatchCreate`, `poleProductionBatchDelete` — new batch CRUD, workshop-isolated, validated against the shared raw-log balance.
- `poleProductionInspect` — new QC-accept/reject function, directly mirroring `valueAddedProductionInspect`: posts accepted quantity to real inventory via the existing `_postFinishedTimberStock` helper, creates a `rejection_holds` row for anything rejected.
- `poleProductionReconciliation` — new reconciliation function (input raw logs vs. accepted/rejected/pending output, output volume computed from each product's own diameter/length, piece-count-based recovery %, with an explicit note on why volume-based recovery isn't computable from current raw-log purchase data).
- `rejectionResolveRework` — added a third branch (poles), alongside the existing Sawmill and Nyanza branches.
- `rejectionHoldsList` — extended the source discriminator from 2-way (`sawmill`/`value_added`) to 3-way (adds `poles`), added `daily-poles` to the access check, joined `pole_production_outputs`/`pole_production_batches` for display.
- `dispatchReview` — **bug fix, unrelated to the new build**: the dispatch-quantity gate read the global `mv_stock_summary` instead of the workshop-scoped `mv_stock_by_workshop`, found during this phase's Workshop Isolation audit. Now uses the workshop-scoped view when the sales order has a known workshop, falling back to the global view for legacy/unscoped orders.
- All 5 new functions added to `module.exports`.

### `electron/main.js` / `electron/preload.js`
- 5 new IPC channels (`poles:production-list/create/delete/inspect/reconciliation`) and matching preload bindings, following the exact naming convention the existing `poles:purchase-*`/`poles:delivery-*` channels already use.

### `mobile-api/routes/poles.js`
- 5 new REST routes (`GET/POST /api/poles/production`, `DELETE /api/poles/production/:id`, `POST /api/poles/production/outputs/:id/inspect`, `GET /api/poles/production/reconciliation`), same governed-passthrough convention already used elsewhere in this program's mobile routes.

### `renderer/app.js`
- `renderDailyPoles()` — added a "Pole Production Batches" card (list with per-output-line inline Inspect action, a "New Production Batch" overlay with a multi-output-line builder reusing the existing `_vapOutputRowHtml` component), a "Rejection holds (poles)" card reusing the existing `_loadRejectionHolds` shared component with a new `'poles'` source type, a "Production reconciliation" card, and a "Resolution History" button reusing the existing `openResolutionHistoryModal` (poles resolutions reuse the `'rejected_timber'` `resolution_records.source_type`, the same generic reuse Sawmill/Nyanza rejections already use — no new source type was added).

### Mobile (`mobile/src/`)
- `types/api.ts` — added `PoleBatchOutputLine`, `PoleProductionBatch`, `PoleProductionBatchListResponse`, `PoleProductionInspectResult`, `PoleProductionReconciliation`.
- `hooks/usePoles.ts` — added `usePoleProductionBatches`, `usePoleProductionBatchCreate`, `usePoleProductionBatchDelete`, `usePoleProductionInspect`, `usePoleProductionReconciliation`.
- `api/endpoints.ts` — added the 5 new endpoint constants.
- `navigation/types.ts` — extended `PolesProductionStackParamList` with `PoleBatchList`/`PoleBatchCreate`/`PoleBatchInspect` (nested into the *existing* stack rather than a new bottom tab — the Poles tab bar already has 10 tabs; matches this codebase's own established "extra screens live in the existing stack" pattern already used for Sawmill's Timber Inventory/Dashboard screens).
- `navigation/PolesProductionStack.tsx` — registered the 3 new screens.
- `screens/poles/PoleBatchListScreen.tsx`, `PoleBatchCreateScreen.tsx`, `PoleBatchInspectScreen.tsx` — new screens, directly mirroring VAT's own `VatInboundScreen`/`PolesQualityCheckScreen` patterns.
- `screens/poles/PolesProductionScreen.tsx` — added a "Pole Production Batches" entry-point banner in the list header, navigating into the new stack-pushed screens.

Both `poles-leader` and `poles-supervisor` mobile roles automatically get the new screens, since they share the same underlying navigation stack — matching the backend's `POLE_PRODUCTION_ROLES` permission scope exactly, no separate registration needed.

## Not built (documented as business decisions)

- Purchased Finished Poles (Path B) QC gate — see completion report §25.
- Migrating `poles_purchase_requests`/`poles_deliveries` onto the generic Requisition/PO pipeline.
- Raw log dimension capture (needed for volume-based, not just piece-count, recovery reporting).
- `poles_deliveries.unit_price` → automatic product costing linkage.
- Retiring the legacy `daily_logs.poles_units` entry path.

## Verification

- `node --check` clean on `db/migrate.js`, `db/services/data.js`, `renderer/app.js`, `electron/main.js`, `electron/preload.js`, `mobile-api/routes/poles.js`.
- `npx tsc --noEmit` clean across `mobile/`.
- Migration run twice consecutively against the live database — idempotent both times.
- Full scenario suite (purchase → approve → deliver → QC → production batch → multi-output → QC accept → real inventory posting → rejection → rework → re-inspect → real posting → generic Return-to-Inventory resolution) run **twice** against the live database with disposable QA data — 18/18 real checks passed both times (2 additional "failures" both runs were a correct, pre-existing permission boundary: `poles-leader` is intentionally excluded from Downgrade/Return-to-Inventory, the same restriction `vat-leader` already has — not a bug).
- `dispatchReview`'s fix smoke-tested directly (both the workshop-scoped and global-fallback code paths execute without error).
- All QA data fully deleted after each run; `stock_levels` reset to its exact original value; zero residue verified via direct query after both runs. `audit_log` entries from the verification were intentionally left in place, per this program's established practice.

## Not committed

Per this phase's Stop Rule, nothing above has been committed or pushed. All changes are local working-tree edits pending review.
