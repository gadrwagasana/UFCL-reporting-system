# Inventory Department — Phase 2 Changelog

Functional Completion, Enterprise UI/UX & Professional Inventory Experience. See `INVENTORY_PHASE2_COMPLETION_REPORT.md` for full detail.

## Backend (`db/services/data.js`)

- **Added** `inventoryDashboard(userId, workshopId)` — Executive KPIs (12) + Operational Widgets (8) for the Inventory Dashboard, composed entirely from existing tables (`stock_catalog`, `stock_levels`, `stock_movements`, `stock_transfers`, `material_requests`, `procurement_goods_receipts`/`procurement_purchase_orders`). Workshop-scoped for restricted users using the same `wsWhere`/`wsParams` pattern established in Workshop's `workshopOverview`.
- **Fixed/formalized** `stockMovementsCreate` — an `adjustment`-type movement now requires a non-empty `notes` (reason); write behavior otherwise unchanged.
- `electron/main.js`/`preload.js` — new `inventory:dashboard` IPC channel.
- `mobile-api/routes/stock.js` — new `GET /api/stock/inventory/dashboard` route.

## Desktop (`renderer/app.js`)

- `renderInventory` (Stock Levels → renamed "Inventory Dashboard"): full Executive KPI strip, 8 Operational Widgets, CSV export, plus the existing register table upgraded to the enterprise toolkit (search/filter/sort).
- `renderWarehouses`: search added; card grid gained a detail overlay + History tab (previously had neither).
- `renderStockItems` (Stock Catalog): full enterprise toolkit (search/filter/sort/bulk-deactivate); detail overlay with audit history and quick actions (Edit/Use).
- `renderStockMovements`: search/filter/sort toolkit; detail overlay with audit history (read-focused, no bulk actions — append-only log). Adjustment reason requirement added to the create form.
- `renderStockTransfers`: search/filter/sort/bulk-approve toolkit; the existing dispatch-history detail view is now always available (previously only shown once dispatched) and gained a generic audit-history section alongside its dispatch-event log.

## Mobile

- `mobile/src/types/api.ts`, `api/endpoints.ts`, `hooks/useStock.ts` — new `InventoryDashboardResponse` type + `useInventoryDashboard` hook.
- `screens/stock/StockLevelsScreen.tsx` — Executive KPI grid (6 tiles) + 2 Operational Widgets (Pending Transfers, Material Requests Awaiting), renamed "Inventory Dashboard".
- `screens/stock/StockMovementFormScreen.tsx` — adjustment-reason requirement, client-side validated.
- `screens/workshops/WorkshopsListScreen.tsx` — in-screen search added (was global-search-only).
- `screens/stockTransfers/StockTransfersListScreen.tsx` — in-screen search + status filter chips added (was global-search-only).
- `screens/stock/StockCatalogScreen.tsx` — reviewed, already had full in-screen search/filter; no change needed.

## Verification

- `node --check`: clean on all touched backend/route files.
- `npx tsc --noEmit` (mobile): clean.
- Live DB smoke test via throwaway `_qa_inv_p2_*` accounts (all deactivated after): adjustment-reason enforcement (rejected without, succeeds with), `inventoryDashboard` correctness for both unrestricted and workshop-restricted users (verified against real Procurement/Material Request data), and the bulk-deactivate code path. A transient database connectivity outage briefly interrupted verification; all tests were re-run and passed once connectivity returned — none were skipped.

## Not committed

Per standing release discipline, none of the above has been committed or pushed.
