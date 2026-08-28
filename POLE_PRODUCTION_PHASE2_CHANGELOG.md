# Pole Production Phase 2 — Changelog

Scope: added Purchased Finished Poles (Path B) behind a Quality Inspection gate, reusing the exact `pending_qc → inspected` decoupling shape Phase 1 already established for manufactured poles (Path A). Extended the shared polymorphic `quality_inspections`/`rejection_holds` engine from 3-way to 4-way. Closed one real, pre-existing mobile gap Phase 1 deferred (no mobile screen for pole rejection resolution, for either source). Fixed one real, pre-existing permission bug and two bugs found during this phase's own live testing. No new procurement, inventory, QC, approval, or notification engine was created. Nothing committed or pushed.

## Added

### `db/migrate.js`
- New function `createPoleProductionPhase2()`, called at the end of `migrate()` after `createPoleProductionPhase1()`:
  - `procurement_goods_receipt_items.qc_status` — new column, `text not null default 'not_required' check (qc_status in ('not_required','pending_qc','inspected'))`. Every existing row (and every future non-Poles line) defaults to `'not_required'` and is unaffected.
  - `quality_inspections.procurement_goods_receipt_item_id` / `rejection_holds.procurement_goods_receipt_item_id` — a fourth polymorphic source column, added the exact same way the third (`pole_production_output_id`) was added in Phase 1. Both one-source-per-row CHECK constraints (`quality_inspections_source_check`, `rejection_holds_source_check`) extended from 3-way to 4-way, drop-then-recreate under the same constraint name, idempotent via `if not exists`.
  - No `rework_procurement_goods_receipt_item_id` column — Rework is explicitly not supported for this source (see `data.js` below).
- Migration run twice consecutively against the live database — idempotent both times.

### `db/services/data.js`
- `procurementGoodsReceiptCreate` — extended (not replaced): each line now resolves its linked `stock_catalog.category` via a join; if it equals `'Finished Poles'` and quantity received is > 0, the line is inserted with `qc_status='pending_qc'` and the existing stock-posting block is skipped for that line. Every other category takes the unchanged, immediate-post path. Fires a new `'Purchased poles awaiting Quality Inspection'` notification (`relatedModule: 'purchased_pole_qc'`) when any line is held.
- `procurementGoodsReceiptPendingPoleQC(userId, workshopId)` — new. Lists goods-receipt lines held at `qc_status='pending_qc'`, joined with PO/supplier/product/workshop, workshop-isolated.
- `procurementGoodsReceiptInspect(userId, receiptItemId, payload)` — new. Directly mirrors `poleProductionInspect`: resolves the Product Catalog row via `products.stock_item_id`, creates a `quality_inspections` row with the new source column set, posts accepted quantity via the existing `_postFinishedTimberStock`, creates a `rejection_holds` row for anything rejected, flips the line to `qc_status='inspected'`.
- `polesSourceReport(userId, workshopId)` — new. Aggregates manufactured (`pole_production_outputs`) vs. purchased (`procurement_goods_receipt_items`) totals — produced/purchased/accepted/rejected/reworked/resolved — plus combined live inventory/sales figures (both sources post to the same `stock_catalog` row, stated explicitly in the response's own `note` field).
- `rejectionResolveRework` — added an explicit 4th branch for `procurement_goods_receipt_item_id`-sourced holds, returning a clear, specific error instead of the prior code's implicit (and unsafe) assumption that "not offcut, not VAT" meant "must be a manufactured pole."
- `rejectionHoldsList` — extended the source discriminator from 3-way to 4-way (adds `'purchased_pole'`), joined through to Purchase Order/Supplier/Receipt for display. The existing `sourceType='poles'` filter now also matches purchased-pole-origin holds (widened, not replaced — `'sawmill'`/`'value_added'` callers are unaffected). Access check widened to also accept `'procurement-goods-receipt'` permission holders.
- `resolutionCreate` / `resolutionsList` — **bug fix, found during this phase's audit, not new-build-specific**: the permission OR-list never included `'daily-poles'`, so a pure poles-tier account (`poles-leader`/`poles-supervisor`, who hold only `'daily-poles'`) could see a rejection hold but could not resolve it to Firewood/Scrap Sale/Disposal. Added `'daily-poles'` to both — additive, no existing access narrowed.
- All 3 new functions added to `module.exports`.

### `electron/main.js` / `electron/preload.js`
- 3 new IPC channels (`poles:purchased-pending-qc`, `poles:purchased-inspect`, `poles:source-report`) and matching preload bindings, following the exact naming convention the existing `poles:production-*` channels use.

### `mobile-api/routes/poles.js`
- 3 new REST routes (`GET /api/poles/purchased/pending-qc`, `POST /api/poles/purchased/:id/inspect`, `GET /api/poles/source-report`), same governed-passthrough convention already used elsewhere in this program's mobile routes.

### `renderer/app.js`
- `renderDailyPoles()` — added a "Purchased Finished Pole QC" card (list + per-line Inspect overlay, same style as the existing Pole Production Batches Inspect flow) and a "Pole Source Report" card (Purchased vs. Manufactured table + live inventory/sold figures).
- "Rejection holds (poles)" card — no structural change (the backend's widened `'poles'` filter now surfaces both sources automatically); the row template now shows the pole batch date for manufactured-origin holds (a small, real display gap found while extending this cell — `pole_batch_date` was selected by the backend since Phase 1 but never rendered) and PO/supplier for purchased-origin holds. Rework's confirm dialog now branches per-row on the hold's actual source (4-way) instead of the page-level `sourceType`, and shows an informational block for purchased-pole holds instead of attempting a rework that would only error.
- `openGoodsReceiptDetailOverlay` — added a "Quality Status" column showing the new `qc_status` per line, plus an informational note when any line is pending Pole QC.
- `NOTIFICATION_ROUTES` — added `'purchased_pole_qc': { page: 'daily-poles' }` (page-only, same class as `'material-requests'`).

### Mobile (`mobile/src/`)
- `types/api.ts` — added `PendingPoleQCItem`, `PendingPoleQCListResponse`, `PoleGoodsReceiptInspectResult`, `PolesSourceReport`. **Also fixed** `RejectionHoldRow` — it had drifted out of date since Phase 1 (`source` only listed `'sawmill' | 'value_added'`); corrected to the real 4-way union and added the missing `pole_production_output_id`/`procurement_goods_receipt_item_id`/`rework_pole_production_output_id`/`pole_batch_date`/`pole_batch_id`/`purchase_po_number`/`purchase_supplier_name`/`purchase_receipt_number` fields the backend already returns.
- `api/endpoints.ts` — added the 3 new endpoint constants.
- `hooks/usePoles.ts` — added `usePendingPoleQC`, `usePoleGoodsReceiptInspect`, `usePolesSourceReport`. **Bug fix**: `usePoleProductionInspect` and the new `usePoleGoodsReceiptInspect` both invalidated a React Query key (`'pole-rejection-holds'`) that nothing ever subscribed to — the real key `useRejectionHoldsList` (`useTimberLifecycle.ts`) uses is `'rejection-holds-list'`. Corrected at both call sites.
- `navigation/types.ts` — extended `PolesProductionStackParamList` with `PurchasedPoleQC`, `PurchasedPoleQCInspect`, `PoleRejectionHolds` (nested into the existing stack, same "stack push, not a new tab" pattern Phase 1 established).
- `navigation/PolesProductionStack.tsx` — registered the 3 new screens.
- `screens/poles/PurchasedPoleQCScreen.tsx` — new. List of pending purchased-pole lines, mirrors `PoleBatchListScreen`'s structure.
- `screens/poles/PurchasedPoleQCInspectScreen.tsx` — new. Accept/reject form, directly mirrors `PoleBatchInspectScreen`.
- `screens/poles/PoleRejectionHoldsScreen.tsx` — new. **Closes the mobile gap Phase 1 explicitly deferred**: Phase 1's own CRUD parity matrix documented that mobile had no screen at all for Rework/Downgrade/Return/Firewood/Scrap/Disposal on rejected poles, despite the backend being fully generic. This screen (using the existing `useRejectionHoldsList`/`useRejectionHoldActions`/`useResolutionCreate` hooks, `sourceType='poles'`) mirrors the Sawmill/VAT embedded-card pattern as a standalone screen, and serves **both** manufactured and purchased poles in one place — closing Phase 1's deferred item and this phase's own Path B requirement with a single build.
- `screens/poles/PolesProductionScreen.tsx` — added "Purchased Pole QC" and "Rejection Holds" entry-point banners, navigating into the new stack-pushed screens.
- `utils/notificationRouting.ts` — added `'purchased_pole_qc'` (routes to the `PurchasedPoleQC` screen; `relatedId` unused, consistent with the resolver's `(id) => {screen,params}` shape).

## Not built (documented as deferred, correctly scoped)

- Attachment support for purchased-pole QC lines (photos/documents) — see completion report §5/§23.
- Mobile Pole Source Report screen — hook built, no screen this phase.
- Mobile Downgrade product picker / Firewood-Scrap warehouse field — intentionally matches Sawmill/VAT's own existing mobile restriction, not relitigated.
- Splitting purchased vs. manufactured live stock into separate buckets — genuine architecture decision, not attempted.
- Per-unit volume capture on purchased-pole QC — no source data exists to compute it from; not fabricated.

## Verification

- `node --check` clean on `db/migrate.js`, `db/services/data.js`, `electron/main.js`, `electron/preload.js`, `mobile-api/routes/poles.js`, `renderer/app.js`.
- `npx tsc --noEmit` clean across `mobile/` (re-run after a live-QA-driven fix — see Bugs Discovered).
- Migration run twice consecutively against the live database — idempotent both times; schema changes independently verified via direct query (`qc_status` column, both 4-way CHECK constraints, both new FK columns).
- Full live scenario (Supplier → Requisition → real multi-stage approval chain → RFQ → Quotation → PO → Goods Receipt held pending QC → 4 independent inspections covering clean-accept / downgrade / return-to-inventory / firewood, plus an explicitly-blocked rework attempt) run against the live database with disposable, uniquely-tagged QA data — **33/33 real checks passed**. Workshop Isolation independently re-verified with an active, real, differently-scoped account (zero cross-workshop leakage). Reconciliation math confirmed exact (received = accepted + resolved + remaining, no unexplained loss).
- 2 real runtime bugs found during this live test (a nonexistent-column reference in the new `procurementGoodsReceiptPendingPoleQC`, and the pre-existing wrong React Query invalidation key) were fixed and the test re-run to confirm the fix, not merely logged.
- All QA data (1 supplier, 1 requisition + items + approval steps, 1 RFQ + quotation, 1 PO + items, 1 goods receipt + items, 4 quality_inspections, 3 rejection_holds, 1 resolution_record, 7 stock_movements, 33 notifications) fully deleted after the run; `stock_levels` reset to exact original values for all 3 touched (item, warehouse) pairs; zero residue independently verified via direct query.

## Not committed

Per this phase's Stop Rule, nothing above has been committed or pushed. All changes are local working-tree edits pending review.
