# Nyanza Value-Added Production & Finished Products — Changelog

Scope: replaces "Value-Added Timber" (single-row, same-size treatment only, no real stock consumption, zero production rows ever recorded) with a general batch + input/output-lines production model. No other department's workflow, approval, notification, or Workshop Isolation logic was touched.

## Schema (`db/migrate.js`)

- New tables: `value_added_production_batches` (parent), `value_added_production_inputs`, `value_added_production_outputs` (children, many per batch).
- `quality_inspections.value_added_timber_id` → renamed `value_added_production_output_id`, FK repointed to the new outputs table (CHECK constraint unaffected — Postgres tracks it by attnum, not name).
- `rejection_holds.value_added_timber_id`/`rework_value_added_timber_id` → renamed and repointed the same way.
- `value_added_timber` table dropped (zero live rows — confirmed via live audit before this phase; every dependent FK was repointed first).
- `role_definitions.permissions`: `value-added-timber` renamed to `value-added-production` for the 6 roles that held it (`admin`, `ceo`, `operations`, `supervisor`, `vat-leader`, `vat-supervisor`).
- `mv_stock_summary`/`mv_stock_by_workshop` materialized views: their `value_added` CTE (Kiln-dried/CCA-treated volume) repointed from `value_added_timber` to `value_added_production_outputs` joined to `products.sub_type`, same "drop and recreate" pattern already used for prior formula updates — semantics preserved exactly (sums all output quantity regardless of QC status, matching the old column's own original behavior).
- `SOFT_DELETE_TABLES` (the generic column-provisioning loop): `value_added_timber` removed (columns are already defined inline on the new table; the old entry would otherwise error on any future migrate() run against a dropped table).

## Backend (`db/services/data.js`)

- New: `valueAddedProductionAvailableInputs`, `valueAddedProductionBatchList`, `valueAddedProductionBatchCreate` (real stock-availability check + real `stock_movements` consumption, replacing the old soft transfer-budget counter), `valueAddedProductionBatchUpdate` (metadata-only), `valueAddedProductionBatchDelete` (soft-delete + input-stock reversal), `valueAddedProductionInspect` (was `vatQualityInspectionCreate`, now per output line), `valueAddedProductionReconciliation`, `valueAddedProductionReport`.
- Removed: `_resolveVatProduct`/`VAT_TYPE_TO_SUBTYPE` (no longer needed — output product is chosen directly, not inferred from a type+size combo), `vatInboundList`, `valueAddedTimberList/Create/Update/Delete`, `vatQualityInspectionCreate`.
- `rejectionResolveRework`: VAT branch now inserts a new `value_added_production_outputs` row on the same batch instead of a new `value_added_timber` row.
- `productsCreate`: label/stock-category logic generalized from a `Timber`-or-`Poles` binary ternary to a 3-way branch, so the new "Manufactured Product" type doesn't get mislabeled "Poles {size}" or filed under the wrong stock category.
- `productsList`: added the `Manufactured Product` filter case.
- Governance/Trash plumbing updated for the new entity type: `pendingEditsCreate`'s/`applyPendingEdit`'s table maps and edit-apply switch case, `SOFT_DELETE_ALLOWED`, `TRASH_TABLES`. `applyPendingEdit`'s delete branch and `trashRestore`/`trashPurge` gained batch-specific handling (input-stock reversal on approved-delete, re-consumption-with-availability-check on restore, child-row cleanup on purge) — the generic paths would otherwise have left stranded/incorrect stock for this entity specifically, since it (unlike most other soft-deletable rows) has real posted stock consequences.
- `rejectionHoldsList`: repointed its VAT join from `value_added_timber` to `value_added_production_outputs`/`value_added_production_batches`; the `vat_type`/`vat_entry_date` no-catalog-match fallback columns were removed (no longer needed — `output_product_id` always resolves now).
- `STOCK_SQL` (dead constant, kept in sync for consistency) updated the same way as the materialized views.
- **Bug found via live testing, fixed**: `valueAddedProductionReconciliation` and `valueAddedProductionReport` initially summed rework-descendant output rows in addition to their originals, double-counting "produced" totals. Both now exclude `rework_of_rejection_id IS NOT NULL` rows from that sum (mirroring `productionReconciliation`'s existing `tracked_offcuts` exclusion for Sawmill); `total_accepted`/`total_rejected` remain unfiltered (every real inspection event, matching `qualityReport`'s own convention).
- Permission key `value-added-timber` → `value-added-production` in every `mustRole`/`ROLE_PAGES`/`PROD_SUB_TOKENS`/`expandPages` reference (10 occurrences, all the hyphenated permission-key form).

## Desktop (`renderer/app.js`, `renderer/index.html`)

- `renderValueAddedTimber` → `renderValueAddedProduction`: batch list/create/edit/delete, per-output Inspect, new Input Consumption/Output Production report card.
- Nav id/permission `value-added-timber` → `value-added-production`; page container id `page-value-added-timber` → `page-value-added-production` (`index.html`).
- `_loadRejectionHolds`: `vat_entry_date`/`vat_type` fallback references replaced with `vap_batch_date`; rework toast message updated (`r.newVatId` → `r.newOutputId`).
- Product Catalog form (`renderProducts`): added "Manufactured Product" type option, free-text size field for it, filter chip, corrected `length_m`/`diameter_mm` payload logic (previously always sent the Poles-field value for any non-Timber type).

## Electron IPC (`electron/main.js`, `electron/preload.js`)

- `vat:inbound-list` → `vat:available-inputs`; `value-added-timber:*` channels → `value-added-production:*` (list/create/update/delete/inspect), plus two new channels (`reconciliation`, `report`). Preload bridge renamed to match.

## Mobile API (`mobile-api/routes/vat.js`)

- Rewritten: `GET /api/vat/available-inputs` (was `/inbound`), `GET/POST /api/vat`, `PUT/DELETE /api/vat/:id` (new), `POST /api/vat/outputs/:outputId/inspect` (was `/api/vat/:id/inspect`), `GET /api/vat/reconciliation` and `/api/vat/report` (new).

## Mobile (`mobile/src/...`)

- `types/api.ts`: VAT type block replaced (`VapAvailableInput(s)`, `VapBatch`, `VapBatchInputLine`, `VapBatchOutputLine`, `VapInspectResult`, `VapReconciliation*`, `VapReport*`); `ProductType` gained `'Manufactured Product'`; `RejectionHoldRow` field names updated to match the renamed backend columns.
- `hooks/useVat.ts`: fully rewritten to the batch/input/output shapes.
- `hooks/useProducts.ts`: `ProductPayload.type` extended.
- `hooks/useTimberLifecycle.ts`: rework result field `newVatId` → `newOutputId`.
- `api/endpoints.ts`: VAT endpoint block updated to the new paths.
- `navigation/types.ts`: `VatInboundStackParamList` dropped `VatIntakeCreate`; `VatEntriesStackParamList.VatDetail` now takes `{ batch: VapBatch }`.
- `navigation/VatInboundStack.tsx`: down to one screen (batch-creation form is now the root).
- `navigation/VatNavigator.tsx`/`VatSupervisorNavigator.tsx`: "Inbound" tab relabeled "New Batch" (icon updated), route key kept unchanged (lower-risk than a param rename).
- `screens/vat/VatInboundScreen.tsx`: rewritten in place as the batch-creation form (dynamic add/remove input and output lines).
- `screens/vat/VatIntakeScreen.tsx`: **deleted** (fully absorbed into the rewritten `VatInboundScreen.tsx`).
- `screens/vat/VatProcessingScreen.tsx`: rewritten for per-output-line inspection; added an inline production report card.
- `screens/vat/VatDetailScreen.tsx`: rewritten as a genuine batch drill-down (was a flat single-entry display).
- `screens/products/ProductFormScreen.tsx`/`ProductsListScreen.tsx`: "Manufactured Product" type support (free-text size, filter chip).
- `screens/admin/UserPermissionsScreen.tsx`/`RoleDetailScreen.tsx`: permission key label updated.

## Utility scripts

- `db/clear-data.js`: truncate list updated (`value_added_timber` → the 3 new tables; `TRUNCATE ... CASCADE` already handles FK order regardless of listing order).
- `tools/verify_production.js`: table-existence checks and per-role permission assertions (`must`/`must_not` for `vat-leader` and 3 other leader roles) updated to the new table/permission names — would otherwise have started failing on next run.

## Verification

- `node --check` clean: `db/migrate.js`, `db/services/data.js`, `electron/main.js`, `electron/preload.js`, `renderer/app.js`, `mobile-api/routes/vat.js`, `mobile-api/routes/products.js`, `mobile-api/server.js`, `db/clear-data.js`, `tools/verify_production.js`.
- `npx tsc --noEmit` clean across the full `mobile/` app.
- Live E2E test against the production database (QA-tagged data, fully cleaned up, zero residue verified afterward): real stock consumption, over-consumption rejection, QC accept/reject, rework-on-same-batch, both reconciliation cases, Workshop Isolation, report accuracy — all passed (see completion report §19 for detail).
- Repo-wide grep swept for every old identifier; found and fixed 4 files beyond the core implementation (listed above under "Utility scripts" and "Mobile").

## Not committed

Per this phase's Stop Rule, nothing above has been committed or pushed. All changes are local working-tree edits (plus the already-applied, already-verified live database migration) pending your review.
