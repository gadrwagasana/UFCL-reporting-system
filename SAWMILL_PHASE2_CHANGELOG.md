# Sawmill Phase 2 — Changelog

## Database

**`db/migrate.js`**
- Added `createSawmillCostingFoundation()`: adds `products.standard_cost`, `products.default_price` (with positive-value check constraints), plus independent Finance approval metadata (`standard_cost_approved_by`, `standard_cost_approved_at`, `standard_cost_effective_date`) and Management approval metadata (`default_price_approved_by`, `default_price_approved_at`, `default_price_effective_date`); adds `stock_catalog.default_selling_price`.

## Backend (`db/services/data.js`)

- `productsCreate`/`productsUpdate` — Standard Cost, Default Selling Price, and their full approval metadata (approver name + effective date for each, independently) are now mandatory on every create and edit; both values propagate immediately into `stock_catalog.unit_cost`/`default_selling_price` in the same transaction. An edit re-stamps `approved_at` — treated as a re-approval, never a silent change.
- `productsList` — returns the new cost/price/approval fields.
- `salesProductsForDropdown` — returns `default_price` so Sales can prefill the negotiated price.
- `timberInventoryList` — extended with `costing` (inventory value, production cost, sales value, COGS, gross profit, gross margin %, raw logs consumed, finished timber produced), `reconciliation` (enterprise Produced−Sold=Stock identity), `timberProcessingReconciliation` (Kiln/CCA/Untreated breakdown vs. total, with an explanatory note rather than a fabricated reconciliation), `inventoryValueByLocation`, and `productProfitability` (per-product monthly rollup).
- Fixed a bug (caught during this phase's own live verification): `productsUpdate`'s `stock_catalog` sync query referenced a non-existent `stock_catalog.updated_at` column.

## Desktop (`renderer/app.js`)

- Product Catalog (`renderProducts`) — Add Product form gains Standard Cost, Finance approver, cost effective date, Default Selling Price, Management approver, and price effective date fields (all required). New Edit Product overlay (backend `productsUpdate` was previously wired but had no UI trigger). Table gains Std. Cost / Default Price columns with approval subtext and a "Cost/Price not set" warning badge.
- Sales (`renderSales`) — unit price prefills from the selected product's Default Selling Price on size selection, still fully editable. The inline "Add to Product Catalog" quick-add panel gains the same mandatory cost/price/approval fields.
- Executive Dashboard (`renderExecutiveDashboard`) — new "Sawmill Cost & Profitability" panel (Inventory Value, Production Cost, Sales Value, COGS, Gross Profit, Gross Margin %, Raw Logs Consumed, Finished Timber Produced, reconciliation badge, inventory value by location), sourced from `timberInventoryList` rather than a duplicate query.
- Timber Inventory (`renderTimberInventory`) — new "Cost, Valuation & Reconciliation" card: reconciliation badges, cost KPIs, Product Profitability table, CSV export (reuses `downloadCsv()`).

## Mobile

- `mobile/src/types/api.ts` — `Product` extended with cost/price/approval fields; `SalesDropdownProduct` gains `default_price`; new `SawmillCosting`, `SawmillReconciliation`, `TimberProcessingReconciliation`, `InventoryValueByLocation`, `ProductProfitability` types; `TimberInventoryResponse` extended.
- `mobile/src/screens/products/ProductFormScreen.tsx` — Standard Cost, Finance approver, cost effective date, Default Selling Price, Management approver, price effective date fields added (all required, create and edit).
- `mobile/src/screens/products/ProductsListScreen.tsx` — cost/price display with "not set" warning badges.
- `mobile/src/screens/salesOrders/SalesOrderFormScreen.tsx` — unit price prefills from Default Selling Price on size selection.
- `mobile/src/screens/timberInventory/TimberInventoryScreen.tsx` — new `CostingCard`: reconciliation badges, cost KPIs, inventory value by location, Product Profitability table.

## Data (one-time, not a migration)

- Backfilled placeholder Standard Cost / Default Selling Price for the 3 existing products (10,000/15,000, 12,000/18,000, 6,000/9,000 RWF respectively), both approval fields set to an explicit `"PENDING APPROVAL (placeholder — Sawmill Phase 2 QA, not yet Finance/Management-approved)"` marker per your instruction — see completion report §9 for how to replace with real figures.

## Verification

- `node --check` clean on all touched backend/desktop files; `tsc --noEmit` clean on mobile.
- Live end-to-end verification of Paths A, B, and C against production DB with throwaway QA data — inventory quantities, valuation, unit cost preservation through transfer, Default/Negotiated price separation, COGS, Gross Margin, Product Profitability, audit logs, notifications, and the enterprise reconciliation identity all confirmed exact. All QA data removed afterward; `stock_levels` confirmed back at its exact pre-test baseline.

## Not changed

No second costing engine, no second inventory ledger, no duplicate Finished Timber products, no manual reconciliation tables, no bypass of Stock Transfer. Every Finished Timber transaction continues to flow through the existing `stock_catalog`/`stock_levels`/`stock_movements` architecture; every calculation reads the same `stock_catalog.unit_cost`/`products.standard_cost` figures confirmed by the Workstream 7 audit to be the ERP's one existing costing source.
