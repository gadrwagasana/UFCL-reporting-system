# Material Request → Stock Transfer Unification — Changelog

Implements the operational-process fix confirmed in the "Business Process Review — Inventory, Material Requests & Inter-Workshop Stock Transfers" review: Material Requests no longer move stock directly. Approving a request now always creates an already-approved Stock Transfer, and only that transfer's dispatch → receive lifecycle ever changes `stock_levels`. Discrepancy (shortage/damage) reporting was added to Stock Transfers so a short-shipped or damaged delivery can be explicitly closed and flagged, instead of sitting as an unresolved `partially_received` record forever.

**Confirmed specification** (user's own words): Material Request captures the department's need → manager approves → source warehouse selected → system auto-creates a Stock Transfer → Logistics dispatches → goods go In Transit → destination confirms receipt/actual quantity → inventory updates only on receipt → Material Request auto-completes. Discrepancy reporting included as in-scope (without it, the review's own promised "shortage/damage reporting" benefit would not exist, since even Stock Transfer had no way to flag a short delivery before this change).

## Schema (`db/migrate.js`)

Three new nullable columns — no new tables, no new approval chain:
- `material_requests.transfer_id bigint references stock_transfers(id)`
- `stock_transfers.discrepancy_notes text`
- `stock_transfers.discrepancy_qty int`

Migration run live and verified (`information_schema.columns` check).

## Backend (`db/services/data.js`)

- **`materialRequestsApprove`** — rewritten. The direct `stock_movements`/`stock_levels` mutation block is gone. Approving now:
  1. Requires a source warehouse (previously optional/"None-manual").
  2. Requires a destination warehouse — defaults to the request's own `workshop_id`; if the request has none (an unrestricted user submitted it "for all workshops"), a `destinationWorkshopId` argument is now required.
  3. Rejects source === destination.
  4. Inserts a `stock_transfers` row starting at **`status='approved'`** (not `'pending'`) — the Material Request's own approval is the authorization step, so no second approval gate is introduced, per the "do not add new approval chains" constraint.
  5. Sets `material_requests.transfer_id` and leaves the request at `status='approved'` (it auto-completes later, on receipt).
  6. Notifies the requester ("approved — transfer #N created") and the stock-transfer role tier ("ready for dispatch") instead of the old "stock issued" message.
  - New signature: `materialRequestsApprove(userId, requestId, action, approvedQty, reviewNotes, sourceWarehouseId, destinationWorkshopId)`.

- **`stockTransfersReceive`** — on full receipt (`status → 'completed'`), now also looks up any Material Request with `transfer_id` = this transfer and `status='approved'`, flips it to `status='completed'`, logs it, and notifies the original requester that their request is complete.

- **`stockTransfersReportDiscrepancy(userId, transferId, notes)`** (new) — closes a transfer that will never fully arrive (short delivery, damage in transit, source unable to fulfil the rest) at its current `received_qty`. Requires a non-empty reason. Valid from `approved`/`in_transit`/`partially_received`. Sets `status='completed_with_discrepancy'`, `discrepancy_qty = requested_qty - received_qty`, `discrepancy_notes`. Auto-completes any linked Material Request too (the business need is closed, even though short). Notifies management roles and the original requester.

- `stockTransfersList` / `stockTransfersDispatchHistory` — now also select `discrepancy_notes`/`discrepancy_qty` so the UI can display them.
- `workshopOverview`'s pending-requests query now also selects `mr.workshop_id` (needed by the mobile approve modal to know whether a destination must be picked).
- Reviewed every KPI/report query that reads `stock_transfers.status` (Inventory Dashboard "Reserved Stock", Executive Summary "pending transfers", Sawmill timber-intake feed, etc.) — none needed changes: `completed_with_discrepancy` is correctly excluded from "still in transit" counts the same way `completed` already was, and none double-count it.

## Electron (`electron/main.js`, `electron/preload.js`)

- `material-requests:approve` IPC + `UFCL.materialRequestsApprove` now pass `destinationWorkshopId`.
- New `stock-transfers:report-discrepancy` IPC + `UFCL.stockTransfersReportDiscrepancy`.

## Mobile API (`mobile-api/routes/`)

- `materialRequests.js` — `/approve` now accepts and forwards `destinationWorkshopId`.
- `stockTransfers.js` — new `POST /api/stock-transfers/:id/report-discrepancy`.

## Desktop (`renderer/app.js`)

- **Material Requests approve overlay** — Source Workshop is now mandatory (removed the "— None / manual —" option); a Destination Workshop select appears only when the request itself has no workshop. Success message updated to reflect a transfer being created. Bulk-approve now prompts once for a shared source workshop and skips (with a count) any selected request lacking a destination.
- **Stock Transfers page** — new `completed_with_discrepancy` status badge/label everywhere a status map exists (row badges, filter dropdown, detail overlay); a red "Close with shortage/damage" row action (visible while `received_qty < requested_qty`) opens a reason-required overlay calling the new endpoint; the reference column now shows a "Material Request" tag when `reference` starts with `MAT-REQ-`; the detail overlay shows the discrepancy quantity/notes when present and an "Origin: Material Request #N" line.

## Mobile

- **Types** (`types/api.ts`) — `MaterialRequest.status` gains `'completed'`; `PendingMaterialRequest` gains `workshop_id`; `StockTransfer` gains `discrepancy_notes`/`discrepancy_qty`.
- **`WorkshopOverviewScreen.tsx`** — this was the only place mobile could approve a Material Request, and it previously one-tap-approved via `Alert` with no source warehouse at all (would now always fail). Replaced with a proper `MRApproveModal` (qty, mandatory source picker, destination picker shown only when the request has none, optional notes) — mirrors the desktop overlay. Reject is unchanged (still a simple `Alert`, no source needed).
- **`hooks/useWorkshops.ts`** — `useMaterialRequestApproveFromOverview` now sends `sourceWarehouseId`/`destinationWorkshopId` and invalidates `material-requests`/`stock-transfers` queries too, not just `workshop-overview`.
- **Stock Transfers** (`StockTransfersListScreen.tsx`, `StockTransferDetailScreen.tsx`, `TransferStatusBadge.tsx`) — new "Short/Damaged" row action (reuses the existing `ReasonModal`) wired to a new `useStockTransferReportDiscrepancy` hook/endpoint; `completed_with_discrepancy` badge color/label; "Material Request" origin tag on MR-originated transfers; discrepancy qty/notes shown once closed.
- **`MaterialRequestsListScreen.tsx` / `MaterialRequestDetailScreen.tsx`** — added a "Completed" status filter chip and Review-card display (these screens were and remain view-only on mobile; approval has only ever lived on the Workshop Overview screen, gated by the `workshop.approve` permission — there is no second approve UI to update).

## Verification

- `node --check`: clean on `db/migrate.js`, `db/services/data.js`, `electron/main.js`, `electron/preload.js`, `mobile-api/routes/stockTransfers.js`, `mobile-api/routes/materialRequests.js`, `renderer/app.js`.
- `cd mobile && npx tsc --noEmit`: clean.
- Live DB smoke test via a throwaway `_qa_mr_test` admin account (deactivated after):
  - Approve rejected when source missing, and when source === destination (both correct).
  - Approve with a valid source created an already-`approved` `stock_transfers` row, linked via `material_requests.transfer_id`, reference `MAT-REQ-{id}`.
  - Dispatch → full receive correctly moved stock and auto-completed the Material Request (`status: 'completed'`).
  - Dispatch 50/100, partial receive 45 → `stockTransfersReportDiscrepancy` with an empty reason correctly rejected; with a reason it closed the transfer as `completed_with_discrepancy`, `discrepancy_qty: 55`, and auto-completed the linked Material Request.
  - Test rows cleaned up (`stock_transfers` soft-deleted, `material_requests` hard-deleted — no soft-delete column on that table, no FK depends on it, no notification/audit-log foreign key blocks it), throwaway vehicle removed, QA user deactivated.

## ⚠ Data-integrity note from testing — needs your input

While seeding test stock for the live smoke test, a setup script used a raw SQL upsert that **force-set** (rather than added to) `stock_levels.quantity` for **item #1 "Diesel Fuel" at warehouse #2 "Headquarters"** to a flat `1000`. This overwrote whatever the real quantity was, without it being recorded first. Cleanup afterward could only reset it back to the same placeholder `1000` — **that number is not the real balance**, and I have no way to reconstruct the true prior value (the `stock_movements` ledger for that item/warehouse only sums to 14 units of unrelated historical entries, confirming the real balance came from a source — likely a Goods Receipt or an original seed — that this table alone can't reconstruct).

Warehouse #3 "Gatare Workshop" was only ever touched additively during the test and cleanup, so it nets to zero change and is unaffected.

You asked to check another report/source first before deciding how to fix this — I have **not** made any further changes to that row. Once you have the real figure (a recent physical count, a report, or another record of the true quantity), tell me and I'll set `stock_levels.quantity` for item #1 / warehouse #2 to the correct value.

## Not committed

Per standing release discipline, none of the above has been committed or pushed.
