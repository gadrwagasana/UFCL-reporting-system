# Timber Lifecycle Phase 3 — Changelog

## Database (`db/migrate.js`)
- `createTimberLifecyclePhase3()`:
  - `quality_inspections.production_offcut_id` made nullable; new nullable `value_added_timber_id` FK; `num_nonnulls(...)=1` check constraint (polymorphic source, exactly one set).
  - `rejection_holds.production_offcut_id` made nullable; new nullable `value_added_timber_id`, `rework_value_added_timber_id` FKs; same one-source check constraint.
  - `value_added_timber` gained `status` (`pending_qc`/`inspected`) and `rework_of_rejection_id`.
  - New table `showroom_damage_reports` (stock_item_id, warehouse_id, quantity, reason, status, resolution_id, reported_by/at, resolved_by/at).
  - `resolution_records.source_type` check constraint extended to add `'showroom_damage'` (`'rejected_timber'` deliberately reused for VAT-origin holds, not duplicated).
- `grantStockTransfersToNyanzaShowroom()` — additive, idempotent grant of `'stock-transfers'` to `vat-leader`/`vat-supervisor`/`showroom-staff` (user-approved via AskUserQuestion before implementation). Live-confirmed: 3 roles updated.

## Backend (`db/services/data.js`)
- New: `_resolveVatProduct`, `vatQualityInspectionCreate`, `showroomDamageReportCreate`, `showroomDamageReportsList`, `showroomInventoryList`.
- `rejectionHoldsList` — extended with a `sourceType` filter param; LEFT JOINs both `production_offcuts` and `value_added_timber` chains with a `source` discriminator (was an inner join on `production_offcuts` that would have hidden every VAT-origin hold — bug fix, see below).
- `rejectionResolveRework` — branches on which source FK is set: Sawmill-origin holds unchanged (new `production_offcuts` row); VAT-origin holds create a new `value_added_timber` row re-entering `pending_qc` directly.
- `resolutionCreate` — extended for `source_type: 'showroom_damage'` (deducted-at-report-time semantics, no re-deduction on resolve); unit_cost auto-default extended to read from `stock_catalog.unit_cost` for showroom_damage sources.
- `qualityReport` — two subqueries switched from joining `production_offcuts` to filtering on `quality_inspections.workshop_id` directly (bug fix, see below).
- `productsCreate`/costing — unchanged, confirmed reusable for VAT SKUs as-is (`type: 'Timber'` required to land in the correct stock category).

### Bug fixes (found via this phase's own live testing)
1. `valueAddedTimberCreate` never returned the created row's `id` — fixed (`returning id`).
2. `valueAddedTimberCreate`'s and `vatInboundList`'s `intake_used` calculations double-counted rework-descendant `value_added_timber` rows against the source transfer's budget (same class of bug as the Sawmill fix from earlier this session) — fixed with a `rework_of_rejection_id is null` exclusion.
3. `qualityReport`'s two SQL subqueries inner-joined `production_offcuts`, silently excluding all VAT-origin inspections from company-wide reporting — fixed.
4. `rejectionHoldsList`'s inner join on `production_offcuts` would have hidden every VAT-origin rejection hold — fixed with a LEFT JOIN + `source` discriminator.
5. `mobile-api/routes/sales.js`'s `SALES_ROLES`/`DELIVER_ROLES` literal arrays excluded `sales-staff`/`showroom-staff` despite both holding the underlying `'sales'`/`'deliveries'` permissions — fixed.

## mobile-api
- `mobile-api/routes/vat.js` — new `POST /:id/inspect`.
- `mobile-api/routes/rejectionHolds.js` — `GET /` now accepts `sourceType`.
- New `mobile-api/routes/showroomDamage.js` (`GET /`, `POST /`, `GET /inventory`), mounted at `/api/showroom-damage` in `mobile-api/server.js`.
- `mobile-api/routes/sales.js` — role-array fix (see Bug fixes).

## Electron (`electron/main.js`, `electron/preload.js`)
- New IPC handlers + bridge: `value-added-timber:inspect`, `showroom-damage:list/create`, `showroom:inventory`; `rejection-holds:list` extended with `sourceType`.

## Desktop (`renderer/app.js`, `renderer/index.html`)
- `_loadRejectionHolds`/`_loadQualityReport` generalized (`containerId`/`sourceType`/`onChanged` params) so Value-Added Timber reuses the exact Rejection Holds/Quality Report UI Phase 2 built for Sawmill, instead of a duplicate.
- Value-Added Timber page: QC status column, "Inspect" action, rework-lineage badge, new Rejection Holds + Quality Report cards.
- New `renderShowroom()` page: inventory table, "Report Damage" action, damage-reports list with Resolve action. New nav entry (`showroom`, Commercial section), new `#page-showroom` container, new role-permission checkbox entry.
- `openResolutionModal`'s title label fixed to correctly name `rejected_timber`/`showroom_damage` sources (was mislabeling both as "Production offcut").

## Mobile
- `hooks/useVat.ts` — new `useVatInspect`.
- `hooks/useTimberLifecycle.ts` — `useRejectionHoldsList` extended with `sourceType`; `useRejectionHoldActions.rework`'s return type widened for `newVatId`.
- New `hooks/useShowroom.ts` (`useShowroomInventory`, `useShowroomDamageList`, `useShowroomDamageCreate`).
- `types/api.ts` — `RejectionHoldRow` extended (polymorphic fields, `source`, `vat_entry_date`/`vat_type`); `VatEntry` extended (`status`, `rework_of_rejection_id`, inspection results); new `VatInspectResult`, `ShowroomInventoryRow`/`Response`, `ShowroomDamageReportRow`/`ListResponse`; `ResolutionSourceType` extended with `'showroom_damage'`.
- `api/endpoints.ts` — `VAT_INSPECT`, `SHOWROOM_INVENTORY`, `SHOWROOM_DAMAGE_LIST/CREATE`.
- `screens/vat/VatProcessingScreen.tsx` — Inspect action (Alert.prompt), rework-lineage label, new `VatRejectionHoldsCard`.
- New `screens/showroom/ShowroomScreen.tsx` — inventory, damage reporting, damage resolution (Disposal native; Firewood/Scrap point to desktop, matching precedent).
- `navigation/types.ts`/`SalesNavigator.tsx` — new conditional `Showroom` tab, shown only for `showroom-staff`.

## Documentation
- `TIMBER_LIFECYCLE_PHASE3_COMPLETION_REPORT.md` (this phase's full report).

## Not changed
No new stock movement types (`'in'`/`'out'` only, differentiated by `reference` text). No new Resolution Engine for Showroom damage — reused the existing one. No new roles. No duplicate QC engine for VAT — reused Phase 2's `quality_inspections`/`rejection_holds` tables, made polymorphic. Nothing committed or pushed.
