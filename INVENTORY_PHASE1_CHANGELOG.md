# Inventory Department — Phase 1 Changelog

Architecture Consolidation, Critical Issues & Security. See `INVENTORY_PHASE1_COMPLETION_REPORT.md` for full detail.

## Backend (`db/services/data.js`)

- **Consolidated the item catalog (Critical-01)**: `inventoryList`, `logisticsList`, `logisticsCreate`, `logisticsUpdate`, `logisticsDelete` all migrated from the disconnected `logistics_items` table onto the authoritative `stock_catalog`/`stock_levels` system. `logisticsCreate`/`Update` no longer accept a direct `stock` quantity (matches Stock Catalog's own convention — quantity is always set via a Stock Movement). Governance entity type renamed `logistics_item` → `stock_item`, shared with Stock Catalog's own governed edits.
- **Fixed a related, previously-broken governance path**: `applyPendingEdit`'s switch had no `case` for `stock_item` at all — an approved supervisor edit to a Stock Catalog item silently never applied. Added the missing case (and the matching hard-delete branch) as part of giving the consolidated entity type a working target.
- **Consolidated the transfer workflow (Critical-02)**: `workshopOverview`'s `pendingTransfers` now reads `stock_transfers` (the dedicated request→approve→dispatch→receive lifecycle) instead of the simpler `stock_movements` (`movement_type='transfer'`) shortcut. `stockMovementsCreate`'s `validTypes` no longer accepts `'transfer'`.
- **Fixed 4 hardcoded role arrays**: `stockTransferApprove`, `stockTransfersApproveReject`, `stockTransfersDispatch`, `stockTransfersReceive` — all converted to `mustRole(user, 'stock-transfers')`. Live-verified against `role_definitions`: no role loses access; `storekeeper`/`supervisor`/`logistics-officer` gain actions they already had the page permission for.
- **Fixed a live-reproduced crash**: `stockItemsDelete`/`logisticsDelete` threw an unhandled foreign-key violation when deleting an item referenced by any of 9 other tables (material requests, stock transfers, procurement lines, production, fuel logs, workshop consumption). Both now check usage first via a new `_stockItemUsageCount` helper and return a clear error instead, mirroring `stockCategoriesDelete`'s existing block-if-referenced pattern.
- Also fixed `getDashboardStats`'s low-stock counter, which was also reading `logistics_items`.
- **Audit-history foundation**: `MODULE_PERMISSION_CHECK` extended with `stock_catalog`, `warehouses`, `stock_movements`, `stock_transfers`; structured `logAudit` opts added to every core mutation that lacked them.
- **Notifications**: the stock-transfer lifecycle (create/approve/reject/receive-completion) now notifies, mirroring Material Requests' existing pattern — it fired zero notifications before this phase.

## Desktop (`renderer/app.js`)

- `renderLogistics` (Spare Parts & Materials): "Current stock"/"Stock" fields removed from Add/Edit forms; entity type and governance panels updated to `stock_item`.
- `renderStockItems` (Stock Catalog): added pending-edit/deletion-request panels (previously had none, despite sharing governance with the now-consolidated Spare Parts page).
- `renderStockMovements`: removed 'Transfer' from the creation dropdown and its "To warehouse" field; removed the inline transfer approve/reject buttons and handlers (historical transfer rows still display, read-only).
- `renderWorkshopOverview`: transfer approve/reject now calls `UFCL.stockTransfersApprove` (the dedicated lifecycle) instead of the retired shortcut.

## Mobile

- `WorkshopOverviewScreen.tsx`: transfer approve switched to `useStockTransferApprove` (dedicated lifecycle).
- `StockMovementFormScreen.tsx`: removed 'Transfer' type and its destination-warehouse field.
- `StockMovementsScreen.tsx`: removed inline transfer approve/reject UI, the now-unused `RejectModal`, and related styles.

## Mobile API

- `routes/stock.js`: `INVENTORY_ROLES` was missing `admin` (found during this phase's own role-array review) — fixed, matches `CATALOG_ROLES`.
- `routes/stockTransfers.js`: approve route now uses the full `ACT_ROLES` grant list instead of a narrower `APPROVE_ROLES`.
- `routes/workshops.js`: legacy `/transfers/:movementId/approve` route's role list widened to match.

## Database

- Removed 3 stale test rows from `logistics_items` (leftover debris, not real data). Table itself left in place, unused going forward.

## Verification

- `node --check`: clean on all touched backend/route files.
- `npx tsc --noEmit` (mobile): clean.
- Live DB smoke test via throwaway `_qa_inv_p1_*` accounts (all deactivated after): full catalog-consolidation read/write chain, full transfer create→approve chain as a storekeeper (previously blocked), source-of-truth check (one item, one stock figure across 4 surfaces), and the delete-crash fix (reproduced live, then verified fixed).

## Not committed

Per standing release discipline, none of the above has been committed or pushed.
