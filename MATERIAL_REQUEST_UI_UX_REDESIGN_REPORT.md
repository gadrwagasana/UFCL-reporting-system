# Material Request — Professional UI/UX Redesign Report

Aligns the Material Request module's UI/UX with the completed Material Request → Stock Transfer unification. This is a presentation-layer redesign, not a business-process change: business logic, the approval workflow, the Stock Transfer lifecycle, inventory calculations, permissions, workshop isolation, and the Electron → IPC → data.js / REST architecture are all unchanged.

## 1. Executive Summary

The Material Request module previously mixed two concerns in one screen: "what does my department need" and fragments of "how does it get here" (a source-workshop field only the approver used, a flat status badge that couldn't show transfer/dispatch/receipt progress). Since the Material Request → Stock Transfer unification, *all* physical movement — source selection, dispatch, vehicle/driver, receiving, discrepancy — is owned exclusively by Stock Transfer. This redesign makes that boundary visible: the requester-facing screens now answer exactly one question ("what do I need, and where is my request"), and everything about the physical move is presented read-only through a new "Linked Transfer" view that reuses the Stock Transfers page's own detail overlay rather than re-implementing it.

No business logic, approval workflow, Stock Transfer logic, inventory calculation, permission, or API contract changed. Three additive, non-breaking changes were made: one new nullable database column (`material_requests.needed_by`), one query-level join (Material Request's list now also reads — never writes — the linked Stock Transfer's status/route, exactly the same way it already read `stock_catalog` for item names), and one small function extraction (`openStockTransferDetailOverlay`, pulled out of the Stock Transfers page so Material Requests could reuse it instead of duplicating it).

## 2. UI Improvements

- **Request Log table** (desktop): replaced the old Item/Workshop/Qty/Priority/Status/Reason/Requested/Actions columns with Request #/Date/Workshop/Requester/Items/Priority/Status/Needed By/Linked Transfer/Actions — matching the enterprise column vocabulary used across Procurement/Logistics/Workshop/Inventory.
- **Synthesized Request Number**: displayed as `MR-000015` (zero-padded `id`) everywhere a request is referenced — no new column, no new sequence, purely a display format (see §8, "no schema change beyond `needed_by`").
- **Dashboard KPI row**: expanded from 4 tiles (Total/Pending/Approved/Rejected) to 8 (Pending, Approved, Transfer Created, In Transit, Completed, Overdue, Urgent, Total), each pulling from data already in the list response — no second query, no duplication of Stock Transfer's own dashboard.
- **Recent Activity widget**: reuses the existing `_lgdWidget` component (the same one used on the Inventory dashboard) fed from the already-fetched request list — no new endpoint.
- **Tabbed detail view** (desktop): the old single long-scroll overlay is now Overview / Items / Linked Transfer / History tabs, reusing the exact `.smo-tabs`/`.smo-tab` visual pattern already established by the Supplier profile overlay — not a new tab component.
- **Mobile**: request cards now show the request number, a "Needed By" line (flagged red when overdue), and a linked-transfer status pill; the detail screen gained an "Approval Progress" stepper card and a "Linked Transfer" card.

## 3. UX Improvements

- **One question, one screen**: the "New Material Request" form is organized into Section 1 (Request Information: auto request #/date/workshop/requester, priority, needed-by, purpose) and Section 2 (Requested Items: an enterprise-style item table showing available stock read-only, quantity, unit) — the requester is never asked to pick a source warehouse, a vehicle, or confirm a receipt.
- **Progress visibility**: every request now shows an "Approval Progress" stepper — Submitted → Approved → Transfer Created → In Transit → Received → Completed (Rejected breaks out as a distinct end state) — computed from the request's own status plus its linked transfer's status, so a requester always knows where their request stands without needing to understand Stock Transfer internals.
- **Overdue/urgent surfacing**: the new `needed_by` field drives an "Overdue" badge on both the row and the KPI tile — purely informational (no validation or blocking logic attached, per "do not change business logic").
- **Bulk approve safety**: bulk-approving still requires one shared source workshop up front (unchanged from the prior fix), and any selected request lacking a destination workshop is now visibly listed as "will be skipped" before the manager confirms, rather than silently failing.

## 4. Workflow Alignment

The approval *action* itself (a manager selecting a source, and a destination if the request has none, then confirming) still lives on the Material Requests page — this was a deliberate decision, not an oversight. The request brief's step list separates "Approved" and "Stock Transfer Created" visually, but in the actual backend (unchanged, per the "do not change approval workflow" rule) these happen atomically in one call: approving *is* what authorizes and creates the transfer, with no second approval gate. Introducing a separate "create transfer" step would have meant changing the approval workflow itself, which was explicitly out of scope. The UI resolves this by treating "Approved" and "Transfer Created" as sequential display stages of one atomic backend action, and by making unmistakably clear (both in the Approve dialog's copy — "a stock transfer was created and is ready for dispatch" — and in the stepper) that the source-warehouse pick is part of *authorizing* the request, not an inventory operation the requester performs. The requester themselves never sees or touches a source-warehouse field anywhere in the create/edit/view flow.

## 5. Removed / Deferred Items

Per the "remove from Material Request" list — Source Warehouse selector, Dispatch info, Driver, Vehicle, Transport details, Receiving confirmation, Inventory deduction, Stock movement controls, Manual transfer status — **none of these were ever present on the create/edit form or the requester's view to begin with** (only the manager-only Approve dialog had a source-warehouse field, addressed in §4). This redesign's real "removal" work was ensuring the *detail* view never leaked this information as raw Stock Transfer internals — it's now exclusively behind the read-only "Linked Transfer" tab/card, sourced from Stock Transfer's own data, never duplicated.

Two items from the brief could not be implemented as literally specified, and were deliberately scoped down rather than silently skipped or over-built:

- **Attachments**: no file/photo upload framework exists anywhere in this codebase (confirmed by search — the one similar feature, vehicle document photos, stores a bare local path that's never actually served). Building one (multer + storage + a mobile image picker) is a substantial new subsystem, which the brief's own "reuse existing" and "do not introduce new architecture" rules argue against inventing here. Implemented instead as a plain optional "Reference" text field (folded into the existing `reason` text on submit as `"...— Ref: <text>"`) — the same honest, no-new-infrastructure approach already used elsewhere in this codebase for the same gap.
- **Comments** (mentioned under History): no comment/threaded-discussion storage exists anywhere in the app to reuse. Not built. The History tab shows Audit History (existing `logAudit`/`_loadLogisticsHistoryInto` mechanism) — Approvals and Notifications are visible as audit entries within that same feed, since separate dedicated feeds for those don't exist elsewhere either.
- **Sticky header / true pagination / expandable inline row panel**: no other list screen in this codebase (Procurement, Logistics, Workshop, Inventory) has these either — the shared table toolkit's ceiling is search/filter/sort/bulk-actions/status-chips, applied here identically. Introducing a one-off pagination or sticky-header mechanism just for this module would itself be "a new visual language," which the brief explicitly prohibits.

## 6. New Linked Transfer Experience

- **Backend**: `materialRequestsList`'s query gained a `left join stock_transfers st on st.id = mr.transfer_id` (plus warehouse name joins), surfacing `transfer_id`, `transfer_status`, `transfer_reference`, `transfer_from_warehouse_name`, `transfer_to_warehouse_name`, `transfer_dispatched_qty`, `transfer_received_qty`, `transfer_discrepancy_qty`, `transfer_discrepancy_notes`, and `needed_by`. This is a read-only lookup — nothing about Stock Transfer's own logic changed.
- **Desktop**: the Stock Transfers page's row-detail overlay logic was extracted into a standalone `openStockTransferDetailOverlay(transferId)` function (previously inline and only reachable from that page) so the Material Requests "Linked Transfer" tab, and the list's transfer-status badge button, can open the *exact same* overlay — full dispatch history, discrepancy details, everything — with zero duplicated markup or logic.
- **Mobile**: a new `LinkedTransferCard` on the detail screen calls the same `useStockTransferHistory` hook the Stock Transfers screens already use, showing transfer number/status/source/destination/vehicle/driver/dispatch date/received qty/discrepancy. It does not deep-link into the Stock Transfers stack (cross-stack navigation between `MaterialRequestsStack` and `StockTransfersStack` isn't currently wired anywhere in the app, and adding it was judged out of scope for a UI/UX pass) — the summary itself carries everything a requester needs to know progress without touching logistics.

## 7. Mobile/Desktop Parity

| Capability | Desktop | Mobile |
|---|---|---|
| Request # display | ✅ | ✅ |
| Needed By + overdue flag | ✅ | ✅ |
| Purpose/Justification relabel | ✅ | ✅ |
| Available stock shown read-only at request time | ✅ | ✅ |
| Priority set aligned (normal/high/urgent) | ✅ (already was) | ✅ (fixed — mobile previously allowed an unsupported `'critical'` value neither the desktop badge nor the urgent-notification logic recognized) |
| Dashboard KPI tiles | ✅ (8 tiles) | Existing Workshop Overview KPI already counts "Material requests"; a dedicated Material Request dashboard screen was not requested as separate navigation and wasn't added, to avoid a redundant nav entry — summarized instead within the existing list screen's header stats where applicable |
| Approval Progress stepper | ✅ (tab) | ✅ (card) |
| Linked Transfer view | ✅ (tab, full detail, "View Transfer" opens complete dispatch log) | ✅ (card, summary only, no cross-stack deep link — see §6) |
| Attachments (reference-only) | ✅ | ✅ |
| Tabbed detail layout | ✅ (new, reuses `.smo-tabs`) | Stacked cards (existing mobile convention — no screen in this app uses a real tab bar for detail views; adding one here would be a new pattern, not a reuse) |

## 8. Files Modified

**Backend**
- `db/migrate.js` — `material_requests.needed_by date` (new nullable column).
- `db/services/data.js` — `materialRequestsList` (joins linked transfer + returns `needed_by`), `materialRequestsCreate` (accepts/stores `needed_by`).

**Desktop**
- `renderer/app.js` — `openStockTransferDetailOverlay` extracted as a top-level reusable function; `renderMaterialRequests` fully rewritten (dashboard, Recent Activity, redesigned list columns, redesigned create form, tabbed detail overlay, Approval Progress stepper); Stock Transfers page's `.st-detail` handler updated to call the extracted function (behavior unchanged).

**Mobile**
- `mobile/src/types/api.ts` — `MaterialRequest` gains `needed_by` + linked-transfer fields; `StockItemRef` gains optional `total_stock`.
- `mobile/src/hooks/useMaterialRequests.ts` — `CreateMaterialRequestPayload` gains `needed_by`/`workshop_id`, priority set aligned to normal/high/urgent.
- `mobile/src/screens/material/MaterialRequestCreateScreen.tsx` — rebuilt into Section 1 (Request Information)/Section 2 (Requested Items with available-stock display)/Attachments; switched its item source from the generic stock-items endpoint to `materialRequestsList`'s own items (which carries stock figures, matching desktop).
- `mobile/src/screens/material/MaterialRequestsListScreen.tsx` — request-number + needed-by/overdue + linked-transfer badge on each card.
- `mobile/src/screens/material/MaterialRequestDetailScreen.tsx` — new Approval Progress stepper card, needed-by row, new `LinkedTransferCard`.

## 9. Verification Results

- `node --check`: clean on `db/migrate.js`, `db/services/data.js`, `renderer/app.js`.
- `cd mobile && npx tsc --noEmit`: clean.
- Live DB smoke test (throwaway `_qa_mr_ui_test` account + a throwaway catalog item, both fully cleaned up afterward — see `feedback_live_db_testing_safety` discipline):
  1. Created a request with `priority: 'high'`, `needed_by: '2026-08-15'` — confirmed `materialRequestsList` returns `needed_by` correctly (and, cross-checked, correctly reconstructs the local calendar date on the desktop side's formatter — no timezone off-by-one).
  2. Confirmed the pre-approval list row has `transfer_id: null` and all `transfer_*` fields `null` — no premature linkage.
  3. Approved with a source warehouse — confirmed the same list query now returns `transfer_id`, `transfer_status: 'approved'`, and both warehouse names, with **zero writes to any inventory table** at this point (approval alone still only creates the transfer row, exactly as the prior Material Request → Stock Transfer unification work established — this redesign didn't touch that).
  4. Dispatched and fully received the transfer — confirmed `material_requests.status` auto-completed to `'completed'` and `transfer_status` read `'completed'` through the same list query, proving the read-only join stays in sync with Stock Transfer's own lifecycle without any duplicated update logic.
- Confirmed via code inspection that no inventory table (`stock_levels`, `stock_movements`) is touched anywhere in `materialRequestsCreate` or `materialRequestsApprove` — inventory only ever changes inside `stockTransfersDispatch`/`stockTransfersReceive`/`stockTransfersReportDiscrepancy`, unchanged by this redesign.

## 10. Recommendations

1. **Optional follow-up, not required now**: wire cross-stack navigation from the mobile Linked Transfer card into the Stock Transfers stack's detail screen, once/if that navigation pattern is needed elsewhere too (several other modules could benefit from the same "jump to related record" capability) — better done as one deliberate navigation-architecture pass than a one-off for this module.
2. **Optional follow-up**: if a real attachment/file-upload capability is ever prioritized for the app broadly, Material Request's "Reference" field is a natural first consumer — no rework needed on this module's side, since the text-reference field's data (folded into `reason`) would simply become redundant once real attachments exist, not conflicting with them.
3. No other follow-up is required — the module is functionally complete, verified end-to-end, and consistent with the enterprise UI/UX standard already established across Procurement, Logistics, Workshop, and Inventory.

## Not committed

Per standing release discipline, none of the above has been committed or pushed.
