# Inventory Integrity Phase 1 — Changelog

Stock Transfer Discrepancy Integration. See `INVENTORY_INTEGRITY_PHASE1_COMPLETION_REPORT.md` for full detail, reasoning, and live-verification evidence.

## Database (migration applied to live DB via `npm run migrate`)

- `db/migrate.js`
  - New column: `stock_movements.loss_reason text` — the standardized "Business Reason" category (Loss in Transit / Damaged During Transport / Short Shipment / Theft / Write-off / Manual Count Adjustment / Expired Material / Other), populated only on `movement_type='loss'` rows.
  - New index: `idx_stock_mv_type on stock_movements(movement_type)` — supports the new Loss reports' filtering/grouping.
  - New permission key: `inventory-loss-reports` (page-visibility only — the backend function itself still gates on the existing `stock-movements` permission) granted to the same live role list that already holds `stock-movements`: `storekeeper-assistant`, `storekeeper`, `logistics-officer`, `logistics`, `ceo`, `operations`, `admin` (verified live before writing this list).

## Backend

- `db/services/data.js`
  - `stockTransfersReportDiscrepancy(userId, transferId, notes, lossReason)` — new required `lossReason` parameter, validated against the new `DISCREPANCY_REASONS` closed list. Inside the existing transaction, now also inserts one `stock_movements` row (`movement_type='loss'`, `warehouse_id=from_warehouse_id`, `to_warehouse_id=null`, `transfer_id` linked, `unit_cost` looked up from `stock_catalog`, `approval_status='approved'`/`approved_by`/`approved_at` auto-populated) — does **not** touch `stock_levels` (already correct from dispatch/receive). Returns `movementId` in addition to the existing `discrepancyQty`. Existing `logAudit` call's meta extended with `movementId`/`lossReason`; existing notification bodies enriched to name the reason/movement — no new audit or notification calls added.
  - New `inventoryLossReports(userId, filters)` — 7 named CSV datasets (`lossByType`, `lossByWarehouse`, `lossByItem`, `lossTrend`, `lossHistory`, `topLossCategories`, `topLossLocations`), gated on the existing `stock-movements` permission, workshop-isolated. Exported.
  - `stockMovementsList` — SELECT extended to include `sm.loss_reason`/`sm.transfer_id` (previously an explicit column list, not `sm.*`, so these were silently missing) in both the workshop-filtered and unfiltered query branches.

## Electron

- `electron/main.js` — `stock-transfers:report-discrepancy` handler extended to pass through `lossReason`; new `inventory:loss-reports` handler.
- `electron/preload.js` — `UFCL.stockTransfersReportDiscrepancy` extended with a `lossReason` parameter; new `UFCL.inventoryLossReports(userId, filters)` method.

## Mobile API

- `mobile-api/routes/stockTransfers.js` — `POST /:id/report-discrepancy` now accepts `lossReason` in the body and passes it through.

## Desktop (`renderer/app.js`, `renderer/index.html`)

- New `DISCREPANCY_REASONS` constant (mirrors the backend list).
- Report Discrepancy overlay (`.st-discrepancy` handler) — now shows Dispatched/Received/Difference, a required Movement Type picker, and on success opens a confirmation overlay (movement number/type/reference/status) with a "View Inventory Movement" button that jumps to the Stock Movements page pre-filtered to `loss`.
- Stock Movements page (`renderStockMovements`) — `loss` added to the type badge map and status filter; new "Losses" KPI tile; loss reason shown in the Reference column for `loss` rows; new "View Transfer" row action (jumps to the linked Stock Transfer's detail overlay) via a new `wireSmRowActions` handler.
- New NAV entry "Inventory Loss Reports" under Workshop & Inventory; new `renderInventoryLossReports()` page (KPI strip, 6-month trend chart via the existing `_svgBar` helper, 7 CSV export sections via the existing `execExport` pattern); new `page-inventory-loss-reports` container in `index.html`; new `showPage` case; new role-permission checkbox (`chk('inventory-loss-reports', ...)`) in the Users/Roles admin UI.

## Mobile

- `mobile/src/components/ReasonModal.tsx` — new optional `extraContent?: React.ReactNode` prop (undefined by default, zero effect on existing callers), rendered between the message and the text input.
- `mobile/src/screens/stockTransfers/StockTransfersListScreen.tsx` — new `DISCREPANCY_REASONS` constant + `LossReasonPicker` component, wired into the existing discrepancy `ReasonModal` via `extraContent`; `handleDiscrepancy` now passes `lossReason`; success alert names the reason and movement id.
- `mobile/src/hooks/useStockTransfers.ts` — `useStockTransferReportDiscrepancy` extended to accept/send `lossReason`, response typed with `movementId`.
- `mobile/src/types/api.ts` — `MovementType` gained `'loss'`; `StockMovement` gained `loss_reason?`/`transfer_id?`.
- `mobile/src/screens/stock/StockMovementsScreen.tsx` — `loss` added to type color/label maps and the filter chip list; loss reason shown inline; new "View Transfer" row action (cross-tab navigation to the Stock Transfers stack's detail screen, same `as never` pattern already established for the Mechanician dashboard's cross-tab deep links); correct `-` sign for `loss` quantities.

## Verification

- `node --check`: clean on every touched backend/desktop/REST file.
- `npx tsc --noEmit` (mobile): clean, zero errors.
- Live end-to-end test (production DB, throwaway stock item + a real transfer, Gatare → Nyanza, removed after): reproduced the brief's own 100-dispatched/80-received scenario; confirmed the resulting `stock_movements` row's exact shape, `stock_levels` unchanged by the discrepancy step (no double-deduction), correct report inclusion and value totals, correct audit entry, correct notifications. All cleaned up after.

## Outstanding (not fixed this phase — see report)

- `loss` movements can still be soft-deleted via the existing generic, governed Stock Movements delete action — not specially guarded, since the existing reason-required/audit-logged/recoverable-from-trash mechanism already satisfies traceability.
- No mobile CSV/reports screen for Inventory Loss Reports — desktop-only, consistent with every other reports page in this app.
- No configurable approval-threshold escalation — explicitly out of this phase's scope per the brief ("if company policy later requires").

## Not committed

Per standing release discipline, none of the code above has been committed or pushed. The database migration (new column, new index, new permission grant) was applied live, as noted in the completion report.
