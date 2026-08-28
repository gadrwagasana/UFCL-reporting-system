# Inventory Department — Phase 3 Changelog

Executive Visibility, Operational Intelligence & Production Readiness. See `INVENTORY_PHASE3_COMPLETION_REPORT.md` for full detail.

## Backend (`db/services/data.js`)

- **Added** `inventoryIntelligence(userId, workshopId)` — Operational Intelligence for the Inventory Dashboard:
  - 5 monthly trend series (6 months, zero-filled): Consumption, Receiving, Adjustments, Transfers, and net Inventory (Receiving − Consumption).
  - 3 "most active" item lists (last 90 days): Most Consumed, Most Requested, Most Transferred.
  - Inventory Aging: in-stock items ranked by days since last movement.
  - Inventory Health: Healthy / Low / Critical / Inactive / Fast-moving / Slow-moving counts.
  - Forecast: expected consumption/receiving/transfers/inventory level next month (3-month historical average), each response carrying an explicit `basis` string; Reorder Watch List with Critical/Warning risk tagging.
  - Workshop-scoped for restricted users, same `wsWhere`/`wsParams` pattern as `inventoryDashboard`.
- `electron/main.js`/`preload.js` — new `inventory:intelligence` IPC channel.
- `mobile-api/routes/stock.js` — new `GET /api/stock/inventory/intelligence` route.

## Bug fix (caught by live testing)

- `inventoryIntelligence`'s Aging query referenced `sm.warehouse_id` inside a CTE that never aliased `stock_movements` as `sm` — threw `missing FROM-clause entry for table "sm"` for every workshop-restricted user (the filter is only appended when restricted, so unrestricted users never hit it in testing). Fixed by adding the missing alias; re-verified for both restricted and unrestricted accounts.

## Desktop (`renderer/app.js`)

- `renderInventory`: new **Operational Intelligence** section — 5 trend cards (`_svgBar`/`_svgLine`), a 6-tile Inventory Health card, 4 "most active"/aging widgets (`_lgdWidget`), and a Forecast card with a Reorder Watch List table. CSV export extended with all of the above.

## Mobile

- `mobile/src/types/api.ts`, `api/endpoints.ts`, `hooks/useStock.ts` — `InventoryIntelligenceResponse` type + `useInventoryIntelligence` hook.
- `screens/stock/StockLevelsScreen.tsx` — new `TrendChart`/`ReorderWatchCard` components; condensed Operational Intelligence section (2 trend charts, 4-tile health strip, Reorder Watch List, 3-figure Forecast card).

## Verification

- `node --check`: clean on all touched backend/route files.
- `npx tsc --noEmit` (mobile): clean.
- Live DB smoke test via throwaway `_qa_inv_p3_*` accounts (admin + workshop-restricted storekeeper, all deactivated after): confirmed correct trend/health/forecast/reorder data for both account types; caught and fixed the aging-query alias bug on the restricted-user path.

## Production readiness

Per the Phase 3 assessment, the Inventory Department is considered **Production Ready**, completing the audit → Phase 1 → Phase 2 → Phase 3 lifecycle.

## Not committed

Per standing release discipline, none of the above (nor any prior Inventory phase) has been committed or pushed.
