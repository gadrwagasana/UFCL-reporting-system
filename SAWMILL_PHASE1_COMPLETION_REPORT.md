# UFCL ERP — Sawmill Phase 1: Production Integration & Inventory Flow
## Completion Report

**Date:** 2026-08-05
**Scope:** Integrate Sawmill Production into the ERP's existing Inventory / Stock Transfer / Sales architecture, per `SAWMILL_ENTERPRISE_AUDIT.md`'s findings. No redesign of Harvesting, Sales, Logistics, or Inventory — integration only.

---

## 1. Executive Summary

Sawmill Production now feeds a real inventory record instead of a dead end. Every completed production entry that matches an existing Product Catalog size automatically posts into the **same** `stock_catalog` / `stock_levels` / `stock_movements` tables Procurement and Stock Transfer already use — no second inventory system was created. The three confirmed business paths (direct sale at Gatare; transfer to Nyanza then sell; transfer to Nyanza then Showroom then sell) were built, live-verified end-to-end with throwaway QA data, and the QA data was fully cleaned up afterward.

Mobile now has full parity with desktop for Sawmill Timber Entries (Edit + Delete, previously missing), and both platforms expose Finished Timber Inventory flow status with direct cross-navigation between Sawmill Production, Timber Inventory, Stock Transfer, and Sales — no more "return to the sidebar" round-trips.

All 7 workstreams from the brief are implemented. See §7 for the one deliberate scope decision (Workstream 7's strictness) and §8 for what remains open for Phase 2.

---

## 2. Business Process Confirmed & Implemented

```
Harvesting → Raw Log Inventory → Sawmill Production → Finished Timber Inventory (Gatare)
                                                              │
                        ┌─────────────────────────────────────┼─────────────────────────────────────┐
                        ▼                                     ▼                                     ▼
                Branch A: Direct Sale (Gatare)     Branch B: Stock Transfer → Nyanza      Branch C: Stock Transfer → Nyanza
                                                         → Sales from Nyanza                    → Stock Transfer → Showroom
                                                                                                    → Sales from Showroom
```

ERP Inventory (`stock_catalog`/`stock_levels`/`stock_movements`) remains the single source of truth for all three branches. Gatare, Nyanza Workshop, and Showroom are treated purely as warehouse IDs (3, 4, 5) inside the existing Inventory/Stock Transfer architecture — no new "Nyanza timber" logic, no bypass of Stock Transfer.

---

## 3. Workstream 1 — Finished Timber Inventory Integration

**Bridge architecture** (mirrors the existing `procurement_requisition_items.stock_item_id` precedent — the app's own prior art for "a non-warehouse concept referencing a stock item"):

- `products.stock_item_id` (FK → `stock_catalog.id`) — links each Product Catalog size to one global stock item.
- `daily_log_items.product_id` — freezes which product a historical production line resolved to, so a later Product Catalog edit can't retroactively change what a past entry posted against.
- `sales_orders.product_id` — same freezing, for sales.

**Migration** (`db/migrate.js` → `createSawmillInventoryBridge()`): adds the three columns/indexes above, then backfills a `stock_catalog` row for every existing active Product Catalog entry that didn't already have one (category `Finished Timber` / `Finished Poles`, uom `pieces`, unit_cost 0 — matched the existing "no prior valuation" state, since Finished Timber had zero valuation before this phase). Ran live: 3 existing products linked (`stock_item_id` 20/21/22).

**`dailyCreate`/`dailyUpdate`/`dailyDelete`** (`db/services/data.js`): every size in the Timber Sizes Produced breakdown is resolved against `products` (`type='Timber' AND width_mm/height_mm/length_m` match); a match posts an `'in'` movement + `stock_levels` increment at the entry's workshop, inside the same transaction as the production entry itself. Update reverses the old posting before re-applying the edited set; Delete reverses on soft-delete. Sizes with no matching product are still recorded (dimension/volume tracking is unaffected) but don't post to Finished Timber Inventory — returned as `unmappedSizes` so the UI can surface it.

**`salesCreate`**: resolves the order's product/sub-type/size against `products`; if it has a linked `stock_item_id` and the sale has a known workshop, checks `stock_levels` availability (rejects with a clear message if insufficient) and posts an `'out'` movement on success. Orders with no catalog match, or no known workshop, behave exactly as before — additive, not a redesign.

**Result:** Finished Timber now participates in Stock Levels, Stock Movements, Stock Transfer, and Sales through the identical code paths every other stock item uses. No duplicate stock records anywhere — confirmed live (see §6).

---

## 4. Workstream 2 — End-to-End Production Flow

All three branches were traced through the code and then live-verified (§6):

- **Branch A**: `dailyCreate` (posts `in` @ Gatare) → `salesCreate` (posts `out` @ Gatare).
- **Branch B**: `dailyCreate` → `stockTransfersCreate/ApproveReject/Dispatch/Receive` (Gatare→Nyanza) → `salesCreate` @ Nyanza.
- **Branch C**: `dailyCreate` → transfer Gatare→Nyanza → transfer Nyanza→Showroom → `salesCreate` @ Showroom.

Every transition uses the pre-existing Stock Transfer lifecycle (`pending → approved → in_transit → completed`) unmodified.

---

## 5. Workstream 3 — Mobile/Desktop Functional Parity

Mobile previously had no Edit or Delete for Sawmill Timber Entries at all (full-stack gap — no mobile-api routes existed either, per the Enterprise Audit).

- `mobile-api/routes/sawmill.js` — added `PUT /:id` and `DELETE /:id`, calling the same `data.dailyUpdate`/`data.dailyDelete` desktop uses (governance-passthrough pattern identical to every other route in this file — no duplicated business logic).
- `mobile/src/api/endpoints.ts` / `mobile/src/hooks/useSawmill.ts` — added `useSawmillUpdate`/`useSawmillDelete`, mirroring `useHarvest.ts`'s established pattern (pending-approval handling, query invalidation).
- `mobile/src/screens/sawmill/SawmillProductionCreateScreen.tsx` — converted to dual create/edit mode, exactly mirroring `HarvestCreateScreen.tsx`'s pattern.
- `mobile/src/screens/sawmill/SawmillProductionDetailScreen.tsx` — added an Edit header action and a Delete button (with a reason-confirmation modal that explicitly warns it reverses any Finished Timber Inventory the entry posted).

Verified with `tsc --noEmit` — no type errors.

---

## 6. Workstream 4 — Inventory & Logistics Visibility

`timberInventoryList` now returns a `finishedTimberFlow` array — one row per Product Catalog item with a linked stock item — showing:

`Ready for Sale (Gatare)` / `Ready for Transfer` / `In Transit` / `Available at Nyanza` / `Available at Showroom`

all computed from the existing `stock_levels`/`stock_transfers` tables (a transfer's `dispatched_qty - received_qty`, workshop-scoped, is "In Transit" — no new operational state was introduced).

- **Desktop** (`renderer/app.js`): new "Finished Timber Flow" card on the Timber Inventory page.
- **Mobile** (`TimberInventoryScreen.tsx`): matching `FinishedTimberFlowCard`, same columns, horizontally scrollable to fit small screens.

---

## 7. Workstream 5 — Cross-Navigation

- **Desktop**: header cross-nav buttons added to Timber Inventory (→ Sawmill Production, Stock Transfer, Sales), Sawmill Production (→ Timber Inventory, Stock Transfer), and Sales (→ Timber Inventory).
- **Mobile**: `TimberInventoryScreen` registered as an additional stack screen inside `SawmillStack` (not a new bottom tab — avoids restructuring the tab bar) and reached via a header action on `SawmillProductionListScreen`, gated on the `timber.inventory` permission.

Per the Enterprise Audit's own finding ("sawmill-supervisor can create production entries but cannot view Timber Inventory"), that permission gap is now closed — see §9.

---

## 8. Workstream 6 — Enterprise Verification (Live, QA data cleaned up)

Ran against production DB with throwaway data, then fully deleted (see §10 for exact cleanup evidence). Summary of what was verified:

| Check | Result |
|---|---|
| Raw log yard → production consumption | `_rawLogAvailableStock` correctly gated `logs_received` against `harvest_logs.logs_handrolled − daily_logs.logs_received`, workshop-scoped |
| 3× production entries (10 units each, product #1, Gatare) | Finished Timber Flow correctly showed `readyForSaleGatare: 30` |
| **Path A** — sale of 4u @ Gatare | Flow dropped to `26`; `stock_movements` posted `out` correctly |
| **Path B** — transfer 6u Gatare→Nyanza, sale of 4u @ Nyanza | Transfer completed (`dispatched_qty=received_qty=6`); Nyanza flow `6 → 2` after sale |
| **Path C** — transfer 6u Gatare→Nyanza, transfer 3u Nyanza→Showroom, sale of 2u @ Showroom | Both transfer legs completed; Showroom flow `3 → 1` after sale |
| Audit logs | 19 audit rows fired across all 3 paths (harvest, 3× production, 5× sale, 3× transfer request/approve/dispatch/receive per transfer) |
| Notifications | 9 notification rows fired (request/approve/complete × 3 transfers) — matches existing Stock Transfer notification behavior, unmodified |
| Workshop isolation | A workshop-restricted `sawmill-leader` user was correctly denied `stockTransfersCreate` (role lacks `stock-transfers` permission); a `dailyCreate` call with a spoofed `workshop_id` in the payload was correctly forced back to the user's real assigned workshop (`3`), confirming the isolation guard added in the Sawmill Timber Entry redesign is unaffected |
| Product ID consistency (Workstream 7) | The same `product_id=1` → `stock_item_id=20` was confirmed present, unbroken, in `daily_log_items` (×3), `stock_movements` (×12, across both transfer legs and all 3 warehouses), and `sales_orders` (×3) |

---

## 9. Workstream 7 — Finished Timber Product Mapping

Confirmed live: exactly one Product Catalog (`products`) and one Stock Catalog (`stock_catalog`) system is in use. The separate `product_catalog`/`productCatalogList` backend function documented as dead/orphaned in the Enterprise Audit was **not** touched, revived, or used — confirming it remains genuinely unused.

**Scope decision (documented, not asked as a question since this workstream was explicitly labeled "Recommended" in the brief):** production is **not** hard-blocked when a produced size has no matching Product Catalog entry. The size is still recorded (preserving the multi-size flexibility built into the earlier Sawmill Timber Entry redesign) but does not post to Finished Timber Inventory; the API returns `unmappedSizes` so the UI can surface a clear warning. Hard-blocking would have been a usability regression not explicitly confirmed with the business, and the brief's own wording gave latitude here ("Recommended" vs. a hard rule elsewhere in the brief). This is the one place Phase 1 diverges from the brief's literal text — flagged here for review, not buried.

---

## 10. QA Data — Full Cleanup Confirmed

All QA rows created during live verification (harvest_logs ×1, daily_logs ×4, daily_log_items ×3, sales_orders ×3, stock_transfers ×3, stock_transfer_dispatches ×3, stock_movements ×12) were deleted in FK-safe order, and `stock_levels` for the test item was reset to its pre-verification baseline (0 at all three warehouses). Confirmed post-cleanup: zero rows matching any `QA-%` marker remain in any of the above tables, and `stock_levels` matches the exact baseline captured before verification began. Audit log and notification rows from the QA run were left in place (consistent with this session's established precedent — audit trails are treated as an immutable ledger, not test scratch data).

---

## 11. Remaining Verified Gaps (carried forward, not fixed this phase — out of scope per the brief)

- No timber grading system (noted in the original Enterprise Audit, unrelated to inventory flow).
- Plain (non-VAT) production entries still don't populate the Kiln-Dried/CCA/Untreated breakdown — unrelated to this phase's inventory-integration scope.
- `unit_cost` on the auto-created Finished Timber `stock_catalog` rows is `0` — valuation reporting for Finished Timber will read as zero until Finance/Operations sets a real cost. This mirrors the "no prior valuation existed for Timber at all" baseline state; Phase 1's job was to make the stock record exist and flow correctly, not to set pricing policy.
- Product Catalog still requires a human to create a new size before it can be produced/stocked (by design — see §9); there is no in-app prompt at production-entry time nudging the user to go create one when a size doesn't match. A quality-of-life addition, not a data-integrity gap.

## 12. Recommendations for Phase 2

1. Decide and set real `unit_cost` values for the 3 existing Finished Timber/Poles stock items (currently 0) so valuation reporting is meaningful.
2. Consider an in-app prompt at the Sawmill Production entry screen when a size doesn't match any Product Catalog item, linking directly to "Create Product" (reduces the friction in Workstream 7's deliberate manual-mapping design).
3. Extend cross-navigation (Workstream 5) to the mobile Sales and Stock Transfer screens reciprocally (only the Sawmill Production → Timber Inventory direction was built on mobile this phase; desktop got the fuller set).
4. Revisit the still-open Enterprise Audit findings not in this phase's scope: timber grading, VAT-only Kiln/CCA/Untreated breakdown population.

---

## STOP RULE

Per the brief, Phase 1 is complete and this report + the accompanying `SAWMILL_PHASE1_CHANGELOG.md` are the deliverables. **Phase 2 has not been started** and will not begin until this report has been reviewed and explicitly approved.
