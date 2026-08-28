# Sawmill Phase 1 — Changelog

## Database

**`db/migrate.js`**
- Added `createSawmillInventoryBridge()`: adds `products.stock_item_id` (FK → `stock_catalog.id`), `daily_log_items.product_id` (FK → `products.id`), `sales_orders.product_id` (FK → `products.id`), and their indexes; backfills a linked `stock_catalog` row for every existing active Product Catalog item that lacked one.
- Granted `sawmill-supervisor` the `timber-inventory` permission (was `sawmill.write` with no way to view the resulting stock — closes the Enterprise Audit's own finding).

## Backend (`db/services/data.js`)

- Added `_resolveProductForSize`, `_postFinishedTimberStock`, `_insertDailyLogItemsAndPostStock`, `_reverseDailyLogItemsStock` — the Finished Timber Inventory bridge helpers.
- Rewrote `dailyCreate`/`dailyUpdate`/`dailyDelete` to post/reverse Finished Timber stock inside the same transaction as the production entry; `dailyCreate`/`dailyUpdate` now return `unmappedSizes`.
- Modified `productsCreate` to auto-create and link a `stock_catalog` row for every new Product Catalog item.
- Modified `salesCreate` to resolve the order's product, check Finished Timber stock availability at the sale's workshop, and deduct on success (additive — orders with no catalog match or unknown workshop behave exactly as before).
- Modified `timberInventoryList` to return `finishedTimberFlow`: per-product Ready for Sale (Gatare) / Ready for Transfer / In Transit / Available at Nyanza / Available at Showroom.

## Mobile API

**`mobile-api/routes/sawmill.js`** — added `PUT /:id` and `DELETE /:id`.
**`mobile-api/routes/timberInventory.js`** — added `sawmill-supervisor` to the route's `ALLOWED` role list (kept in sync with the new `timber-inventory` grant).

## Desktop (`renderer/app.js`)

- `renderTimberInventory` — header cross-navigation (→ Sawmill Production, Stock Transfer, Sales); new "Finished Timber Flow" table card.
- `renderDailyTimber` — header cross-navigation (→ Timber Inventory, Stock Transfer).
- `renderSales` — header cross-navigation (→ Timber Inventory).
- Add/Edit Sawmill Timber Entry overlay save handlers — surface an `unmappedSizes` warning in the success toast when applicable.

## Mobile

- `mobile/src/api/endpoints.ts` — `SAWMILL_UPDATE`, `SAWMILL_DELETE`.
- `mobile/src/hooks/useSawmill.ts` — `useSawmillUpdate`, `useSawmillDelete`; `CreateSawmillResult` extended with `unmappedSizes`.
- `mobile/src/navigation/types.ts` — `SawmillProductionCreate` param now optionally carries an `entry` (edit mode); added `SawmillTimberInventory` to `SawmillStackParamList`.
- `mobile/src/navigation/SawmillStack.tsx` — registered `TimberInventoryScreen` as a stack screen (reused component, no duplicate).
- `mobile/src/screens/sawmill/SawmillProductionCreateScreen.tsx` — dual create/edit mode.
- `mobile/src/screens/sawmill/SawmillProductionDetailScreen.tsx` — Edit header action; Delete button + reason-confirmation modal.
- `mobile/src/screens/sawmill/SawmillProductionListScreen.tsx` — header action linking to Timber Inventory (gated on `timber.inventory`).
- `mobile/src/screens/timberInventory/TimberInventoryScreen.tsx` — new `FinishedTimberFlowCard`.
- `mobile/src/types/api.ts` — `FinishedTimberFlowRow`; `TimberInventoryResponse.finishedTimberFlow`.
- `mobile/src/utils/permissions.ts` — granted `timber.inventory` to `sawmill-leader` and `sawmill-supervisor`.

## Verification

- `node --check` clean on all touched backend/desktop files; `tsc --noEmit` clean on mobile.
- Live end-to-end verification of Paths A, B, and C against production DB with throwaway QA data — all inventory quantities, audit logs, notifications, workshop isolation, and Product ID consistency confirmed correct at every stage. All QA data removed afterward (stock_levels reset to pre-verification baseline; zero leftover QA rows in any touched table).

## Not changed

No schema, workflow, or permission change to Harvesting, Sales, Logistics, or Inventory beyond the additive bridge described above. No new inventory system. No Stock Transfer bypass. No "Nyanza timber" special-case logic.
