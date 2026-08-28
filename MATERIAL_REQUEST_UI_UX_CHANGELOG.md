# Material Request — UI/UX Redesign Changelog

Aligns the Material Request module's UI with the Material Request → Stock Transfer unification: the requester-facing surface now shows only "what do I need and where is it," while everything about physical movement is presented read-only via a new Linked Transfer view. See `MATERIAL_REQUEST_UI_UX_REDESIGN_REPORT.md` for full rationale and decisions.

## Schema (`db/migrate.js`)

- **Added** `material_requests.needed_by date` — nullable, informational only (no validation/business-logic attached).

## Backend (`db/services/data.js`)

- `materialRequestsList` — now `left join`s `stock_transfers` (via `mr.transfer_id`) and returns `needed_by` plus `transfer_id`/`transfer_status`/`transfer_reference`/`transfer_from_warehouse_name`/`transfer_to_warehouse_name`/`transfer_dispatched_qty`/`transfer_received_qty`/`transfer_discrepancy_qty`/`transfer_discrepancy_notes`. Read-only lookup; Stock Transfer's own logic/tables are untouched. `items` now also returns `total_stock` per item (read-only display).
- `materialRequestsCreate` — accepts and stores `needed_by`.

## Desktop (`renderer/app.js`)

- **New** top-level `openStockTransferDetailOverlay(transferId)` — extracted from the Stock Transfers page's previously-inline `.st-detail` handler (behavior unchanged) so Material Requests can open the identical overlay instead of duplicating it.
- `renderMaterialRequests` — full rewrite:
  - Dashboard KPI row expanded to Pending/Approved/Transfer Created/In Transit/Completed/Overdue/Urgent/Total.
  - New "Recent Activity" widget (reuses `_lgdWidget`, fed from already-fetched data).
  - Request Log columns changed to Request #/Date/Workshop/Requester/Items/Priority/Status/Needed By/Linked Transfer/Actions; status filter gained "completed".
  - Create form restructured into Request Information (auto fields + priority + needed-by + purpose) / Requested Items (item table with read-only available stock) / Attachments (optional reference field — no upload framework exists in this codebase, see report §5).
  - Detail overlay restructured into tabs (Overview/Items/Linked Transfer/History) using the existing `.smo-tabs`/`.smo-tab` pattern; Overview tab shows a new 6-stage "Approval Progress" stepper (Submitted → Approved → Transfer Created → In Transit → Received → Completed).
  - Bulk-approve dialog now explicitly lists how many selected requests will be skipped for lacking a destination workshop.

## Mobile

- `mobile/src/types/api.ts` — `MaterialRequest` gains `needed_by` + 8 `transfer_*` read-only fields; `StockItemRef` gains optional `total_stock`.
- `mobile/src/hooks/useMaterialRequests.ts` — `CreateMaterialRequestPayload` gains `needed_by`/`workshop_id`; priority type aligned to `normal|high|urgent` (previously allowed an unused `critical` value the rest of the app didn't recognize).
- `mobile/src/screens/material/MaterialRequestCreateScreen.tsx` — rebuilt into Request Information / Requested Items (with available-stock display) / Attachments sections; item source switched to `materialRequestsList`'s items (carries stock figures) instead of the generic stock-items endpoint; added `DatePickerField` for Needed By.
- `mobile/src/screens/material/MaterialRequestsListScreen.tsx` — cards now show the synthesized request number (`MR-000015`), a needed-by line (red when overdue), and a linked-transfer status pill.
- `mobile/src/screens/material/MaterialRequestDetailScreen.tsx` — new inline Approval Progress stepper card (6 stages, same semantics as desktop); new `LinkedTransferCard` (reuses `useStockTransferHistory`, shows transfer number/status/route/vehicle/driver/dispatch date/received qty/discrepancy); needed-by row added to the Request card.

## Verification

- `node --check`: clean on `db/migrate.js`, `db/services/data.js`, `renderer/app.js`.
- `npx tsc --noEmit` (mobile): clean.
- Live DB smoke test via a throwaway `_qa_mr_ui_test` account and a throwaway catalog item (both fully cleaned up after — no pre-existing data touched): create → verify pre-approval row has no transfer linkage → approve → verify the list query correctly surfaces the new transfer as `'approved'` with zero inventory writes → dispatch → receive → verify auto-completion and that the read-only join stays in sync with Stock Transfer's own state throughout, with no duplicated update logic anywhere.

## Not committed

Per standing release discipline, none of the above has been committed or pushed.
